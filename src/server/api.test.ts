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
let adminToken: string;
let chefToken: string;

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

  // Sessions de test : admin (tous droits) et chef (droits restreints).
  const login = async (username: string, password: string) => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return ((await r.json()) as any).token as string;
  };
  adminToken = await login("admin", "admin");
  chefToken = await login("chef", "chef");
});

afterAll(() => {
  server.close();
});

const get = (p: string, token?: string): Promise<any> =>
  fetch(base + p, { headers: { authorization: `Bearer ${token ?? adminToken}` } }).then((r) => r.json());
const post = (p: string, body: unknown, token?: string) =>
  fetch(base + p, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token ?? adminToken}` },
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
    // wk_nguyen n'est rattaché à aucun compte : n'altère pas le périmètre
    // du chef testé plus bas (wk_dupont, affecté au seul chantier de Lyon).
    const res = await post("/api/assignments", {
      workerId: "wk_nguyen",
      chantierId: "ch_villeurb",
      anyDate: "2026-08-05",
      assignedBy: "conducteur1",
    });
    expect(res.status).toBe(201);
    const a = (await res.json()) as any;
    expect(a.startDate).toBe("2026-08-03");
    expect(a.endDate).toBe("2026-08-09");
  });

  it("refuse une personne sur deux chantiers les mêmes jours (409)", async () => {
    // wk_nguyen vient d'être affecté à ch_villeurb du 03 au 09/08.
    const res = await post("/api/assignments", {
      workerId: "wk_nguyen",
      chantierId: "ch_lyon",
      anyDate: "2026-08-06",
      assignedBy: "conducteur1",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/déjà affecté/i);
    expect(body.conflict.chantierId).toBe("ch_villeurb");

    // La semaine suivante reste possible : les périodes ne se chevauchent pas.
    const ok = await post("/api/assignments", {
      workerId: "wk_nguyen",
      chantierId: "ch_lyon",
      anyDate: "2026-08-12",
      assignedBy: "conducteur1",
    });
    expect(ok.status).toBe(201);
  });

  it("désigne un chef de chantier, unique pour la période", async () => {
    const mk = async (workerId: string, isChef: boolean) => {
      const r = await post("/api/assignments", {
        workerId,
        chantierId: "ch_villeurb",
        anyDate: "2026-10-07",
        assignedBy: "conducteur1",
        isChef,
      });
      expect(r.status).toBe(201);
      return (await r.json()) as any;
    };
    const first = await mk("wk_nguyen", true);
    expect(first.isChef).toBe(true);
    const second = await mk("wk_koffi", true);

    const list = await get("/api/assignments?from=2026-10-05&to=2026-10-11");
    const chefs = list.filter((a: any) => a.chantierId === "ch_villeurb" && a.isChef);
    expect(chefs.map((a: any) => a.id)).toEqual([second.id]);

    // On peut transférer l'encadrement à une autre affectation.
    const put = await fetch(base + `/api/assignments/${first.id}/chef`, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isChef: true }),
    });
    expect(put.status).toBe(200);
    const after = await get("/api/assignments?from=2026-10-05&to=2026-10-11");
    const chefs2 = after.filter((a: any) => a.chantierId === "ch_villeurb" && a.isChef);
    expect(chefs2.map((a: any) => a.id)).toEqual([first.id]);
  });

  it("retire une personne du planning", async () => {
    const created = await post("/api/assignments", {
      workerId: "wk_nguyen",
      chantierId: "ch_villeurb",
      anyDate: "2026-11-04",
      assignedBy: "conducteur1",
    });
    const a = (await created.json()) as any;
    const del = await fetch(base + `/api/assignments/${a.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.status).toBe(204);
    const list = await get("/api/assignments?from=2026-11-02&to=2026-11-08");
    expect(list.find((x: any) => x.id === a.id)).toBeUndefined();
    // La place est libérée : on peut réaffecter ailleurs la même semaine.
    const again = await post("/api/assignments", {
      workerId: "wk_nguyen",
      chantierId: "ch_lyon",
      anyDate: "2026-11-04",
      assignedBy: "conducteur1",
    });
    expect(again.status).toBe(201);
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
    const res = await fetch(base + path, { headers: { authorization: `Bearer ${adminToken}` } });
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
    const res = await fetch(base + "/api/reports/interim.pdf", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
  });
});

