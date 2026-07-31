import { describe, expect, it } from "vitest";
import {
  byAgency,
  byChantier,
  byWorker,
  monthlyDetail,
  totals,
  weeklyByWorker,
} from "./reports.js";
import type { TimeEntry, Worker } from "./types.js";

let seq = 0;
function entry(over: Partial<TimeEntry>): TimeEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    workerId: "w1",
    chantierId: "c1",
    date: "2026-07-30",
    kind: "TRAVAIL",
    minutes: 480,
    recordedBy: "chef1",
    createdAt: "2026-07-30T18:00:00Z",
    updatedAt: "2026-07-30T18:00:00Z",
    version: 1,
    sync: "SYNCED",
    ...over,
  };
}

describe("totals", () => {
  it("agrège toutes les natures", () => {
    const t = totals([
      entry({ kind: "TRAVAIL", minutes: 480 }),
      entry({ kind: "INTEMPERIE", minutes: 120 }),
      entry({ kind: "ABSENCE", minutes: 0, absenceReason: "MALADIE" }),
      entry({ kind: "ACCIDENT", minutes: 60, accidentSeverity: "AVEC_ARRET" }),
    ]);
    expect(t.workedMinutes).toBe(540); // 480 travail + 60 avant accident
    expect(t.weatherMinutes).toBe(120);
    expect(t.absenceDays).toBe(1);
    expect(t.accidentCount).toBe(1);
    expect(t.workedHours).toBe(9);
    expect(t.weatherHours).toBe(2);
  });
  it("ignore les pointages supprimés", () => {
    const t = totals([entry({ minutes: 480 }), entry({ minutes: 480, deleted: true })]);
    expect(t.workedMinutes).toBe(480);
  });
});

describe("regroupements", () => {
  const data = [
    entry({ workerId: "w1", chantierId: "c1", minutes: 480 }),
    entry({ workerId: "w1", chantierId: "c2", minutes: 240 }),
    entry({ workerId: "w2", chantierId: "c1", minutes: 300 }),
  ];
  it("byWorker", () => {
    const g = byWorker(data);
    expect(g.get("w1")!.workedMinutes).toBe(720);
    expect(g.get("w2")!.workedMinutes).toBe(300);
  });
  it("byChantier", () => {
    const g = byChantier(data);
    expect(g.get("c1")!.workedMinutes).toBe(780);
    expect(g.get("c2")!.workedMinutes).toBe(240);
  });
  it("byAgency répartit interim vs interne", () => {
    const workers: Worker[] = [
      { id: "w1", firstName: "A", lastName: "A", type: "INTERIMAIRE", agencyId: "ag1", active: true },
      { id: "w2", firstName: "B", lastName: "B", type: "EMPLOYE", active: true },
    ];
    const g = byAgency(data, workers);
    expect(g.get("ag1")!.workedMinutes).toBe(720);
    expect(g.get("INTERNE")!.workedMinutes).toBe(300);
  });
});

describe("weeklyByWorker — heures sup.", () => {
  it("cumule la semaine et ventile les heures sup.", () => {
    // 5 jours à 8h sur la même semaine = 40h → 5h sup à +25%
    const lundi = "2026-07-27";
    const days = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    const data = days.map((d) => entry({ workerId: "w1", date: d, minutes: 480 }));
    const rep = weeklyByWorker(data);
    expect(rep).toHaveLength(1);
    expect(rep[0]!.weekKey).toBe("2026-W31");
    expect(rep[0]!.totals.workedMinutes).toBe(2400);
    expect(rep[0]!.overtime.paidEquivalentHours).toBe(41.25);
    void lundi;
  });
  it("sépare deux semaines distinctes", () => {
    const data = [
      entry({ workerId: "w1", date: "2026-07-30", minutes: 480 }), // S31
      entry({ workerId: "w1", date: "2026-08-04", minutes: 480 }), // S32
    ];
    const rep = weeklyByWorker(data);
    expect(rep).toHaveLength(2);
  });
});

describe("monthlyDetail", () => {
  it("détaille par mois/personne/chantier", () => {
    const data = [
      entry({ workerId: "w1", chantierId: "c1", date: "2026-07-30", minutes: 480 }),
      entry({ workerId: "w1", chantierId: "c1", date: "2026-07-15", minutes: 240 }),
      entry({ workerId: "w1", chantierId: "c1", date: "2026-08-01", minutes: 120 }),
    ];
    const lines = monthlyDetail(data);
    const july = lines.find((l) => l.monthKey === "2026-07")!;
    expect(july.totals.workedMinutes).toBe(720);
    const aug = lines.find((l) => l.monthKey === "2026-08")!;
    expect(aug.totals.workedMinutes).toBe(120);
  });
});
