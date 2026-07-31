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
  assignedWorkerIds,
  buildTimeEntry,
  buildWeekAssignment,
  byAgency,
  byChantier,
  byDate,
  byWorker,
  costByAgency,
  costByChantier,
  costByWorker,
  isSalaried,
  monthlyDetail,
  monthlyStatements,
  payrollByWorkerWeek,
  replaceWorker,
  totalCost,
  totals,
  weeklyByWorker,
  type TimeEntryInput,
} from "../core/index.js";
import type { Agency, Chantier, CostRate, TimeEntry, Worker } from "../core/types.js";
import type { Repository } from "./repository.js";
import {
  hashPassword,
  newToken,
  requireAuth,
  requireRole,
  SESSION_DAYS,
  verifyPassword,
  type Role,
} from "./auth.js";
import { newId, nowISO } from "./ids.js";
import { interimBillingPdf, salariedMonthlyPdf } from "./pdf.js";
import { billingStatements } from "../core/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(here, "..", "..", "web");

function mapToObject<T>(m: Map<string, T>): Record<string, T> {
  return Object.fromEntries(m);
}

export function createApp(repo: Repository): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, app: "TDMI Pointage", time: nowISO() }));

  // --- Authentification (routes publiques) ---
  api.post("/auth/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "identifiant et mot de passe requis" });
    }
    const user = repo.getUserByUsername(String(username).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.salt, user.passwordHash)) {
      return res.status(401).json({ error: "identifiant ou mot de passe incorrect" });
    }
    if (!user.active) return res.status(403).json({ error: "compte désactivé" });
    const token = newToken();
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000);
    repo.createSession(token, user.id, now.toISOString(), expires.toISOString());
    res.json({
      token,
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    });
  });

  // Tout le reste de l'API exige une session valide.
  api.use(requireAuth(repo));

  api.get("/auth/me", (req, res) => {
    const { id, username, displayName, role } = req.user!;
    res.json({ id, username, displayName, role });
  });
  api.post("/auth/logout", (req, res) => {
    repo.deleteSession(req.user!.token);
    res.status(204).end();
  });
  api.post("/auth/password", (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ error: "nouveau mot de passe trop court (4 caractères min.)" });
    }
    const me = repo.getUserById(req.user!.id)!;
    if (!verifyPassword(String(currentPassword ?? ""), me.salt, me.passwordHash)) {
      return res.status(401).json({ error: "mot de passe actuel incorrect" });
    }
    const { salt, hash } = hashPassword(String(newPassword));
    repo.updateUser(me.id, { salt, passwordHash: hash });
    res.json({ ok: true });
  });

  // --- Comptes utilisateurs (admin) ---
  api.get("/users", requireRole("ADMIN"), (_req, res) => res.json(repo.listUsers()));
  api.post("/users", requireRole("ADMIN"), (req, res) => {
    const { username, displayName, role, password } = req.body ?? {};
    if (!username || !displayName || !role || !password) {
      return res.status(400).json({ error: "username, displayName, role et password requis" });
    }
    if (!["CHEF", "CONDUCTEUR", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "rôle invalide" });
    }
    const uname = String(username).trim().toLowerCase();
    if (repo.getUserByUsername(uname)) {
      return res.status(400).json({ error: "cet identifiant existe déjà" });
    }
    const { salt, hash } = hashPassword(String(password));
    const user = {
      id: newId("us"),
      username: uname,
      displayName: String(displayName).trim(),
      role: role as Role,
      passwordHash: hash,
      salt,
      active: true,
      createdAt: nowISO(),
    };
    repo.createUser(user);
    const { passwordHash: _h, salt: _s, ...pub } = user;
    res.status(201).json(pub);
  });
  api.put("/users/:id", requireRole("ADMIN"), (req, res) => {
    const target = repo.getUserById(String(req.params.id));
    if (!target) return res.status(404).json({ error: "utilisateur introuvable" });
    const patch: Record<string, unknown> = {};
    if (req.body.displayName) patch.displayName = String(req.body.displayName).trim();
    if (req.body.role) {
      if (!["CHEF", "CONDUCTEUR", "ADMIN"].includes(req.body.role)) {
        return res.status(400).json({ error: "rôle invalide" });
      }
      patch.role = req.body.role;
    }
    if (typeof req.body.active === "boolean") {
      if (target.id === req.user!.id && req.body.active === false) {
        return res.status(400).json({ error: "impossible de désactiver son propre compte" });
      }
      patch.active = req.body.active;
    }
    if (req.body.password) {
      const { salt, hash } = hashPassword(String(req.body.password));
      patch.salt = salt;
      patch.passwordHash = hash;
    }
    repo.updateUser(target.id, patch);
    res.json(repo.listUsers().find((u) => u.id === target.id));
  });

  // --- Référentiels ---
  api.get("/agencies", (_req, res) => res.json(repo.listAgencies()));
  api.post("/agencies", requireRole("CONDUCTEUR"), (req, res) => {
    const a: Agency = { id: req.body.id || newId("ag"), active: true, ...req.body };
    repo.upsertAgency(a);
    res.status(201).json(a);
  });

  api.get("/chantiers", (_req, res) => res.json(repo.listChantiers()));
  api.post("/chantiers", requireRole("CONDUCTEUR"), (req, res) => {
    if (!req.body.code || !req.body.name) {
      return res.status(400).json({ error: "code et name requis" });
    }
    const c: Chantier = { id: req.body.id || newId("ch"), active: true, ...req.body };
    repo.upsertChantier(c);
    res.status(201).json(c);
  });

  api.get("/workers", (_req, res) => res.json(repo.listWorkers()));
  api.post("/workers", requireRole("CONDUCTEUR"), (req, res) => {
    if (!req.body.firstName || !req.body.lastName || !req.body.type) {
      return res.status(400).json({ error: "firstName, lastName et type requis" });
    }
    // `costs` optionnel : grille de coûts par chantier fournie à la création.
    const { costs, ...workerBody } = req.body as Worker & { costs?: CostRate[] };
    const w: Worker = {
      ...workerBody,
      id: workerBody.id || newId("wk"),
      active: workerBody.active ?? true,
    };
    repo.upsertWorker(w);
    if (Array.isArray(costs)) {
      for (const c of costs) repo.upsertCost({ ...c, workerId: w.id });
    }
    res.status(201).json(w);
  });

  // --- Grille de coûts (personne × chantier) ---
  api.get("/costs", requireRole("ADMIN"), (_req, res) => res.json(repo.listCosts()));
  api.post("/costs", requireRole("ADMIN"), (req, res) => {
    const { workerId, chantierId } = req.body;
    if (!workerId || !chantierId) {
      return res.status(400).json({ error: "workerId et chantierId requis" });
    }
    repo.upsertCost(req.body as CostRate);
    res.status(201).json(req.body);
  });

  // --- Affectations (planning des équipes) ---
  api.get("/assignments", (req, res) => {
    res.json(
      repo.listAssignments({
        chantierId: req.query.chantierId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      }),
    );
  });

  // Roster : personnes affectées à un chantier pour une date donnée (vue chef).
  api.get("/roster", (req, res) => {
    const chantierId = req.query.chantierId as string | undefined;
    const date = req.query.date as string | undefined;
    if (!chantierId || !date) return res.status(400).json({ error: "chantierId et date requis" });
    try {
      const ids = assignedWorkerIds(repo.listAssignments({ chantierId }), chantierId, date);
      const workers = repo.listWorkers().filter((w) => ids.includes(w.id));
      res.json(workers);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  api.post("/assignments", requireRole("CONDUCTEUR"), (req, res) => {
    const { workerId, chantierId, anyDate, assignedBy } = req.body;
    if (!workerId || !chantierId || !anyDate || !assignedBy) {
      return res.status(400).json({ error: "workerId, chantierId, anyDate, assignedBy requis" });
    }
    try {
      const a = buildWeekAssignment(req.body, { id: newId("as"), now: nowISO() });
      repo.upsertAssignment(a);
      res.status(201).json(a);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Remplacement d'une personne en cours de semaine.
  api.post("/assignments/:id/replace", requireRole("CONDUCTEUR"), (req, res) => {
    const original = repo.getAssignment(String(req.params.id));
    if (!original) return res.status(404).json({ error: "affectation introuvable" });
    const { newWorkerId, fromDate, assignedBy, note } = req.body;
    if (!newWorkerId || !fromDate || !assignedBy) {
      return res.status(400).json({ error: "newWorkerId, fromDate, assignedBy requis" });
    }
    const { ended, replacement } = replaceWorker(original, newWorkerId, fromDate, {
      id: newId("as"),
      now: nowISO(),
      assignedBy,
      note,
    });
    repo.upsertAssignment(ended);
    repo.upsertAssignment(replacement);
    res.status(201).json({ ended, replacement });
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
    const workers = repo.listWorkers();
    const base = {
      totals: totals(entries),
      byWorker: mapToObject(byWorker(entries)),
      byChantier: mapToObject(byChantier(entries)),
      byDate: mapToObject(byDate(entries)),
      byAgency: mapToObject(byAgency(entries, workers)),
      weeklyByWorker: weeklyByWorker(entries),
      monthlyDetail: monthlyDetail(entries),
    };
    // Les coûts et la paie ne sont exposés qu'aux administrateurs.
    if (req.user!.role !== "ADMIN") return res.json(base);
    const costs = repo.listCosts();
    res.json({
      ...base,
      cost: {
        total: totalCost(entries, workers, costs),
        byWorker: mapToObject(costByWorker(entries, workers, costs)),
        byChantier: mapToObject(costByChantier(entries, workers, costs)),
        byAgency: mapToObject(costByAgency(entries, workers, costs)),
      },
      payroll: payrollByWorkerWeek(entries, workers, costs),
    });
  });

  // --- Exports PDF (relevés mensuels) ---
  const MONTH_RE = /^\d{4}-\d{2}$/;

  api.get("/reports/interim.pdf", requireRole("ADMIN"), async (req, res) => {
    const month = req.query.month as string | undefined;
    if (!month || !MONTH_RE.test(month)) {
      return res.status(400).json({ error: "paramètre month=YYYY-MM requis" });
    }
    const agencyId = req.query.agencyId as string | undefined;
    const chantierId = req.query.chantierId as string | undefined;
    const category = req.query.category as string | undefined;

    const workers = repo.listWorkers();
    const costs = repo.listCosts();
    const chantiers = repo.listChantiers();
    const agencies = repo.listAgencies();

    // Filtre sur les pointages (par chantier) et sur les personnes (agence/catégorie).
    const entries = repo.queryEntries(chantierId ? { chantierId } : {});
    const statements = billingStatements(
      entries,
      workers,
      costs,
      month,
      (w) =>
        w.type === "INTERIMAIRE" &&
        (!agencyId || w.agencyId === agencyId) &&
        (!category || w.category === category),
    );

    // Libellé du filtre (impression par chantier / agence / catégorie).
    const parts: string[] = [];
    if (agencyId) parts.push(`Agence : ${agencies.find((a) => a.id === agencyId)?.name ?? agencyId}`);
    if (chantierId) parts.push(`Chantier : ${chantiers.find((c) => c.id === chantierId)?.name ?? chantierId}`);
    if (category) parts.push(`Catégorie : ${category}`);
    const filterLabel = parts.join(" · ") || undefined;

    const pdf = await interimBillingPdf(statements, chantiers, agencies, month, filterLabel);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="releve-interim-${month}.pdf"`);
    res.send(pdf);
  });

  api.get("/reports/salaried.pdf", requireRole("ADMIN"), async (req, res) => {
    const month = req.query.month as string | undefined;
    if (!month || !MONTH_RE.test(month)) {
      return res.status(400).json({ error: "paramètre month=YYYY-MM requis" });
    }
    const entries = repo.queryEntries({});
    const workers = repo.listWorkers();
    const costs = repo.listCosts();
    // Salariés + stagiaires + alternants (traitement interne).
    const statements = monthlyStatements(entries, workers, costs, month, (w) => isSalaried(w.type));
    const pdf = await salariedMonthlyPdf(statements, repo.listChantiers(), month);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="releve-salaries-${month}.pdf"`);
    res.send(pdf);
  });

  app.use("/api", api);

  // PWA statique
  app.use(express.static(WEB_DIR));
  app.get("*", (_req, res) => res.sendFile(join(WEB_DIR, "index.html")));

  return app;
}
