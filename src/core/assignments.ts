/**
 * Affectations des équipes sur les chantiers — logique pure.
 *
 * Le conducteur de travaux (ou le gérant) affecte chaque semaine les personnes
 * aux chantiers. Les chefs de chantier ne pointent que le personnel qui leur a
 * été affecté. Le modèle gère les **remplacements en cours de semaine** en
 * clôturant l'affectation partante et en ouvrant celle du remplaçant.
 */
import { addDays, parseISODate, startOfISOWeek } from "./dates.js";
import type { Assignment } from "./types.js";

/** Une affectation couvre-t-elle la date donnée ? (bornes incluses) */
export function coversDate(a: Assignment, date: string): boolean {
  if (a.deleted) return false;
  if (date < a.startDate) return false;
  if (a.endDate && date > a.endDate) return false;
  return true;
}

/**
 * Affectations couvrant `date` sur un chantier donné. Le statut ENDED n'exclut
 * pas : une affectation clôturée en cours de semaine reste valable pour les
 * jours qu'elle a effectivement couverts (c'est `endDate` qui borne la période).
 */
export function assignmentsForDate(
  assignments: Assignment[],
  chantierId: string,
  date: string,
): Assignment[] {
  parseISODate(date); // valide la date
  return assignments.filter((a) => a.chantierId === chantierId && coversDate(a, date));
}

/** Identifiants des personnes affectées à un chantier à une date. */
export function assignedWorkerIds(
  assignments: Assignment[],
  chantierId: string,
  date: string,
): string[] {
  return [...new Set(assignmentsForDate(assignments, chantierId, date).map((a) => a.workerId))];
}

/** Construit une affectation couvrant la semaine (lundi→dimanche) de `anyDate`. */
export function buildWeekAssignment(
  input: {
    workerId: string;
    chantierId: string;
    anyDate: string; // n'importe quel jour de la semaine visée
    assignedBy: string;
    replacesWorkerId?: string;
    isChef?: boolean;
    note?: string;
  },
  ctx: { id: string; now: string },
): Assignment {
  const monday = startOfISOWeek(input.anyDate);
  const sunday = addDays(monday, 6);
  return {
    id: ctx.id,
    workerId: input.workerId,
    chantierId: input.chantierId,
    startDate: monday,
    endDate: sunday,
    assignedBy: input.assignedBy,
    replacesWorkerId: input.replacesWorkerId,
    isChef: input.isChef ?? false,
    status: "ACTIVE",
    note: input.note,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    version: 1,
    sync: "LOCAL",
  };
}

/**
 * Clôt une affectation la veille de `replacementDate` (dernier jour travaillé =
 * jour précédent). Utilisé lors d'un remplacement en cours de semaine.
 */
export function endAssignment(a: Assignment, replacementDate: string, now: string): Assignment {
  const lastDay = addDays(replacementDate, -1);
  const endDate = lastDay < a.startDate ? a.startDate : lastDay;
  return {
    ...a,
    endDate,
    status: "ENDED",
    updatedAt: now,
    version: a.version + 1,
    sync: "LOCAL",
  };
}

/**
 * Remplace une personne en cours de semaine : clôt l'affectation d'origine à la
 * veille de `fromDate` et crée l'affectation du remplaçant de `fromDate` jusqu'à
 * la fin de la période initiale.
 */
export function replaceWorker(
  original: Assignment,
  newWorkerId: string,
  fromDate: string,
  ctx: { id: string; now: string; assignedBy: string; note?: string },
): { ended: Assignment; replacement: Assignment } {
  const ended = endAssignment(original, fromDate, ctx.now);
  const replacement: Assignment = {
    id: ctx.id,
    workerId: newWorkerId,
    chantierId: original.chantierId,
    startDate: fromDate,
    endDate: original.endDate,
    assignedBy: ctx.assignedBy,
    replacesWorkerId: original.workerId,
    // Si la personne remplacée encadrait l'équipe, son remplaçant reprend ce rôle.
    isChef: original.isChef ?? false,
    status: "ACTIVE",
    note: ctx.note,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    version: 1,
    sync: "LOCAL",
  };
  return { ended, replacement };
}

/**
 * Détecte un chevauchement de deux affectations ACTIVES de la même personne sur
 * le même chantier (garde-fou contre les doubles saisies).
 */
export function overlaps(a: Assignment, b: Assignment): boolean {
  if (a.workerId !== b.workerId || a.chantierId !== b.chantierId) return false;
  if (a.status !== "ACTIVE" || b.status !== "ACTIVE") return false;
  if (a.deleted || b.deleted) return false;
  const aEnd = a.endDate ?? "9999-12-31";
  const bEnd = b.endDate ?? "9999-12-31";
  return a.startDate <= bEnd && b.startDate <= aEnd;
}

/** Deux périodes [aStart, aEnd] et [bStart, bEnd] se chevauchent-elles ? */
function periodsOverlap(
  aStart: string,
  aEnd: string | undefined,
  bStart: string,
  bEnd: string | undefined,
): boolean {
  return aStart <= (bEnd ?? "9999-12-31") && bStart <= (aEnd ?? "9999-12-31");
}

/**
 * Une personne ne peut pas être sur deux chantiers différents les mêmes jours.
 * Renvoie l'affectation en conflit (sur un **autre** chantier) si elle existe.
 * `excludeId` permet d'ignorer l'affectation en cours de modification.
 */
export function findConflict(
  assignments: Assignment[],
  workerId: string,
  chantierId: string,
  startDate: string,
  endDate: string | undefined,
  excludeId?: string,
): Assignment | undefined {
  return assignments.find(
    (a) =>
      !a.deleted &&
      a.id !== excludeId &&
      a.workerId === workerId &&
      a.chantierId !== chantierId &&
      periodsOverlap(startDate, endDate, a.startDate, a.endDate),
  );
}

/**
 * Chef de chantier désigné pour un chantier à une date donnée (le membre de
 * l'équipe qui encadre). Renvoie l'affectation correspondante.
 */
export function chefAssignment(
  assignments: Assignment[],
  chantierId: string,
  date: string,
): Assignment | undefined {
  return assignmentsForDate(assignments, chantierId, date).find((a) => a.isChef);
}
