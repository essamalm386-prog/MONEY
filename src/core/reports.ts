/**
 * Agrégation des pointages en rapports jour / semaine / mois.
 *
 * Fonctions pures prenant une liste de TimeEntry (déjà filtrée par période si
 * besoin) et produisant des synthèses exploitables par la hiérarchie et par
 * la facturation intérim.
 */
import { isoWeekKey, monthKey } from "./dates.js";
import { minutesToHours, weeklyOvertime } from "./time.js";
import type { TimeEntry, Worker } from "./types.js";

/** Ne conserve que les pointages actifs (non supprimés logiquement). */
export function activeEntries(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((e) => !e.deleted);
}

export interface Totals {
  workedMinutes: number;
  weatherMinutes: number;
  absenceDays: number;
  accidentCount: number;
  workedHours: number;
  weatherHours: number;
}

function emptyTotals(): Totals {
  return {
    workedMinutes: 0,
    weatherMinutes: 0,
    absenceDays: 0,
    accidentCount: 0,
    workedHours: 0,
    weatherHours: 0,
  };
}

function accumulate(t: Totals, e: TimeEntry): void {
  switch (e.kind) {
    case "TRAVAIL":
      t.workedMinutes += e.minutes;
      break;
    case "INTEMPERIE":
      t.weatherMinutes += e.minutes;
      break;
    case "ABSENCE":
      t.absenceDays += 1;
      break;
    case "ACCIDENT":
      t.accidentCount += 1;
      t.workedMinutes += e.minutes; // heures travaillées avant l'arrêt
      break;
  }
}

function finalize(t: Totals): Totals {
  t.workedHours = minutesToHours(t.workedMinutes);
  t.weatherHours = minutesToHours(t.weatherMinutes);
  return t;
}

/** Totaux globaux sur un ensemble de pointages. */
export function totals(entries: TimeEntry[]): Totals {
  const t = emptyTotals();
  for (const e of activeEntries(entries)) accumulate(t, e);
  return finalize(t);
}

/** Regroupe et totalise selon une clé calculée. */
function groupTotals<K extends string>(
  entries: TimeEntry[],
  keyOf: (e: TimeEntry) => K,
): Map<K, Totals> {
  const map = new Map<K, Totals>();
  for (const e of activeEntries(entries)) {
    const k = keyOf(e);
    let t = map.get(k);
    if (!t) {
      t = emptyTotals();
      map.set(k, t);
    }
    accumulate(t, e);
  }
  for (const t of map.values()) finalize(t);
  return map;
}

export const byWorker = (entries: TimeEntry[]) => groupTotals(entries, (e) => e.workerId);
export const byChantier = (entries: TimeEntry[]) => groupTotals(entries, (e) => e.chantierId);
export const byDate = (entries: TimeEntry[]) => groupTotals(entries, (e) => e.date);
export const byWeek = (entries: TimeEntry[]) => groupTotals(entries, (e) => isoWeekKey(e.date));
export const byMonth = (entries: TimeEntry[]) => groupTotals(entries, (e) => monthKey(e.date));

/**
 * Regroupement par agence d'intérim (nécessite la table des personnes).
 * Les employés internes (sans agence) sont classés sous la clé "INTERNE".
 */
export function byAgency(entries: TimeEntry[], workers: Worker[]): Map<string, Totals> {
  const agencyOf = new Map(workers.map((w) => [w.id, w.agencyId ?? "INTERNE"]));
  return groupTotals(entries, (e) => agencyOf.get(e.workerId) ?? "INTERNE");
}

export interface WorkerWeekReport {
  workerId: string;
  weekKey: string;
  totals: Totals;
  overtime: ReturnType<typeof weeklyOvertime>;
}

/**
 * Feuille hebdomadaire par personne, avec ventilation heures sup. (BTP).
 * Clé de tri : `${workerId}|${weekKey}`.
 */
export function weeklyByWorker(entries: TimeEntry[]): WorkerWeekReport[] {
  const map = groupTotals(entries, (e) => `${e.workerId}|${isoWeekKey(e.date)}`);
  const out: WorkerWeekReport[] = [];
  for (const [key, t] of map) {
    const [workerId, weekKey] = key.split("|") as [string, string];
    out.push({
      workerId,
      weekKey,
      totals: t,
      overtime: weeklyOvertime(t.workedMinutes),
    });
  }
  out.sort((a, b) =>
    a.workerId === b.workerId
      ? a.weekKey.localeCompare(b.weekKey)
      : a.workerId.localeCompare(b.workerId),
  );
  return out;
}

/**
 * Synthèse mensuelle par personne et par chantier — la vue « justificatif »
 * attendue par la hiérarchie et rapprochée des relevés d'agence.
 */
export interface MonthlyLine {
  monthKey: string;
  workerId: string;
  chantierId: string;
  totals: Totals;
}

export function monthlyDetail(entries: TimeEntry[]): MonthlyLine[] {
  const map = groupTotals(
    entries,
    (e) => `${monthKey(e.date)}|${e.workerId}|${e.chantierId}`,
  );
  const out: MonthlyLine[] = [];
  for (const [key, t] of map) {
    const [mk, workerId, chantierId] = key.split("|") as [string, string, string];
    out.push({ monthKey: mk, workerId, chantierId, totals: t });
  }
  out.sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.workerId.localeCompare(b.workerId));
  return out;
}
