import { describe, expect, it } from "vitest";
import { billingStatements, resolveUnitPrices } from "./billing.js";
import type { CostRate, TimeEntry, Worker } from "./types.js";

const workers: Worker[] = [
  { id: "w1", firstName: "Jean", lastName: "Martin", type: "INTERIMAIRE", agencyId: "ag1", trade: "Maçon", category: "OUVRIER", hourlyRate: 20, active: true },
];
const rates: CostRate[] = [
  { workerId: "w1", chantierId: "c1", mealAllowance: 11, travelAllowance: 8 },
];

let seq = 0;
function entry(over: Partial<TimeEntry>): TimeEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    workerId: "w1",
    chantierId: "c1",
    date: "2026-05-18", // semaine 21 (lundi 18 mai 2026)
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

describe("resolveUnitPrices", () => {
  it("dérive les PU depuis le taux de base", () => {
    const pu = resolveUnitPrices("w1", "c1", workers, rates);
    expect(pu.normal).toBe(20);
    expect(pu.ot25).toBe(25);
    expect(pu.ot50).toBe(30);
    expect(pu.holiday).toBe(40);
    expect(pu.weather).toBe(15);
    expect(pu.meal).toBe(11);
    expect(pu.travel).toBe(8);
  });
  it("respecte les PU explicites", () => {
    const pu = resolveUnitPrices("w1", "c1", workers, [
      { workerId: "w1", chantierId: "c1", hourlyRate: 20, overtime25Rate: 26, holidayRate: 45 },
    ]);
    expect(pu.ot25).toBe(26);
    expect(pu.holiday).toBe(45);
  });
});

describe("billingStatements — ventilation hebdomadaire S21", () => {
  it("sépare heures normales, sup et fériées, avec paniers/déplacements", () => {
    // Semaine 21 (lun 18 → dim 24 mai 2026). Lundi de Pentecôte = 25 mai (S22).
    // 5 jours à 8h (lun-ven) = 40h → 35 normal + 5 à +25%. Paniers = 5.
    const days = ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"];
    const data = days.map((d) => entry({ date: d, minutes: 480 }));
    const [st] = billingStatements(data, workers, rates, "2026-05", (w) => w.type === "INTERIMAIRE");
    expect(st!.lines).toHaveLength(1);
    const l = st!.lines[0]!;
    expect(l.weekLabel).toBe("S21");
    expect(l.normalHours).toBe(35);
    expect(l.overtime25Hours).toBe(5);
    expect(l.overtime50Hours).toBe(0);
    expect(l.holidayHours).toBe(0);
    expect(l.mealCount).toBe(5);
    expect(l.travelCount).toBe(5);
    // Montants : 35×20 + 5×25 + 5×11 + 5×8 = 700 + 125 + 55 + 40 = 920
    expect(l.amounts.normal).toBe(700);
    expect(l.amounts.ot25).toBe(125);
    expect(l.amounts.meal).toBe(55);
    expect(l.amounts.travel).toBe(40);
    expect(l.total).toBe(920);
  });

  it("isole les heures fériées (1er mai)", () => {
    // 1er mai 2026 (férié) travaillé 8h → heures fériées, hors normal/sup.
    const data = [entry({ date: "2026-05-01", minutes: 480 })];
    const [st] = billingStatements(data, workers, rates, "2026-05");
    const l = st!.lines[0]!;
    expect(l.holidayHours).toBe(8);
    expect(l.normalHours).toBe(0);
    // 8h × 40 (férié) + 1 panier 11 + 1 dépl 8 = 320 + 19 = 339
    expect(l.amounts.holiday).toBe(320);
    expect(l.total).toBe(339);
  });

  it("une ligne par (chantier × semaine)", () => {
    const data = [
      entry({ chantierId: "c1", date: "2026-05-18", minutes: 480 }),
      entry({ chantierId: "c2", date: "2026-05-18", minutes: 480 }),
      entry({ chantierId: "c1", date: "2026-05-26", minutes: 480 }), // S22
    ];
    const [st] = billingStatements(data, workers, rates, "2026-05");
    expect(st!.lines).toHaveLength(3);
    expect(new Set(st!.lines.map((l) => l.weekLabel))).toEqual(new Set(["S21", "S22"]));
  });
});
