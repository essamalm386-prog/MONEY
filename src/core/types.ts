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
  trade?: string; // métier : maçon, coffreur, grutier…
  agencyId?: string; // renseigné si INTERIMAIRE
  hourlyRate?: number; // € / h, optionnel
  active: boolean;
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
