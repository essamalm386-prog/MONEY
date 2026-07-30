/**
 * Règles métier de validation des pointages.
 *
 * Fonctions pures : elles reçoivent une saisie et renvoient soit un pointage
 * normalisé, soit la liste des erreurs. Aucune I/O.
 */
import { isValidISODate } from "./dates.js";
import { workedMinutes } from "./time.js";
import type {
  AbsenceReason,
  AccidentSeverity,
  EntryKind,
  TimeEntry,
} from "./types.js";

export interface TimeEntryInput {
  workerId: string;
  chantierId: string;
  date: string;
  kind: EntryKind;
  minutes?: number;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  absenceReason?: AbsenceReason;
  accidentSeverity?: AccidentSeverity;
  note?: string;
  recordedBy: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Minutes résolues (depuis start/end ou depuis `minutes`). */
  minutes: number;
}

const MAX_DAILY_MINUTES = 13 * 60; // amplitude max raisonnable sur une journée

/**
 * Valide une saisie et résout le nombre de minutes.
 * - TRAVAIL/INTEMPERIE : minutes > 0 (calculées depuis start/end si fournis).
 * - ABSENCE : motif obligatoire, minutes ignorées (mises à 0).
 * - ACCIDENT : gravité obligatoire ; minutes = heures travaillées avant l'arrêt.
 */
export function validateTimeEntry(input: TimeEntryInput): ValidationResult {
  const errors: string[] = [];

  if (!input.workerId) errors.push("workerId requis");
  if (!input.chantierId) errors.push("chantierId requis");
  if (!input.recordedBy) errors.push("recordedBy (chef de chantier) requis");
  if (!isValidISODate(input.date)) errors.push(`date invalide: ${input.date}`);

  let minutes = 0;

  // Résolution des minutes à partir des horaires si disponibles.
  const hasSlot = Boolean(input.startTime && input.endTime);
  if (hasSlot) {
    try {
      minutes = workedMinutes(input.startTime!, input.endTime!, input.breakMinutes ?? 0);
    } catch (e) {
      errors.push((e as Error).message);
    }
  } else if (typeof input.minutes === "number") {
    minutes = input.minutes;
  }

  if (!Number.isFinite(minutes) || minutes < 0) {
    errors.push("minutes doit être un entier positif");
    minutes = 0;
  }
  if (minutes > MAX_DAILY_MINUTES) {
    errors.push(`durée journalière irréaliste (> ${MAX_DAILY_MINUTES / 60} h)`);
  }

  switch (input.kind) {
    case "TRAVAIL":
      if (minutes <= 0) errors.push("un pointage TRAVAIL doit avoir des minutes > 0");
      break;
    case "INTEMPERIE":
      if (minutes <= 0) errors.push("préciser les heures perdues pour intempérie");
      break;
    case "ABSENCE":
      if (!input.absenceReason) errors.push("motif d'absence requis");
      minutes = 0; // une absence ne compte pas d'heures travaillées
      break;
    case "ACCIDENT":
      if (!input.accidentSeverity) errors.push("gravité de l'accident requise");
      // minutes = heures effectivement travaillées avant l'accident (≥ 0)
      break;
    default:
      errors.push(`nature de pointage inconnue: ${String(input.kind)}`);
  }

  return { ok: errors.length === 0, errors, minutes };
}

/**
 * Construit un TimeEntry normalisé à partir d'une saisie valide.
 * `now` et `id` sont injectés pour rester déterministe/testable.
 */
export function buildTimeEntry(
  input: TimeEntryInput,
  ctx: { id: string; now: string; version?: number },
): TimeEntry {
  const res = validateTimeEntry(input);
  if (!res.ok) {
    throw new Error(`pointage invalide: ${res.errors.join("; ")}`);
  }
  return {
    id: ctx.id,
    workerId: input.workerId,
    chantierId: input.chantierId,
    date: input.date,
    kind: input.kind,
    minutes: res.minutes,
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    absenceReason: input.absenceReason,
    accidentSeverity: input.accidentSeverity,
    note: input.note?.trim() || undefined,
    recordedBy: input.recordedBy,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    version: ctx.version ?? 1,
    sync: "LOCAL",
  };
}

/**
 * Détecte les doublons : une même personne ne peut avoir deux pointages du
 * même chantier le même jour avec la même nature (hors tombstones).
 */
export function isDuplicate(a: TimeEntry, b: TimeEntry): boolean {
  return (
    !a.deleted &&
    !b.deleted &&
    a.id !== b.id &&
    a.workerId === b.workerId &&
    a.chantierId === b.chantierId &&
    a.date === b.date &&
    a.kind === b.kind
  );
}

/**
 * Une déclaration d'accident est-elle dans les délais légaux (48 h) ?
 * `declaredAtISO` = moment de la déclaration ; `entryDate` = jour de l'accident.
 */
export function accidentDeclaredInTime(entryDate: string, declaredAtISO: string): boolean {
  const accident = new Date(`${entryDate}T00:00:00Z`).getTime();
  const declared = new Date(declaredAtISO).getTime();
  if (Number.isNaN(accident) || Number.isNaN(declared)) return false;
  const hours = (declared - accident) / 3600000;
  return hours >= 0 && hours <= 48 + 24; // tolérance : minuit + 48h ⇒ borne à 72h
}
