/**
 * Jours fériés français (métropole) — pur et déterministe.
 *
 * Sert à isoler les **heures fériées** dans les relevés (facturation ETT).
 * Pâques est calculée par l'algorithme de Meeus/Jones/Butcher.
 */
import { parseISODate } from "./dates.js";

/** Dimanche de Pâques (grégorien) pour une année donnée → "yyyy-mm-dd". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysISO(date: string, days: number): string {
  const { y, m, d } = parseISODate(date);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Ensemble des jours fériés (France métropole) pour une année. */
export function frenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const fixed = [
    `${year}-01-01`, // Jour de l'an
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ];
  const movable = [
    addDaysISO(easter, 1), // Lundi de Pâques
    addDaysISO(easter, 39), // Ascension
    addDaysISO(easter, 50), // Lundi de Pentecôte
  ];
  return new Set([...fixed, ...movable]);
}

const cache = new Map<number, Set<string>>();

/** Le jour donné est-il férié (France métropole) ? */
export function isFrenchHoliday(date: string): boolean {
  const { y } = parseISODate(date);
  let set = cache.get(y);
  if (!set) {
    set = frenchHolidays(y);
    cache.set(y, set);
  }
  return set.has(date);
}
