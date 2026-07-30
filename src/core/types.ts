/**
 * Modèle de domaine — Pointage BTP.
 *
 * Toutes les entités métier et énumérations. Ce fichier ne contient aucune
 * dépendance technique (ni base de données, ni HTTP) afin de rester purement
 * testable et réutilisable côté serveur comme côté client (PWA).
 */

/** Type de personne pointée sur un chantier. */
export type WorkerType = "EMPLOYE" | "INTERIMAIRE";

/** Nature d'une journée pointée pour une personne. */
export type EntryKind =
  | "TRAVAIL" // heures effectivement travaillées
  | "ABSENCE" // absence (voir AbsenceReason)
  | "INTEMPERIE" // arrêt / heures perdues pour cause météo (chômage-intempéries BTP)
  | "ACCIDENT"; // accident du travail (arrêt)

/** Motif d'absence (impacte le décompte et la paie). */
export type AbsenceReason =
  | "CONGE_PAYE"
  | "RTT"
  | "MALADIE"
  | "FORMATION"
  | "INJUSTIFIEE"
  | "AUTRE";

/** Gravité d'un accident du travail. */
export type AccidentSeverity = "BENIN" | "AVEC_ARRET" | "GRAVE";

/**
 * Catégorie professionnelle BTP (classification conventionnelle).
 * Valeur libre possible, mais ces repères couvrent les cas courants.
 */
export type WorkerCategory =
  | "OUVRIER"
  | "ETAM" // Employé, Technicien, Agent de Maîtrise
  | "CADRE"
  | "APPRENTI";

/** État d'une affectation d'une personne sur un chantier. */
export type AssignmentStatus = "ACTIVE" | "ENDED";

/** État de synchronisation d'un enregistrement (local-first). */
export type SyncState = "LOCAL" | "SYNCED";

export interface Agency {
  id: string;
  name: string;
  contact?: string;
  active: boolean;
}

export interface Chantier {
  id: string;
  code: string; // code chantier interne, unique
  name: string;
  address?: string;
  client?: string;
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string; // ISO yyyy-mm-dd
  active: boolean;
}

export interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  type: WorkerType;
  category?: WorkerCategory | string; // catégorie professionnelle
  trade?: string; // métier : maçon, coffreur, grutier…
  agencyId?: string; // renseigné si INTERIMAIRE
  /** Coût horaire chargé par défaut (€/h) — surchargeable par chantier. */
  hourlyRate?: number;
  active: boolean;
}

/**
 * Grille de coût d'une personne sur un chantier donné.
 * Permet de définir « ce qu'elle coûte » en fonction du chantier : salaire
 * horaire chargé, panier repas (€/jour travaillé), indemnité de déplacement
 * (€/jour travaillé, souvent liée à la zone du chantier).
 * Les champs non renseignés retombent sur les valeurs par défaut de la personne.
 */
export interface CostRate {
  workerId: string;
  chantierId: string;
  hourlyRate?: number; // €/h chargé (sinon Worker.hourlyRate)
  mealAllowance?: number; // panier repas €/jour travaillé
  travelAllowance?: number; // indemnité déplacement €/jour travaillé
}

/**
 * Affectation d'une personne sur un chantier pour une période (typiquement la
 * semaine, décidée le vendredi par le conducteur de travaux / gérant).
 * La date de fin gère les **remplacements en cours de semaine** : on clôt
 * l'affectation d'un intérimaire et on en crée une nouvelle pour son remplaçant.
 */
export interface Assignment {
  id: string;
  workerId: string;
  chantierId: string;
  startDate: string; // ISO yyyy-mm-dd (souvent le lundi)
  endDate?: string; // ISO yyyy-mm-dd inclus ; absent = jusqu'à nouvel ordre
  assignedBy: string; // conducteur de travaux / gérant
  /** Si cette affectation remplace une personne partie en cours de semaine. */
  replacesWorkerId?: string;
  status: AssignmentStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  sync: SyncState;
  deleted?: boolean;
}

/**
 * Un pointage = une ligne « une personne, un chantier, un jour ».
 * Les heures sont exprimées en minutes entières pour éviter les erreurs de
 * virgule flottante ; les helpers de `time.ts` font la conversion h ⇄ min.
 */
export interface TimeEntry {
  id: string;
  workerId: string;
  chantierId: string;
  date: string; // ISO yyyy-mm-dd
  kind: EntryKind;

  /** Minutes travaillées (TRAVAIL) ou indemnisables (INTEMPERIE). */
  minutes: number;

  /** Horaires optionnels si saisis (permettent de recalculer `minutes`). */
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  breakMinutes?: number;

  absenceReason?: AbsenceReason;
  accidentSeverity?: AccidentSeverity;

  /** Commentaire libre (détail intempérie, circonstances accident…). */
  note?: string;

  /** Chef de chantier ayant saisi le pointage. */
  recordedBy: string;

  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  /** Version monotone pour la résolution de conflits lors de la synchro. */
  version: number;
  sync: SyncState;
  deleted?: boolean; // suppression logique (tombstone) pour propager via sync
}

/** Constantes du droit du travail BTP utilisées par la logique métier. */
export const LABOR = {
  /** Durée légale hebdomadaire (heures). */
  WEEKLY_LEGAL_HOURS: 35,
  /** Seuil au-delà duquel la majoration passe à +50 % (heures/semaine). */
  WEEKLY_TIER2_HOURS: 43,
  /** Majoration des heures supplémentaires du 1er palier (36e→43e). */
  OVERTIME_TIER1_RATE: 0.25,
  /** Majoration des heures supplémentaires du 2e palier (au-delà de 43h). */
  OVERTIME_TIER2_RATE: 0.5,
  /** Franchise (carence) d'intempérie : 1re heure non indemnisée par jour. */
  WEATHER_DEDUCTIBLE_MINUTES: 60,
  /** Taux d'indemnisation des heures d'intempérie (BTP ≈ 75 %). */
  WEATHER_INDEMNITY_RATE: 0.75,
  /** Délai légal de déclaration d'un accident du travail (heures). */
  ACCIDENT_DECLARATION_DELAY_HOURS: 48,
} as const;
