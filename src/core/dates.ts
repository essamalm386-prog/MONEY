/**
 * Utilitaires de dates — purs, sans dépendance, travaillant sur des chaînes
 * ISO "yyyy-mm-dd" pour rester déterministes quel que soit le fuseau.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valide et décompose une date ISO. Lève si invalide. */
export function parseISODate(date: string): { y: number; m: number; d: number } {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`date ISO invalide: ${date}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new RangeError(`date inexistante: ${date}`);
  }
  return { y, m: mo, d };
}

export function isValidISODate(date: string): boolean {
  try {
    parseISODate(date);
    return true;
  } catch {
    return false;
  }
}

function toUTC(date: string): Date {
  const { y, m, d } = parseISODate(date);
  return new Date(Date.UTC(y, m - 1, d));
}

/** yyyy-mm-dd depuis un Date UTC. */
function fromUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: string): number {
  const wd = toUTC(date).getUTCDay(); // 0 = dimanche
  return wd === 0 ? 7 : wd;
}

/** true si samedi ou dimanche. */
export function isWeekend(date: string): boolean {
  return isoWeekday(date) >= 6;
}

/** Lundi de la semaine contenant `date` (ISO). */
export function startOfISOWeek(date: string): string {
  const dt = toUTC(date);
  const delta = isoWeekday(date) - 1;
  dt.setUTCDate(dt.getUTCDate() - delta);
  return fromUTC(dt);
}

/** Numéro de semaine ISO + année ISO (ex. { year: 2026, week: 5 }). */
export function isoWeek(date: string): { year: number; week: number } {
  const dt = toUTC(date);
  // Algorithme ISO-8601 : jeudi de la semaine détermine l'année.
  const day = isoWeekday(date);
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: dt.getUTCFullYear(), week };
}

/** Clé de semaine triable "YYYY-Www" (ex. "2026-W05"). */
export function isoWeekKey(date: string): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Clé de mois "YYYY-MM". */
export function monthKey(date: string): string {
  const { y, m } = parseISODate(date);
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Ajoute (ou retire) un nombre de jours à une date ISO. */
export function addDays(date: string, days: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTC(dt);
}

/** Liste inclusive des dates entre `from` et `to`. */
export function eachDay(from: string, to: string): string[] {
  if (toUTC(from) > toUTC(to)) return [];
  const out: string[] = [];
  let cur = from;
  // garde-fou : borne large pour éviter toute boucle infinie
  for (let i = 0; i < 100000 && toUTC(cur) <= toUTC(to); i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Différence en heures entre deux datetimes ISO. */
export function hoursBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError("datetime invalide");
  return (b - a) / 3600000;
}
