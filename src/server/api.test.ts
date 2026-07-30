import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { Repository } from "./repository.js";
import { createApp } from "./api.js";
import { seed } from "./seed.js";

let server: Server;
let base: string;
let repo: Repository;

beforeAll(async () => {
  const db = openDb(":memory:");
  repo = new Repository(db);
  seed(repo);
  const app = createApp(repo);
  await new Promise<void>((r) => {
    server = app.listen(0, () => r());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
});

const get = (p: string): Promise<any> => fetch(base + p).then((r) => r.json());
const post = (p: string, body: unknown) =>
  fetch(base + p, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("API référentiels", () => {
  it("liste chantiers et personnes issus du seed", async () => {
    expect((await get("/api/chantiers")).length).toBe(2);
    expect((await get("/api/workers")).length).toBe(8);
    expect((await get("/api/agencies")).length).toBe(1);
  });
  it("health", async () => {
    expect((await get("/api/health")).ok).toBe(true);
  });
});

describe("API pointages", () => {
  it("crée un pointage TRAVAIL valide", async () => {
    const res = await post("/api/entries", {
      workerId: "wk_dupont",
      chantierId: "ch_lyon",
      date: "2026-08-03",
      kind: "TRAVAIL",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      recordedBy: "wk_martin",
    });
    expect(res.status).toBe(201);
    const e = (await res.json()) as any;
    expect(e.minutes).toBe(480);
    expect(e.sync).toBe("SYNCED");
  });

  it("refuse un pointage invalide (400)", async () => {
    const res = await post("/api/entries", {
      workerId: "wk_dupont",
      chantierId: "ch_lyon",
      date: "2026-08-03",
      kind: "ACCIDENT",
      minutes: 120,
      recordedBy: "wk_martin",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toMatch(/gravité/);
  });

  it("empêche le doublon naturel via contrainte unique", async () => {
    const body = {
      workerId: "wk_silva",
      chantierId: "ch_lyon",
      date: "2026-09-01",
      kind: "TRAVAIL",
      minutes: 480,
      recordedBy: "wk_martin",
    };
    expect((await post("/api/entries", body)).status).toBe(201);
    // Deuxième insertion identique → l'INSERT viole l'index unique
    const second = await post("/api/entries", body);
    expect(second.status).toBe(400);
  });
});

describe("API rapports", () => {
  it("agrège la période du seed", async () => {
    const rep = await get("/api/reports/summary?from=2026-07-27&to=2026-07-31");
    expect(rep.totals.workedMinutes).toBeGreaterThan(0);
    expect(rep.totals.accidentCount).toBe(1);
    expect(rep.totals.absenceDays).toBe(1);
    expect(Object.keys(rep.byChantier).length).toBe(2);
    expect(rep.weeklyByWorker.length).toBeGreaterThan(0);
  });
});

describe("API affectations & remplacement", () => {
  it("roster : liste les personnes affectées à un chantier un jour donné", async () => {
    const roster = await get("/api/roster?chantierId=ch_lyon&date=2026-07-30");
    const ids = roster.map((w: { id: string }) => w.id).sort();
    expect(ids).toContain("wk_dupont");
    expect(ids).toContain("wk_silva");
  });

  it("remplacement en cours de semaine bascule le roster", async () => {
    // Avant remplacement, Koffi est sur Villeurbanne le 29.
    const before = await get("/api/roster?chantierId=ch_villeurb&date=2026-07-29");
    expect(before.map((w: { id: string }) => w.id)).toContain("wk_koffi");
    // À partir du 30, c'est Petit (remplaçant) — posé par le seed.
    const after = await get("/api/roster?chantierId=ch_villeurb&date=2026-07-30");
    const ids = after.map((w: { id: string }) => w.id);
    expect(ids).toContain("wk_petit");
    expect(ids).not.toContain("wk_koffi");
  });

  it("crée une affectation hebdomadaire (lundi→dimanche)", async () => {
    const res = await post("/api/assignments", {
      workerId: "wk_dupont",
      chantierId: "ch_villeurb",
      anyDate: "2026-08-05",
      assignedBy: "conducteur1",
    });
    expect(res.status).toBe(201);
    const a = (await res.json()) as any;
    expect(a.startDate).toBe("2026-08-03");
    expect(a.endDate).toBe("2026-08-09");
  });
});

describe("API coûts", () => {
  it("le rapport inclut les coûts et la paie hebdomadaire", async () => {
    const rep = await get("/api/reports/summary?from=2026-07-27&to=2026-07-31");
    expect(rep.cost).toBeDefined();
    expect(rep.cost.total.total).toBeGreaterThan(0);
    expect(rep.cost.total.meal).toBeGreaterThan(0);
    expect(rep.cost.total.travel).toBeGreaterThan(0);
    expect(Array.isArray(rep.payroll)).toBe(true);
    // Une ligne de paie doit exposer les heures sup.
    const withOt = rep.payroll.find((l: any) => l.overtime25Hours > 0 || l.paidEquivalentHours > 0);
    expect(withOt).toBeDefined();
  });

  it("crée une grille de coût pour une personne sur un chantier", async () => {
    const res = await post("/api/costs", {
      workerId: "wk_silva",
      chantierId: "ch_villeurb",
      hourlyRate: 21,
      mealAllowance: 11,
      travelAllowance: 18,
    });
    expect(res.status).toBe(201);
    const costs = await get("/api/costs");
    expect(costs.some((c: any) => c.workerId === "wk_silva" && c.chantierId === "ch_villeurb")).toBe(true);
  });
});

describe("API exports PDF", () => {
  async function fetchPdf(path: string) {
    const res = await fetch(base + path);
    const buf = Buffer.from(await res.arrayBuffer());
    return { res, buf };
  }
  it("relevé intérim mensuel = PDF", async () => {
    const { res, buf } = await fetchPdf("/api/reports/interim.pdf?month=2026-07");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(800);
  });
  it("relevé salariés mensuel = PDF", async () => {
    const { res, buf } = await fetchPdf("/api/reports/salaried.pdf?month=2026-07");
    expect(res.status).toBe(200);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
  it("month manquant → 400", async () => {
    const res = await fetch(base + "/api/reports/interim.pdf");
    expect(res.status).toBe(400);
  });
});

describe("API synchronisation", () => {
  it("push puis pull renvoie les enregistrements récents", async () => {
    const entry = {
      id: "sync_test_1",
      workerId: "wk_koffi",
      chantierId: "ch_villeurb",
      date: "2026-08-10",
      kind: "TRAVAIL",
      minutes: 420,
      recordedBy: "wk_martin",
      createdAt: "2026-08-10T18:00:00.000Z",
      updatedAt: "2026-08-10T18:00:00.000Z",
      version: 1,
      sync: "LOCAL",
    };
    const pushRes = await post("/api/sync/push", { entries: [entry] });
    const pushed = (await pushRes.json()) as any;
    expect(pushed.applied).toContain("sync_test_1");

    const pull: any = await get("/api/sync/pull?since=2026-08-10T00:00:00.000Z");
    expect(pull.entries.some((e: { id: string }) => e.id === "sync_test_1")).toBe(true);
  });

  it("un push plus ancien est refusé comme conflit", async () => {
    const stale = {
      id: "sync_test_1",
      workerId: "wk_koffi",
      chantierId: "ch_villeurb",
      date: "2026-08-10",
      kind: "TRAVAIL",
      minutes: 999,
      recordedBy: "wk_martin",
      createdAt: "2026-08-10T18:00:00.000Z",
      updatedAt: "2026-08-09T18:00:00.000Z",
      version: 1,
      sync: "LOCAL",
    };
    const res = (await (await post("/api/sync/push", { entries: [stale] })).json()) as any;
    expect(res.conflicts).toContain("sync_test_1");
  });
});