describe("Authentification & rôles", () => {
  it("refuse les requêtes sans jeton (401)", async () => {
    const res = await fetch(base + "/api/workers");
    expect(res.status).toBe(401);
  });
  it("refuse un mauvais mot de passe", async () => {
    const res = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "mauvais" }),
    });
    expect(res.status).toBe(401);
  });
  it("un chef ne voit pas les coûts (403) ni la paie dans la synthèse", async () => {
    const res = await fetch(base + "/api/costs", {
      headers: { authorization: `Bearer ${chefToken}` },
    });
    expect(res.status).toBe(403);
    const summary = await get("/api/reports/summary?from=2026-07-27&to=2026-07-31", chefToken);
    expect(summary.cost).toBeUndefined();
    expect(summary.payroll).toBeUndefined();
    expect(summary.totals.workedMinutes).toBeGreaterThan(0);
  });
  it("un chef ne peut ni exporter un PDF (403) ni gérer les comptes", async () => {
    const pdf = await fetch(base + "/api/reports/interim.pdf?month=2026-07", {
      headers: { authorization: `Bearer ${chefToken}` },
    });
    expect(pdf.status).toBe(403);
    const users = await fetch(base + "/api/users", {
      headers: { authorization: `Bearer ${chefToken}` },
    });
    expect(users.status).toBe(403);
  });
  it("un chef ne peut pas modifier le planning (403) mais peut pointer", async () => {
    const asg = await post(
      "/api/assignments",
      { workerId: "wk_dupont", chantierId: "ch_lyon", anyDate: "2026-09-07", assignedBy: "x" },
      chefToken,
    );
    expect(asg.status).toBe(403);
    const entry = await post(
      "/api/entries",
      { workerId: "wk_dupont", chantierId: "ch_lyon", date: "2026-09-08", kind: "TRAVAIL", minutes: 480, recordedBy: "chef" },
      chefToken,
    );
    expect(entry.status).toBe(201);
  });
  it("l'admin crée un compte, le nouveau venu se connecte", async () => {
    const created = await post("/api/users", {
      username: "paul",
      displayName: "Paul Test",
      role: "CONDUCTEUR",
      password: "paul1234",
    });
    expect(created.status).toBe(201);
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "paul", password: "paul1234" }),
    });
    expect(login.status).toBe(200);
    const tok = ((await login.json()) as any).token as string;
    const me = await get("/api/auth/me", tok);
    expect(me.role).toBe("CONDUCTEUR");
  });
});

describe("Périmètre du chef de chantier (salarié affecté)", () => {
  // Le compte « chef » est rattaché au salarié wk_dupont, affecté à ch_lyon.
  it("ne voit que les chantiers où son salarié est affecté", async () => {
    const chantiers = await get("/api/chantiers", chefToken);
    expect(chantiers.map((c: any) => c.id)).toEqual(["ch_lyon"]);
    // L'admin, lui, voit les deux.
    expect((await get("/api/chantiers")).length).toBe(2);
  });

  it("expose son périmètre dans /auth/me", async () => {
    const me = await get("/api/auth/me", chefToken);
    expect(me.workerId).toBe("wk_dupont");
    expect(me.chantierIds).toEqual(["ch_lyon"]);
  });

  it("ne reçoit que les pointages et affectations de son chantier", async () => {
    const entries = await get("/api/entries?from=2026-07-27&to=2026-07-31", chefToken);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e: any) => e.chantierId === "ch_lyon")).toBe(true);
    const asg = await get("/api/assignments", chefToken);
    expect(asg.every((a: any) => a.chantierId === "ch_lyon")).toBe(true);
  });

  it("ne peut pas pointer sur un chantier hors de son périmètre (403)", async () => {
    const res = await post(
      "/api/entries",
      { workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-09-15", kind: "TRAVAIL", minutes: 480, recordedBy: "chef" },
      chefToken,
    );
    expect(res.status).toBe(403);
    // Mais il peut pointer sur le sien.
    const ok = await post(
      "/api/entries",
      { workerId: "wk_silva", chantierId: "ch_lyon", date: "2026-09-15", kind: "TRAVAIL", minutes: 480, recordedBy: "chef" },
      chefToken,
    );
    expect(ok.status).toBe(201);
  });

  it("la synchro pull et push respectent le périmètre", async () => {
    const pull = await get("/api/sync/pull?since=1970-01-01T00:00:00.000Z", chefToken);
    expect(pull.entries.every((e: any) => e.chantierId === "ch_lyon")).toBe(true);
    const push = await post(
      "/api/sync/push",
      {
        entries: [
          { id: "sync_scope_1", workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-09-20", kind: "TRAVAIL", minutes: 480, recordedBy: "chef", createdAt: "2026-09-20T18:00:00.000Z", updatedAt: "2026-09-20T18:00:00.000Z", version: 1, sync: "LOCAL" },
        ],
      },
      chefToken,
    );
    const body = (await push.json()) as any;
    expect(body.rejected).toBe(1);
    expect(body.applied).toEqual([]);
  });

  it("son rapport ne couvre que son chantier", async () => {
    const rep = await get("/api/reports/summary?from=2026-07-27&to=2026-07-31", chefToken);
    expect(Object.keys(rep.byChantier)).toEqual(["ch_lyon"]);
  });
});

describe("API relevé d'heures individuel", () => {
  async function pdf(path: string, token?: string) {
    const res = await fetch(base + path, {
      headers: { authorization: `Bearer ${token ?? adminToken}` },
    });
    return { res, buf: Buffer.from(await res.arrayBuffer()) };
  }
  it("génère un PDF pour une personne sur une période", async () => {
    const { res, buf } = await pdf("/api/reports/timesheet.pdf?from=2026-07-27&to=2026-07-31&workerId=wk_dupont");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(800);
  });
  it("génère un PDF pour tout le personnel", async () => {
    const { res, buf } = await pdf("/api/reports/timesheet.pdf?from=2026-07-27&to=2026-07-31");
    expect(res.status).toBe(200);
    expect(buf.length).toBeGreaterThan(1000);
  });
  it("refuse une période invalide ou manquante (400)", async () => {
    expect((await pdf("/api/reports/timesheet.pdf")).res.status).toBe(400);
    expect((await pdf("/api/reports/timesheet.pdf?from=2026-07-31&to=2026-07-27")).res.status).toBe(400);
  });
  it("inaccessible à un chef (403)", async () => {
    const { res } = await pdf("/api/reports/timesheet.pdf?from=2026-07-27&to=2026-07-31", chefToken);
    expect(res.status).toBe(403);
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
