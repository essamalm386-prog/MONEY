/**
 * Relevé d'heures individuel — pur.
 *
 * Pour une personne et une période libre (du … au …), détaille **jour par
 * jour** : chantier, heure d'arrivée, heure d'arrêt, pause, heures effectuées,
 * et nature (travail / absence / intempérie / accident). Fournit les totaux de
 * la période et la ventilation hebdomadaire des heures supplémentaires.
 *
 * C'est le justificatif remis au salarié ou joint à la paie.
 */
import { isoWeekKey } from "./dates.js";
import { isFrenchHoliday } from "./holidays.js";
import { activeEntries } from "./reports.js";
import { minutesToHours, weeklyOvertime } from "./time.js";
import type { EntryKind, TimeEntry, Worker } from "./types.js";

export interface TimesheetDay {
  date: string;
  chantierId: string;
  kind: EntryKind;
  /** Heure d'arrivée si saisie (sinon total d'heures direct). */
  startTime?: string;
  /** Heure d'arrêt si saisie. */
  endTime?: string;
  breakMinutes?: number;
  minutes: number;
  holiday: boolean;
  absenceReason?: string;
  accidentSeverity?: string;
  note?: string;
}

export interface TimesheetWeek {
  weekKey: string;
  weekLabel: string; // "S31"
  workedHours: number;
  normalHours: number;
  overtime25Hours: number;
  overtime50Hours: number;
}

export interface TimesheetTotals {
  workedMinutes: number;
  workedHours: number;
  workedDays: number;
  weatherMinutes: number;
  holidayMinutes: number;
  absenceDays: number;
  accidentCount: number;
  normalHours: number;
  overtime25Hours: number;
  overtime50Hours: number;
}

export interface Timesheet {
  worker: Worker;
  from: string;
  to: string;
  days: TimesheetDay[];
  weeks: TimesheetWeek[];
  totals: TimesheetTotals;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Relevé individuel d'une personne sur une période (bornes incluses). */
export function workerTimesheet(
  entries: TimeEntry[],
  worker: Worker,
  from: string,
  to: string,
): Timesheet {
  const list = activeEntries(entries)
    .filter((e) => e.workerId === worker.id && e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.chantierId.localeCompare(b.chantierId));

  const days: TimesheetDay[] = list.map((e) => ({
    date: e.date,
    chantierId: e.chantierId,
    kind: e.kind,
    startTime: e.startTime,
    endTime: e.endTime,
    breakMinutes: e.breakMinutes,
    minutes: e.minutes,
    holiday: isFrenchHoliday(e.date),
    absenceReason: e.absenceReason,
    accidentSeverity: e.accidentSeverity,
    note: e.note,
  }));

  // Ventilation hebdomadaire des heures supplémentaires.
  const perWeek = new Map<string, number>();
  const presentDays = new Set<string>();
  let workedMinutes = 0;
  let weatherMinutes = 0;
  let holidayMinutes = 0;
  let absenceDays = 0;
  let accidentCount = 0;

  for (const e of list) {
    if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
      workedMinutes += e.minutes;
      if (e.minutes > 0) presentDays.add(e.date);
      if (isFrenchHoliday(e.date)) holidayMinutes += e.minutes;
      const wk = isoWeekKey(e.date);
      perWeek.set(wk, (perWeek.get(wk) ?? 0) + e.minutes);
    }
    if (e.kind === "INTEMPERIE") weatherMinutes += e.minutes;
    if (e.kind === "ABSENCE") absenceDays += 1;
    if (e.kind === "ACCIDENT") accidentCount += 1;
  }

  const weeks: TimesheetWeek[] = [...perWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, mins]) => {
      const ot = weeklyOvertime(mins);
      return {
        weekKey,
        weekLabel: `S${weekKey.slice(-2)}`,
        workedHours: minutesToHours(mins),
        normalHours: minutesToHours(ot.normalMinutes),
        overtime25Hours: minutesToHours(ot.tier1Minutes),
        overtime50Hours: minutesToHours(ot.tier2Minutes),
      };
    });

  return {
    worker,
    from,
    to,
    days,
    weeks,
    totals: {
      workedMinutes,
      workedHours: minutesToHours(workedMinutes),
      workedDays: presentDays.size,
      weatherMinutes,
      holidayMinutes,
      absenceDays,
      accidentCount,
      normalHours: round2(weeks.reduce((s, w) => s + w.normalHours, 0)),
      overtime25Hours: round2(weeks.reduce((s, w) => s + w.overtime25Hours, 0)),
      overtime50Hours: round2(weeks.reduce((s, w) => s + w.overtime50Hours, 0)),
    },
  };
}

/** Relevés individuels de plusieurs personnes (une par page à l'impression). */
export function workerTimesheets(
  entries: TimeEntry[],
  workers: Worker[],
  from: string,
  to: string,
  filter: (w: Worker) => boolean = () => true,
): Timesheet[] {
  return workers
    .filter(filter)
    .map((w) => workerTimesheet(entries, w, from, to))
    .filter((t) => t.days.length > 0)
    .sort(
      (a, b) =>
        a.worker.lastName.localeCompare(b.worker.lastName) ||
        a.worker.firstName.localeCompare(b.worker.firstName),
    );
}
