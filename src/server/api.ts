/**
 * API REST — pointage BTP.
 *
 * Sert aussi les fichiers statiques de la PWA. Toutes les réponses sont en
 * JSON ; les erreurs de validation renvoient 400 avec le détail métier.
 */
import express, { type Express, type Request, type Response } from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildTimeEntry,
  byAgency,
  byChantier,
  byDate,
  byWorker,
  monthlyDetail,
  totals,
  weeklyByWorker,
  type TimeEntryInput,
} from "../core/index.js";
import type { Agency, Chantier, TimeEntry, Worker } from "../core/types.js";
import type { Repository } from "./repository.js";
import { newId, nowISO } from "./ids.js";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(here, "..", "..", "web");

function mapToObject<T>(m: Map<string, T>): Record<string, T> {
  return Object.fromEntries(m);
}

export function createApp(repo: Repository): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, time: nowISO() }));

  // --- Référentiels ---
  api.get("/agencies", (_req, res) => res.json(repo.listAgencies()));
  api.post("/agencies", (req, res) => {
    const a: Agency = { id: req.body.id || newId("ag"), active: true, ...req.body };
    repo.upsertAgency(a);
    res.status(201).json(a);
  });

  api.get("/chantiers", (_req, res) => res.json(repo.listChantiers()));
  api.post("/chantiers", (req, res) => {
    if (!req.body.code || !req.body.name) {
      return res.status(400).json({ error: "code et name requis" });
    }
    const c: Chantier = { id: req.body.id || newId("ch"), active: true, ...req.body };
    repo.upsertChantier(c);
    res.status(201).json(c);
  });

  api.get("/workers", (_req, res) => res.json(repo.listWorkers()));
  api.post("/workers", (req, res) => {
    if (!req.body.firstName || !req.body.lastName || !req.body.type) {
      return res.status(400).json({ error: "firstName, lastName et type requis" });
    }
    const w: Worker = { id: req.body.id || newId("wk"), active: true, ...req.body };
    repo.upsertWorker(w);
    res.status(201).json(w);
  });

  // --- Pointages ---
  api.post("/entries", (req, res) => {
    const input = req.body as TimeEntryInput;
    try {
      const entry = buildTimeEntry(input, { id: newId("en"), now: nowISO() });
      res.status(201).json(repo.saveEntry(entry));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  api.put("/entries/:id", (req, res) => {
    const existing = repo.getEntry(req.params.id);
    if (!existing) return res.status(404).json({ error: "pointage introuvable" });
    const input = { ...existing, ...req.body } as TimeEntryInput;
    try {
      const rebuilt = buildTimeEntry(input, {
        id: existing.id,
        now: nowISO(),
        version: existing.version + 1,
      });
      res.json(repo.saveEntry({ ...rebuilt, createdAt: existing.createdAt }));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  api.delete("/entries/:id", (req, res) => {
    const existing = repo.getEntry(req.params.id);
    if (!existing) return res.status(404).json({ error: "pointage introuvable" });
    repo.saveEntry({
      ...existing,
      deleted: true,
      version: existing.version + 1,
      updatedAt: nowISO(),
    });
    res.status(204).end();
  });

  api.get("/entries", (req, res) => {
    res.json(
      repo.queryEntries({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        workerId: req.query.workerId as string | undefined,
        chantierId: req.query.chantierId as string | undefined,
      }),
    );
  });

  // --- Synchronisation local-first ---
  api.post("/sync/push", (req, res) => {
    const incoming = (req.body.entries ?? []) as TimeEntry[];
    if (!Array.isArray(incoming)) return res.status(400).json({ error: "entries[] attendu" });
    res.json({ ...repo.syncPush(incoming), serverTime: nowISO() });
  });

  api.get("/sync/pull", (req, res) => {
    const since = (req.query.since as string) || "1970-01-01T00:00:00.000Z";
    res.json({ entries: repo.syncPull(since), serverTime: nowISO() });
  });

  // --- Rapports (jour / semaine / mois) ---
  api.get("/reports/summary", (req: Request, res: Response) => {
    const entries = repo.queryEntries({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      chantierId: req.query.chantierId as string | undefined,
      workerId: req.query.workerId as string | undefined,
    });
    res.json({
      totals: totals(entries),
      byWorker: mapToObject(byWorker(entries)),
      byChantier: mapToObject(byChantier(entries)),
      byDate: mapToObject(byDate(entries)),
      byAgency: mapToObject(byAgency(entries, repo.listWorkers())),
      weeklyByWorker: weeklyByWorker(entries),
      monthlyDetail: monthlyDetail(entries),
    });
  });

  app.use("/api", api);

  // PWA statique
  app.use(express.static(WEB_DIR));
  app.get("*", (_req, res) => res.sendFile(join(WEB_DIR, "index.html")));

  return app;
}
