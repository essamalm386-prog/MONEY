/**
 * Calcul des coûts — pur.
 *
 * À partir des pointages, des personnes et de la grille de coûts par
 * (personne × chantier), estime le coût : main-d'œuvre, paniers repas,
 * indemnités de déplacement, indemnités d'intempéries. La majoration des
 * heures supplémentaires est prise en compte au niveau hebdomadaire (paliers
 * BTP), là où elle a un sens légal.
 */
import { isoWeekKey } from "./dates.js";
import { activeEntries } from "./reports.js";
import { minutesToHours, weatherIndemnityAmount, weeklyOvertime } from "./time.js";
import type { CostRate, TimeEntry, Worker } from "./types.js";

export interface ResolvedRate {
  hourlyRate: number;
  mealAllowance: number;
  travelAllowance: number;
}

/** Grille effective pour une personne sur un chantier (avec repli). */
export function resolveRate(
  workerId: string,
  chantierId: string,
  workers: Worker[],
  rates: CostRate[],
): ResolvedRate {
  const worker = workers.find((w) => w.id === workerId);
  const rate = rates.find((r) => r.workerId === workerId && r.chantierId === chantierId);
  return {
    hourlyRate: rate?.hourlyRate ?? worker?.hourlyRate ?? 0,
    mealAllowance: rate?.mealAllowance ?? 0,
    travelAllowance: rate?.travelAllowance ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Le pointage correspond-il à une journée de présence (ouvrant droit aux indemnités) ? */
function isPresentDay(e: TimeEntry): boolean {
  return (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") && e.minutes > 0;
}

export interface EntryCost {
  labor: number; // main-d'œuvre (heures × taux, hors majoration)
  meal: number; // panier repas
  travel: number; // indemnité déplacement
  weather: number; // indemnité intempéries
  total: number;
}

/** Coût d'un pointage isolé (granularité jour, hors majoration heures sup.). */
export function entryCost(e: TimeEntry, rate: ResolvedRate): EntryCost {
  let labor = 0;
  let meal = 0;
  let travel = 0;
  let weather = 0;

  if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
    labor = minutesToHours(e.minutes) * rate.hourlyRate;
  }
  if (e.kind === "INTEMPERIE") {
    weather = weatherIndemnityAmount(e.minutes, rate.hourlyRate);
  }
  if (isPresentDay(e)) {
    meal = rate.mealAllowance;
    travel = rate.travelAllowance;
  }
  return {
    labor: round2(labor),
    meal: round2(meal),
    travel: round2(travel),
    weather: round2(weather),
    total: round2(labor + meal + travel + weather),
  };
}

export interface CostSummary {
  labor: number;
  meal: number;
  travel: number;
  weather: number;
  total: number;
}

function emptyCost(): CostSummary {
  return { labor: 0, meal: 0, travel: 0, weather: 0, total: 0 };
}

function addCost(acc: CostSummary, c: EntryCost): void {
  acc.labor = round2(acc.labor + c.labor);
  acc.meal = round2(acc.meal + c.meal);
  acc.travel = round2(acc.travel + c.travel);
  acc.weather = round2(acc.weather + c.weather);
  acc.total = round2(acc.total + c.total);
}

/** Coût total sur un ensemble de pointages. */
export function totalCost(entries: TimeEntry[], workers: Worker[], rates: CostRate[]): CostSummary {
  const acc = emptyCost();
  for (const e of activeEntries(entries)) {
    addCost(acc, entryCost(e, resolveRate(e.workerId, e.chantierId, workers, rates)));
  }
  return acc;
}

/** Coût regroupé selon une clé. */
function groupCost<K extends string>(
  entries: TimeEntry[],
  workers: Worker[],
  rates: CostRate[],
  keyOf: (e: TimeEntry) => K,
): Map<K, CostSummary> {
  const map = new Map<K, CostSummary>();
  for (const e of activeEntries(entries)) {
    const k = keyOf(e);
    let acc = map.get(k);
    if (!acc) {
      acc = emptyCost();
      map.set(k, acc);
    }
    addCost(acc, entryCost(e, resolveRate(e.workerId, e.chantierId, workers, rates)));
  }
  return map;
}

export const costByWorker = (e: TimeEntry[], w: Worker[], r: CostRate[]) =>
  groupCost(e, w, r, (x) => x.workerId);
export const costByChantier = (e: TimeEntry[], w: Worker[], r: CostRate[]) =>
  groupCost(e, w, r, (x) => x.chantierId);

export function costByAgency(
  entries: TimeEntry[],
  workers: Worker[],
  rates: CostRate[],
): Map<string, CostSummary> {
  const agencyOf = new Map(workers.map((w) => [w.id, w.agencyId ?? "INTERNE"]));
  return groupCost(entries, workers, rates, (e) => agencyOf.get(e.workerId) ?? "INTERNE");
}

export interface PayrollLine {
  workerId: string;
  weekKey: string;
  normalHours: number;
  overtime25Hours: number;
  overtime50Hours: number;
  paidEquivalentHours: number;
  laborCost: number; // paid-equivalent hours × taux (majorations incluses)
  allowances: number; // paniers + déplacements de la semaine
  weatherIndemnity: number;
  total: number;
}

/**
 * Paie hebdomadaire par personne, **avec majoration des heures supplémentaires**
 * (35 h légales, +25 % puis +50 %). Les paniers/déplacements sont comptés par
 * jour de présence ; l'indemnité d'intempérie est ajoutée.
 */
export function payrollByWorkerWeek(
  entries: TimeEntry[],
  workers: Worker[],
  rates: CostRate[],
): PayrollLine[] {
  const groups = new Map<string, TimeEntry[]>();
  for (const e of activeEntries(entries)) {
    const key = `${e.workerId}|${isoWeekKey(e.date)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  const lines: PayrollLine[] = [];
  for (const [key, list] of groups) {
    const [workerId, weekKey] = key.split("|") as [string, string];
    const workedMinutes = list
      .filter((e) => e.kind === "TRAVAIL" || e.kind === "ACCIDENT")
      .reduce((s, e) => s + e.minutes, 0);
    const ot = weeklyOvertime(workedMinutes);

    // Taux moyen pondéré par chantier (une personne peut tourner sur plusieurs
    // chantiers dans la semaine). On agrège aussi indemnités et intempéries.
    let allowances = 0;
    let weatherIndemnity = 0;
    let weightedRateNum = 0;
    let weightedRateDen = 0;
    for (const e of list) {
      const r = resolveRate(e.workerId, e.chantierId, workers, rates);
      const c = entryCost(e, r);
      allowances = round2(allowances + c.meal + c.travel);
      weatherIndemnity = round2(weatherIndemnity + c.weather);
      if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
        weightedRateNum += minutesToHours(e.minutes) * r.hourlyRate;
        weightedRateDen += minutesToHours(e.minutes);
      }
    }
    const avgRate = weightedRateDen > 0 ? weightedRateNum / weightedRateDen : 0;
    const laborCost = round2(ot.paidEquivalentHours * avgRate);

    lines.push({
      workerId,
      weekKey,
      normalHours: minutesToHours(ot.normalMinutes),
      overtime25Hours: minutesToHours(ot.tier1Minutes),
      overtime50Hours: minutesToHours(ot.tier2Minutes),
      paidEquivalentHours: ot.paidEquivalentHours,
      laborCost,
      allowances,
      weatherIndemnity,
      total: round2(laborCost + allowances + weatherIndemnity),
    });
  }
  lines.sort((a, b) =>
    a.workerId === b.workerId
      ? a.weekKey.localeCompare(b.weekKey)
      : a.workerId.localeCompare(b.workerId),
  );
  return lines;
}
