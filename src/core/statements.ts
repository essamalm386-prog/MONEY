/**
 * Relevés mensuels structurés — purs.
 *
 * Construit, par personne, un relevé mensuel détaillé : heures par chantier,
 * nombre de jours travaillés (utile pour comparer paniers/IFM des factures ETT),
 * ventilation hebdomadaire des heures supplémentaires (l'intérim est facturé à
 * la semaine) et estimation de coût. Sert de source unique au rendu PDF.
 */
import { isoWeekKey, monthKey } from "./dates.js";
import { entryCost, resolveRate, type CostSummary } from "./cost.js";
import { activeEntries } from "./reports.js";
import { minutesToHours, weeklyOvertime } from "./time.js";
import type { Chantier, CostRate, EntryKind, TimeEntry, Worker } from "./types.js";

export interface ChantierLine {
  chantierId: string;
  workedMinutes: number;
  workedDays: number;
  weatherMinutes: number;
  absenceDays: number;
  accidentCount: number;
}

export interface WeekOvertimeLine {
  weekKey: string;
  workedHours: number;
  normalHours: number;
  overtime25Hours: number;
  overtime50Hours: number;
}

export interface DailyLine {
  date: string;
  chantierId: string;
  kind: EntryKind;
  minutes: number;
  detail?: string;
}

export interface StatementTotals {
  workedHours: number;
  workedDays: number;
  weatherHours: number;
  absenceDays: number;
  accidentCount: number;
  normalHours: number;
  overtime25Hours: number;
  overtime50Hours: number;
}

export interface WorkerStatement {
  worker: Worker;
  month: string;
  byChantier: ChantierLine[];
  weeks: WeekOvertimeLine[];
  days: DailyLine[];
  totals: StatementTotals;
  cost: CostSummary;
}

function isPresentDay(e: TimeEntry): boolean {
  return (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") && e.minutes > 0;
}

/**
 * Relevés mensuels pour les personnes retenues par `filter`.
 * `month` au format "YYYY-MM". Seuls les pointages de ce mois sont pris en compte.
 */
export function monthlyStatements(
  entries: TimeEntry[],
  workers: Worker[],
  costs: CostRate[],
  month: string,
  filter: (w: Worker) => boolean = () => true,
): WorkerStatement[] {
  const monthEntries = activeEntries(entries).filter((e) => monthKey(e.date) === month);
  const eligible = workers.filter(filter);
  const wanted = new Set(eligible.map((w) => w.id));

  // Regroupe les pointages du mois par personne.
  const perWorker = new Map<string, TimeEntry[]>();
  for (const e of monthEntries) {
    if (!wanted.has(e.workerId)) continue;
    (perWorker.get(e.workerId) ?? perWorker.set(e.workerId, []).get(e.workerId)!).push(e);
  }

  const out: WorkerStatement[] = [];
  for (const worker of eligible) {
    const list = perWorker.get(worker.id) ?? [];
    if (list.length === 0) continue;

    // Détail par chantier.
    const chantierMap = new Map<string, ChantierLine>();
    const presentDaysByChantier = new Map<string, Set<string>>();
    for (const e of list) {
      let line = chantierMap.get(e.chantierId);
      if (!line) {
        line = {
          chantierId: e.chantierId,
          workedMinutes: 0,
          workedDays: 0,
          weatherMinutes: 0,
          absenceDays: 0,
          accidentCount: 0,
        };
        chantierMap.set(e.chantierId, line);
        presentDaysByChantier.set(e.chantierId, new Set());
      }
      if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") line.workedMinutes += e.minutes;
      if (e.kind === "INTEMPERIE") line.weatherMinutes += e.minutes;
      if (e.kind === "ABSENCE") line.absenceDays += 1;
      if (e.kind === "ACCIDENT") line.accidentCount += 1;
      if (isPresentDay(e)) presentDaysByChantier.get(e.chantierId)!.add(e.date);
    }
    for (const [cid, line] of chantierMap) {
      line.workedDays = presentDaysByChantier.get(cid)!.size;
    }
    const byChantier = [...chantierMap.values()].sort((a, b) =>
      a.chantierId.localeCompare(b.chantierId),
    );

    // Ventilation hebdomadaire des heures supplémentaires.
    const weekMinutes = new Map<string, number>();
    for (const e of list) {
      if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
        const wk = isoWeekKey(e.date);
        weekMinutes.set(wk, (weekMinutes.get(wk) ?? 0) + e.minutes);
      }
    }
    const weeks: WeekOvertimeLine[] = [...weekMinutes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekKey, mins]) => {
        const ot = weeklyOvertime(mins);
        return {
          weekKey,
          workedHours: minutesToHours(mins),
          normalHours: minutesToHours(ot.normalMinutes),
          overtime25Hours: minutesToHours(ot.tier1Minutes),
          overtime50Hours: minutesToHours(ot.tier2Minutes),
        };
      });

    // Détail jour par jour (trié).
    const days: DailyLine[] = list
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.chantierId.localeCompare(b.chantierId))
      .map((e) => ({
        date: e.date,
        chantierId: e.chantierId,
        kind: e.kind,
        minutes: e.minutes,
        detail: e.note,
      }));

    // Coût estimé (comparaison facture).
    const cost = list.reduce(
      (acc, e) => {
        const c = entryCost(e, resolveRate(e.workerId, e.chantierId, workers, costs));
        acc.labor += c.labor;
        acc.meal += c.meal;
        acc.travel += c.travel;
        acc.weather += c.weather;
        acc.total += c.total;
        return acc;
      },
      { labor: 0, meal: 0, travel: 0, weather: 0, total: 0 } as CostSummary,
    );
    for (const k of Object.keys(cost) as (keyof CostSummary)[]) {
      cost[k] = Math.round(cost[k] * 100) / 100;
    }

    const totals: StatementTotals = {
      workedHours: minutesToHours(byChantier.reduce((s, l) => s + l.workedMinutes, 0)),
      workedDays: byChantier.reduce((s, l) => s + l.workedDays, 0),
      weatherHours: minutesToHours(byChantier.reduce((s, l) => s + l.weatherMinutes, 0)),
      absenceDays: byChantier.reduce((s, l) => s + l.absenceDays, 0),
      accidentCount: byChantier.reduce((s, l) => s + l.accidentCount, 0),
      normalHours: weeks.reduce((s, w) => s + w.normalHours, 0),
      overtime25Hours: Math.round(weeks.reduce((s, w) => s + w.overtime25Hours, 0) * 100) / 100,
      overtime50Hours: Math.round(weeks.reduce((s, w) => s + w.overtime50Hours, 0) * 100) / 100,
    };

    out.push({ worker, month, byChantier, weeks, days, totals, cost });
  }

  out.sort((a, b) =>
    a.worker.lastName.localeCompare(b.worker.lastName) ||
    a.worker.firstName.localeCompare(b.worker.firstName),
  );
  return out;
}

/** Regroupe des relevés par agence d'intérim (clé = agencyId). */
export function statementsByAgency(
  statements: WorkerStatement[],
): Map<string, WorkerStatement[]> {
  const map = new Map<string, WorkerStatement[]>();
  for (const s of statements) {
    const key = s.worker.agencyId ?? "SANS_AGENCE";
    (map.get(key) ?? map.set(key, []).get(key)!).push(s);
  }
  return map;
}

/** Chantier lisible depuis une liste (helper pour le rendu). */
export function chantierLabel(chantiers: Chantier[], id: string): string {
  const c = chantiers.find((x) => x.id === id);
  return c ? `${c.name} (${c.code})` : id;
}
