import { describe, expect, it } from "vitest";
import {
  costByChantier,
  costByWorker,
  entryCost,
  payrollByWorkerWeek,
  resolveRate,
  totalCost,
} from "./cost.js";
import type { CostRate, TimeEntry, Worker } from "./types.js";

const workers: Worker[] = [
  { id: "w1", firstName: "A", lastName: "A", type: "EMPLOYE", hourlyRate: 20, active: true },
  { id: "w2", firstName: "B", lastName: "B", type: "INTERIMAIRE", agencyId: "ag1", hourlyRate: 18, active: true },
];

const rates: CostRate[] = [
  { workerId: "w1", chantierId: "c1", mealAllowance: 10, travelAllowance: 8 },
  { workerId: "w1", chantierId: "c2", hourlyRate: 22, mealAllowance: 10, travelAllowance: 25 },
  { workerId: "w2", chantierId: "c1", hourlyRate: 19, mealAllowance: 9, travelAllowance: 8 },
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

describe("resolveRate", () => {
  it("surcharge par chantier sinon repli sur la personne", () => {
    expect(resolveRate("w1", "c1", workers, rates).hourlyRate).toBe(20); // repli worker
    expect(resolveRate("w1", "c2", workers, rates).hourlyRate).toBe(22); // surcharge chantier
    expect(resolveRate("w1", "c2", workers, rates).travelAllowance).toBe(25);
  });
  it("valeurs par défaut à 0 si aucune grille", () => {
    const r = resolveRate("w2", "c9", workers, rates);
    expect(r.hourlyRate).toBe(18);
    expect(r.mealAllowance).toBe(0);
  });
});

describe("entryCost", () => {
  it("journée travaillée = main d'œuvre + panier + déplacement", () => {
    const c = entryCost(entry({ minutes: 480 }), resolveRate("w1", "c1", workers, rates));
    expect(c.labor).toBe(160); // 8h × 20
    expect(c.meal).toBe(10);
    expect(c.travel).toBe(8);
    expect(c.total).toBe(178);
  });
  it("absence ne coûte pas d'indemnités", () => {
    const c = entryCost(
      entry({ kind: "ABSENCE", minutes: 0, absenceReason: "MALADIE" }),
      resolveRate("w1", "c1", workers, rates),
    );
    expect(c.total).toBe(0);
  });
  it("intempérie = indemnité 75% après franchise 1h", () => {
    const c = entryCost(
      entry({ kind: "INTEMPERIE", minutes: 240 }),
      resolveRate("w1", "c1", workers, rates),
    );
    // 4h perdues → 3h indemnisables × 20 × 0.75 = 45
    expect(c.weather).toBe(45);
    expect(c.meal).toBe(0); // pas de présence effective
  });
});

describe("agrégations de coût", () => {
  const data = [
    entry({ workerId: "w1", chantierId: "c1", minutes: 480 }),
    entry({ workerId: "w1", chantierId: "c2", minutes: 480 }),
    entry({ workerId: "w2", chantierId: "c1", minutes: 420 }),
  ];
  it("total", () => {
    const t = totalCost(data, workers, rates);
    // w1@c1: 160+10+8=178 ; w1@c2: 8*22+10+25=211 ; w2@c1: 7*19+9+8=150
    expect(t.total).toBe(178 + 211 + 150);
  });
  it("par personne et par chantier", () => {
    expect(costByWorker(data, workers, rates).get("w1")!.total).toBe(178 + 211);
    expect(costByChantier(data, workers, rates).get("c1")!.total).toBe(178 + 150);
  });
});

describe("payrollByWorkerWeek — majoration heures sup.", () => {
  it("40h sur la semaine → 5h à +25% intégrées au coût", () => {
    const days = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    const data = days.map((d) => entry({ workerId: "w1", chantierId: "c1", date: d, minutes: 480 }));
    const [line] = payrollByWorkerWeek(data, workers, rates);
    expect(line!.normalHours).toBe(35);
    expect(line!.overtime25Hours).toBe(5);
    expect(line!.paidEquivalentHours).toBe(41.25);
    expect(line!.laborCost).toBe(41.25 * 20); // 825
    expect(line!.allowances).toBe(5 * (10 + 8)); // 5 jours × (panier+déplacement)
    expect(line!.total).toBe(41.25 * 20 + 90);
  });
});
