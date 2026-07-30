/**
 * Calculs d'heures — purs et déterministes.
 *
 * Toutes les durées internes sont en **minutes entières** afin d'éviter les
 * erreurs d'arrondi en virgule flottante (crucial pour la paie et la facturation
 * intérim). Les conversions vers/depuis les heures décimales sont explicites.
 */
import { LABOR } from "./types.js";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse "HH:mm" → minutes depuis minuit. Renvoie null si invalide. */
export function parseHHMM(value: string): number | null {
  const m = HHMM.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** minutes depuis minuit → "HH:mm". */
export function formatHHMM(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError("minutes invalides");
  const total = Math.round(minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** minutes → heures décimales, arrondi à 2 décimales. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** heures décimales → minutes entières. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/**
 * Durée travaillée à partir d'un créneau début/fin (moins la pause).
 * Gère le passage de minuit (fin < début ⇒ journée à cheval).
 * Lève une erreur si le résultat est négatif (pause > amplitude).
 */
export function workedMinutes(start: string, end: string, breakMinutes = 0): number {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s === null) throw new RangeError(`heure de début invalide: ${start}`);
  if (e === null) throw new RangeError(`heure de fin invalide: ${end}`);
  if (breakMinutes < 0) throw new RangeError("pause négative");
  let span = e - s;
  if (span < 0) span += 24 * 60; // franchit minuit
  const net = span - breakMinutes;
  if (net < 0) throw new RangeError("la pause dépasse l'amplitude horaire");
  return net;
}

/**
 * Arrondi d'une durée au pas indiqué (ex. 15 min) selon un mode.
 * Utile pour normaliser les saisies terrain.
 */
export function roundMinutes(
  minutes: number,
  step = 15,
  mode: "nearest" | "up" | "down" = "nearest",
): number {
  if (step <= 0) return Math.round(minutes);
  const q = minutes / step;
  const r = mode === "up" ? Math.ceil(q) : mode === "down" ? Math.floor(q) : Math.round(q);
  return r * step;
}

export interface OvertimeBreakdown {
  /** Minutes normales (≤ 35h). */
  normalMinutes: number;
  /** Minutes majorées à +25 % (36e→43e h). */
  tier1Minutes: number;
  /** Minutes majorées à +50 % (au-delà de 43h). */
  tier2Minutes: number;
  /** Total heures « équivalentes payées » (avec majorations appliquées). */
  paidEquivalentHours: number;
}

/**
 * Ventile un total hebdomadaire de minutes travaillées en heures normales /
 * supplémentaires selon les paliers BTP (35h légales, +25 % puis +50 %).
 */
export function weeklyOvertime(totalWorkedMinutes: number): OvertimeBreakdown {
  const clamped = Math.max(0, totalWorkedMinutes);
  const legal = LABOR.WEEKLY_LEGAL_HOURS * 60;
  const tier2Start = LABOR.WEEKLY_TIER2_HOURS * 60;

  const normalMinutes = Math.min(clamped, legal);
  const tier1Minutes = Math.min(Math.max(clamped - legal, 0), tier2Start - legal);
  const tier2Minutes = Math.max(clamped - tier2Start, 0);

  const paidEquivalentMinutes =
    normalMinutes +
    tier1Minutes * (1 + LABOR.OVERTIME_TIER1_RATE) +
    tier2Minutes * (1 + LABOR.OVERTIME_TIER2_RATE);

  return {
    normalMinutes,
    tier1Minutes,
    tier2Minutes,
    paidEquivalentHours: minutesToHours(paidEquivalentMinutes),
  };
}

/**
 * Indemnité de chômage-intempéries pour une journée : la 1re heure est en
 * franchise (carence), le reste est indemnisé au taux BTP. Renvoie les minutes
 * indemnisables (avant application du taux), utilisées ensuite pour la paie.
 */
export function weatherIndemnizableMinutes(lostMinutes: number): number {
  const eligible = lostMinutes - LABOR.WEATHER_DEDUCTIBLE_MINUTES;
  return Math.max(0, eligible);
}

/** Montant indemnité intempérie en euros pour un taux horaire donné. */
export function weatherIndemnityAmount(lostMinutes: number, hourlyRate: number): number {
  const min = weatherIndemnizableMinutes(lostMinutes);
  const amount = minutesToHours(min) * hourlyRate * LABOR.WEATHER_INDEMNITY_RATE;
  return Math.round(amount * 100) / 100;
}
