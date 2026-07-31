/**
 * Relevé de facturation (intérim / ETT) — pur.
 *
 * Produit, pour chaque personne, des lignes **par chantier et par semaine**
 * (S21, S22…) détaillant : heures normales, heures supplémentaires (+25/+50 %),
 * heures fériées, heures d'intempérie, paniers repas et indemnités de
 * déplacement — avec **prix unitaires** et **totaux**. Sert à comparer et
 * vérifier les factures des agences.
 *
 * Hypothèses documentées :
 *  - Les heures supplémentaires sont calculées par (personne × chantier × semaine)
 *    (un intérimaire est en général sur une seule mission par semaine).
 *  - Les heures travaillées un **jour férié** sont isolées de l'assiette des
 *    heures normales/supplémentaires et facturées à leur propre prix.
 */
import { isoWeekKey, monthKey } from "./dates.js";
import { isFrenchHoliday } from "./holidays.js";
import { activeEntries } from "./reports.js";
import { minutesToHours, weeklyOvertime } from "./time.js";
import type { CostRate, TimeEntry, Worker } from "./types.js";

export interface UnitPrices {
  normal: number;
  ot25: number;
  ot50: number;
  holiday: number;
  weather: number;
  meal: number;
  travel: number;
}

/** Prix unitaires effectifs pour une personne sur un chantier (avec repli). */
export function resolveUnitPrices(
  workerId: string,
  chantierId: string,
  workers: Worker[],
  rates: CostRate[],
): UnitPrices {
  const worker = workers.find((w) => w.id === workerId);
  const r = rates.find((x) => x.workerId === workerId && x.chantierId === chantierId);
  const base = r?.hourlyRate ?? worker?.hourlyRate ?? 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    normal: round2(base),
    ot25: round2(r?.overtime25Rate ?? base * 1.25),
    ot50: round2(r?.overtime50Rate ?? base * 1.5),
    holiday: round2(r?.holidayRate ?? base * 2),
    weather: round2(r?.weatherRate ?? base * 0.75),
    meal: round2(r?.mealAllowance ?? 0),
    travel: round2(r?.travelAllowance ?? 0),
  };
}

export interface BillingLine {
  chantierId: string;
  weekKey: string; // "2026-W21"
  weekLabel: string; // "S21"
  normalHours: number;
  overtime25Hours: number;
  overtime50Hours: number;
  holidayHours: number;
  weatherHours: number;
  mealCount: number; // nombre de paniers (jours de présence)
  travelCount: number; // nombre d'indemnités de déplacement
  unit: UnitPrices;
  amounts: {
    normal: number;
    ot25: number;
    ot50: number;
    holiday: number;
    weather: number;
    meal: number;
    travel: number;
  };
  total: number;
}

export interface BillingStatement {
  worker: Worker;
  month: string;
  lines: BillingLine[];
  totalHours: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function buildLine(
  chantierId: string,
  weekKey: string,
  list: TimeEntry[],
  unit: UnitPrices,
): BillingLine {
  let holidayMinutes = 0;
  let normalDayMinutes = 0;
  let weatherMinutes = 0;
  const presentDays = new Set<string>();

  for (const e of list) {
    if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
      if (isFrenchHoliday(e.date)) holidayMinutes += e.minutes;
      else normalDayMinutes += e.minutes;
      if (e.minutes > 0) presentDays.add(e.date);
    } else if (e.kind === "INTEMPERIE") {
      weatherMinutes += e.minutes;
    }
  }

  const ot = weeklyOvertime(normalDayMinutes);
  const normalHours = minutesToHours(ot.normalMinutes);
  const overtime25Hours = minutesToHours(ot.tier1Minutes);
  const overtime50Hours = minutesToHours(ot.tier2Minutes);
  const holidayHours = minutesToHours(holidayMinutes);
  const weatherHours = minutesToHours(weatherMinutes);
  const mealCount = presentDays.size;
  const travelCount = presentDays.size;

  const amounts = {
    normal: round2(normalHours * unit.normal),
    ot25: round2(overtime25Hours * unit.ot25),
    ot50: round2(overtime50Hours * unit.ot50),
    holiday: round2(holidayHours * unit.holiday),
    weather: round2(weatherHours * unit.weather),
    meal: round2(mealCount * unit.meal),
    travel: round2(travelCount * unit.travel),
  };
  const total = round2(
    amounts.normal + amounts.ot25 + amounts.ot50 + amounts.holiday + amounts.weather + amounts.meal + amounts.travel,
  );

  return {
    chantierId,
    weekKey,
    weekLabel: `S${weekKey.slice(-2)}`,
    normalHours,
    overtime25Hours,
    overtime50Hours,
    holidayHours,
    weatherHours,
    mealCount,
    travelCount,
    unit,
    amounts,
    total,
  };
}

/**
 * Relevés de facturation mensuels pour les personnes retenues par `filter`.
 * `month` au format "YYYY-MM".
 */
export function billingStatements(
  entries: TimeEntry[],
  workers: Worker[],
  rates: CostRate[],
  month: string,
  filter: (w: Worker) => boolean = () => true,
): BillingStatement[] {
  const monthEntries = activeEntries(entries).filter((e) => monthKey(e.date) === month);
  const eligible = workers.filter(filter);
  const wanted = new Set(eligible.map((w) => w.id));

  // Regroupe par personne → (chantier|semaine) → pointages.
  const perWorker = new Map<string, Map<string, TimeEntry[]>>();
  for (const e of monthEntries) {
    if (!wanted.has(e.workerId)) continue;
    let groups = perWorker.get(e.workerId);
    if (!groups) {
      groups = new Map();
      perWorker.set(e.workerId, groups);
    }
    const key = `${e.chantierId}|${isoWeekKey(e.date)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  const out: BillingStatement[] = [];
  for (const worker of eligible) {
    const groups = perWorker.get(worker.id);
    if (!groups) continue;
    const lines: BillingLine[] = [];
    for (const [key, list] of groups) {
      const [chantierId, weekKey] = key.split("|") as [string, string];
      const unit = resolveUnitPrices(worker.id, chantierId, workers, rates);
      lines.push(buildLine(chantierId, weekKey, list, unit));
    }
    lines.sort((a, b) =>
      a.chantierId === b.chantierId
        ? a.weekKey.localeCompare(b.weekKey)
        : a.chantierId.localeCompare(b.chantierId),
    );
    const total = round2(lines.reduce((s, l) => s + l.total, 0));
    const totalHours = round2(
      lines.reduce(
        (s, l) => s + l.normalHours + l.overtime25Hours + l.overtime50Hours + l.holidayHours,
        0,
      ),
    );
    out.push({ worker, month, lines, totalHours, total });
  }

  out.sort((a, b) =>
    a.worker.lastName.localeCompare(b.worker.lastName) ||
    a.worker.firstName.localeCompare(b.worker.firstName),
  );
  return out;
}
