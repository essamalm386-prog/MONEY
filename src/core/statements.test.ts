import { describe, expect, it } from "vitest";
import { monthlyStatements, statementsByAgency } from "./statements.js";
import type { CostRate, TimeEntry, Worker } from "./types.js";

const workers: Worker[] = [
  { id: "w1", firstName: "Jean", lastName: "Martin", type: "INTERIMAIRE", agencyId: "ag1", trade: "Maçon", hourlyRate: 20, active: true },
  { id: "w2", firstName: "Luc", lastName: "Dupont", type: "EMPLOYE", trade: "Coffreur", hourlyRate: 21, active: true },
  { id: "w3", firstName: "Emma", lastName: "Leroy", type: "STAGIAIRE", trade: "Stage", hourlyRate: 0, active: true },
];

const costs: CostRate[] = [
  { workerId: "w1", chantierId: "c1", mealAllowance: 10, travelAllowance: 8 },
];

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

describe("monthlyStatements", () => {
  it("détaille les heures par chantier et jours travaillés", () => {
    const data = [
      entry({ workerId: "w1", chantierId: "c1", date: "2026-07-27", minutes: 480 }),
      entry({ workerId: "w1", chantierId: "c1", date: "2026-07-28", minutes: 480 }),
      entry({ workerId: "w1", chantierId: "c2", date: "2026-07-29", minutes: 420 }),
    ];
    const [s] = monthlyStatements(data, workers, costs, "2026-07", (w) => w.type === "INTERIMAIRE");
    expect(s!.worker.id).toBe("w1");
    expect(s!.byChantier).toHaveLength(2);
    const c1 = s!.byChantier.find((l) => l.chantierId === "c1")!;
    expect(c1.workedDays).toBe(2);
    expect(c1.workedMinutes).toBe(960);
    expect(s!.totals.workedDays).toBe(3);
  });

  it("ventile les heures sup. par semaine", () => {
    // 5 jours à 8h en semaine 31 = 40h → 5h à +25%
    const days = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    const data = days.map((d) => entry({ workerId: "w1", date: d, minutes: 480 }));
    const [s] = monthlyStatements(data, workers, costs, "2026-07");
    expect(s!.weeks).toHaveLength(1);
    expect(s!.weeks[0]!.overtime25Hours).toBe(5);
    expect(s!.totals.overtime25Hours).toBe(5);
  });

  it("ne retient que le mois demandé", () => {
    const data = [
      entry({ workerId: "w1", date: "2026-07-30", minutes: 480 }),
      entry({ workerId: "w1", date: "2026-08-03", minutes: 480 }),
    ];
    const [s] = monthlyStatements(data, workers, costs, "2026-07");
    expect(s!.totals.workedHours).toBe(8);
  });

  it("filtre par type (intérim vs interne)", () => {
    const data = [
      entry({ workerId: "w1", minutes: 480 }),
      entry({ workerId: "w2", minutes: 480 }),
      entry({ workerId: "w3", minutes: 480 }),
    ];
    const interim = monthlyStatements(data, workers, costs, "2026-07", (w) => w.type === "INTERIMAIRE");
    expect(interim.map((s) => s.worker.id)).toEqual(["w1"]);
    const internal = monthlyStatements(data, workers, costs, "2026-07", (w) => w.type !== "INTERIMAIRE");
    expect(internal.map((s) => s.worker.id).sort()).toEqual(["w2", "w3"]);
  });

  it("calcule le coût pour comparaison facture", () => {
    const data = [entry({ workerId: "w1", chantierId: "c1", minutes: 480 })];
    const [s] = monthlyStatements(data, workers, costs, "2026-07");
    // 8h×20 + panier 10 + déplacement 8 = 178
    expect(s!.cost.total).toBe(178);
  });
});

describe("statementsByAgency", () => {
  it("regroupe par agence", () => {
    const data = [entry({ workerId: "w1", minutes: 480 })];
    const statements = monthlyStatements(data, workers, costs, "2026-07", (w) => w.type === "INTERIMAIRE");
    const grouped = statementsByAgency(statements);
    expect(grouped.has("ag1")).toBe(true);
    expect(grouped.get("ag1")!).toHaveLength(1);
  });
});
