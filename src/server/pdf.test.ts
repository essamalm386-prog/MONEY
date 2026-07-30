import { describe, expect, it } from "vitest";
import { monthlyStatements } from "../core/index.js";
import type { Agency, Chantier, CostRate, TimeEntry, Worker } from "../core/index.js";
import { interimMonthlyPdf, salariedMonthlyPdf } from "./pdf.js";

const chantiers: Chantier[] = [
  { id: "c1", code: "C1", name: "Chantier Un", active: true },
];
const agencies: Agency[] = [{ id: "ag1", name: "ETT Démo", active: true }];
const workers: Worker[] = [
  { id: "w1", firstName: "Jean", lastName: "Martin", type: "INTERIMAIRE", agencyId: "ag1", trade: "Maçon", hourlyRate: 20, active: true },
  { id: "w2", firstName: "Luc", lastName: "Dupont", type: "EMPLOYE", trade: "Coffreur", hourlyRate: 21, active: true },
  { id: "w3", firstName: "Emma", lastName: "Leroy", type: "STAGIAIRE", trade: "Stage", hourlyRate: 0, active: true },
];
const costs: CostRate[] = [{ workerId: "w1", chantierId: "c1", mealAllowance: 10, travelAllowance: 8 }];

function entry(over: Partial<TimeEntry> & { id: string }): TimeEntry {
  return {
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

const data: TimeEntry[] = [
  entry({ id: "e1", workerId: "w1", date: "2026-07-27", minutes: 480 }),
  entry({ id: "e2", workerId: "w1", date: "2026-07-28", minutes: 540 }),
  entry({ id: "e3", workerId: "w2", date: "2026-07-27", minutes: 480 }),
  entry({ id: "e4", workerId: "w3", date: "2026-07-27", minutes: 420 }),
];

function isPdf(buf: Buffer): boolean {
  return buf.length > 800 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

describe("PDF relevé intérim", () => {
  it("génère un PDF non trivial pour l'agence", async () => {
    const statements = monthlyStatements(data, workers, costs, "2026-07", (w) => w.type === "INTERIMAIRE");
    const pdf = await interimMonthlyPdf(statements, chantiers, agencies, "2026-07");
    expect(isPdf(pdf)).toBe(true);
  });
  it("génère un PDF même sans intérimaire (message vide)", async () => {
    const pdf = await interimMonthlyPdf([], chantiers, agencies, "2026-07");
    expect(isPdf(pdf)).toBe(true);
  });
});

describe("PDF relevé salariés", () => {
  it("inclut salariés, stagiaires et alternants", async () => {
    const statements = monthlyStatements(data, workers, costs, "2026-07", (w) => w.type !== "INTERIMAIRE");
    expect(statements.map((s) => s.worker.id).sort()).toEqual(["w2", "w3"]);
    const pdf = await salariedMonthlyPdf(statements, chantiers, "2026-07");
    expect(isPdf(pdf)).toBe(true);
  });
});
