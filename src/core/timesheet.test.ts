import { describe, expect, it } from "vitest";
import { workerTimesheet, workerTimesheets } from "./timesheet.js";
import type { TimeEntry, Worker } from "./types.js";

const dupont: Worker = {
  id: "w1", firstName: "Luc", lastName: "Dupont", type: "EMPLOYE",
  category: "OUVRIER", trade: "Coffreur", hourlyRate: 21, active: true,
};
const silva: Worker = {
  id: "w2", firstName: "João", lastName: "Silva", type: "INTERIMAIRE",
  agencyId: "ag1", trade: "Maçon", hourlyRate: 20, active: true,
};

let seq = 0;
function entry(over: Partial<TimeEntry>): TimeEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    workerId: "w1",
    chantierId: "c1",
    date: "2026-07-27",
    kind: "TRAVAIL",
    minutes: 480,
    recordedBy: "chef",
    createdAt: "x",
    updatedAt: "x",
    version: 1,
    sync: "SYNCED",
    ...over,
  };
}

describe("workerTimesheet — relevé individuel", () => {
  it("détaille les journées avec heure d'arrivée et heure d'arrêt", () => {
    const data = [
      entry({ date: "2026-07-27", startTime: "07:30", endTime: "16:30", breakMinutes: 60, minutes: 480 }),
      entry({ date: "2026-07-28", startTime: "08:00", endTime: "17:00", breakMinutes: 60, minutes: 480 }),
    ];
    const ts = workerTimesheet(data, dupont, "2026-07-27", "2026-07-31");
    expect(ts.days).toHaveLength(2);
    expect(ts.days[0]!.startTime).toBe("07:30");
    expect(ts.days[0]!.endTime).toBe("16:30");
    expect(ts.days[0]!.breakMinutes).toBe(60);
    expect(ts.totals.workedHours).toBe(16);
    expect(ts.totals.workedDays).toBe(2);
  });

  it("accepte aussi les journées saisies en total d'heures (sans horaires)", () => {
    const data = [entry({ date: "2026-07-27", minutes: 450, startTime: undefined, endTime: undefined })];
    const ts = workerTimesheet(data, dupont, "2026-07-27", "2026-07-31");
    expect(ts.days[0]!.startTime).toBeUndefined();
    expect(ts.totals.workedHours).toBe(7.5);
  });

  it("borne strictement la période demandée", () => {
    const data = [
      entry({ date: "2026-07-26", minutes: 480 }),
      entry({ date: "2026-07-28", minutes: 480 }),
      entry({ date: "2026-08-01", minutes: 480 }),
    ];
    const ts = workerTimesheet(data, dupont, "2026-07-27", "2026-07-31");
    expect(ts.days).toHaveLength(1);
    expect(ts.days[0]!.date).toBe("2026-07-28");
  });

  it("ventile les heures sup. par semaine et compte absences/intempéries/accidents", () => {
    const days = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    const data = [
      ...days.map((d) => entry({ date: d, minutes: 480 })),
      entry({ date: "2026-08-03", kind: "ABSENCE", minutes: 0, absenceReason: "MALADIE" }),
      entry({ date: "2026-08-04", kind: "INTEMPERIE", minutes: 240 }),
      entry({ date: "2026-08-05", kind: "ACCIDENT", minutes: 120, accidentSeverity: "AVEC_ARRET" }),
    ];
    const ts = workerTimesheet(data, dupont, "2026-07-27", "2026-08-09");
    const s31 = ts.weeks.find((w) => w.weekLabel === "S31")!;
    expect(s31.workedHours).toBe(40);
    expect(s31.overtime25Hours).toBe(5);
    expect(ts.totals.absenceDays).toBe(1);
    expect(ts.totals.weatherMinutes).toBe(240);
    expect(ts.totals.accidentCount).toBe(1);
    // 40 h + 2 h avant l'accident
    expect(ts.totals.workedHours).toBe(42);
  });

  it("repère les heures travaillées un jour férié", () => {
    const data = [entry({ date: "2026-07-14", minutes: 450 })];
    const ts = workerTimesheet(data, dupont, "2026-07-01", "2026-07-31");
    expect(ts.days[0]!.holiday).toBe(true);
    expect(ts.totals.holidayMinutes).toBe(450);
  });
});

describe("workerTimesheets — plusieurs personnes", () => {
  it("écarte les personnes sans pointage et trie par nom", () => {
    const data = [
      entry({ workerId: "w2", date: "2026-07-27", minutes: 480 }),
      entry({ workerId: "w1", date: "2026-07-27", minutes: 480 }),
    ];
    const sheets = workerTimesheets(data, [silva, dupont], "2026-07-27", "2026-07-31");
    expect(sheets.map((s) => s.worker.id)).toEqual(["w1", "w2"]); // Dupont avant Silva
  });
  it("filtre sur une personne précise", () => {
    const data = [
      entry({ workerId: "w1", date: "2026-07-27", minutes: 480 }),
      entry({ workerId: "w2", date: "2026-07-27", minutes: 480 }),
    ];
    const sheets = workerTimesheets(data, [dupont, silva], "2026-07-27", "2026-07-31", (w) => w.id === "w2");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.worker.id).toBe("w2");
  });
});
