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
  findConflict,
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
import type { Agency, Assignment, Chantier, CostRate, TimeEntry, Worker } from "../core/types.js";
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
import { interimBillingPdf, salariedMonthlyPdf, workerTimesheetPdf } from "./pdf.js";
import { billingStatements, workerTimesheets } from "../core/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(here, "..", "..", "web");

function mapToObject<T>(m: Map<string, T>): Record<string, T> {
  return Object.fromEntries(m);
}

export function createApp(repo: Repository): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // CORS : l'application Android (WebView Capacitor) et la version web ouverte
  // depuis un autre poste appellent l'API depuis une autre origine. L'auth se
  // fait par jeton Bearer (pas de cookie), donc « * » est sans risque.
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

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

  /**
   * Périmètre du compte connecté. Un CHEF est un salarié membre du personnel :
   * il ne voit que les chantiers où il est lui-même affecté. Renvoie `null`
   * pour les rôles qui voient tout (conducteur, admin).
   */
  const scopeChantiers = (req: Request): string[] | null => {
    const u = req.user!;
    if (u.role !== "CHEF") return null;
    if (!u.workerId) return []; // compte chef non rattaché à un salarié
    return repo.chantierIdsForWorker(u.workerId);
  };
  const inScope = (scope: string[] | null, chantierId: string) =>
    scope === null || scope.includes(chantierId);

  api.get("/auth/me", (req, res) => {
    const { id, username, displayName, role, workerId } = req.user!;
    res.json({ id, username, displayName, role, workerId, chantierIds: scopeChantiers(req) });
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
    const { username, displayName, role, password, workerId } = req.body ?? {};
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
      workerId: workerId || undefined,
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
    if ("workerId" in req.body) patch.workerId = req.body.workerId || undefined;
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

  api.get("/chantiers", (req, res) => {
    const scope = scopeChantiers(req);
    const all = repo.listChantiers();
    res.json(scope === null ? all : all.filter((c) => scope.includes(c.id)));
  });
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
    const scope = scopeChantiers(req);
    const list = repo.listAssignments({
      chantierId: req.query.chantierId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json(scope === null ? list : list.filter((a) => scope.includes(a.chantierId)));
  });

  // Roster : personnes affectées à un chantier pour une date donnée (vue chef).
  api.get("/roster", (req, res) => {
    const chantierId = req.query.chantierId as string | undefined;
    const date = req.query.date as string | undefined;
    if (!chantierId || !date) return res.status(400).json({ error: "chantierId et date requis" });
    if (!inScope(scopeChantiers(req), chantierId)) {
      return res.status(403).json({ error: "chantier hors de votre périmètre" });
    }
    try {
      const ids = assignedWorkerIds(repo.listAssignments({ chantierId }), chantierId, date);
      const workers = repo.listWorkers().filter((w) => ids.includes(w.id));
      res.json(workers);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  /**
   * Message d'erreur explicite quand une personne est déjà affectée ailleurs
   * sur les mêmes jours (une personne = un seul chantier à la fois).
   */
  const conflictMessage = (c: Assignment): string => {
    const w = repo.listWorkers().find((x) => x.id === c.workerId);
    const ch = repo.listChantiers().find((x) => x.id === c.chantierId);
    const who = w ? `${w.firstName} ${w.lastName}` : "Cette personne";
    const where = ch ? `« ${ch.name} »` : "un autre chantier";
    const period = c.endDate ? `du ${c.startDate} au ${c.endDate}` : `à partir du ${c.startDate}`;
    return `${who} est déjà affecté(e) sur ${where} ${period}. Une personne ne peut pas être sur deux chantiers les mêmes jours.`;
  };

  api.post("/assignments", requireRole("CONDUCTEUR"), (req, res) => {
    const { workerId, chantierId, anyDate, assignedBy } = req.body;
    if (!workerId || !chantierId || !anyDate || !assignedBy) {
      return res.status(400).json({ error: "workerId, chantierId, anyDate, assignedBy requis" });
    }
    try {
      const a = buildWeekAssignment(req.body, { id: newId("as"), now: nowISO() });
      const conflict = findConflict(
        repo.assignmentsForWorker(a.workerId, a.startDate, a.endDate),
        a.workerId,
        a.chantierId,
        a.startDate,
        a.endDate,
      );
      if (conflict) return res.status(409).json({ error: conflictMessage(conflict), conflict });
      repo.upsertAssignment(a);
      // Un seul chef de chantier par chantier et par période.
      if (a.isChef) repo.clearChefFlag(a.chantierId, a.startDate, a.endDate, a.id);
      res.status(201).json(a);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  /** Désigne (ou retire) le chef de chantier sur une affectation existante. */
  api.put("/assignments/:id/chef", requireRole("CONDUCTEUR"), (req, res) => {
    const a = repo.getAssignment(String(req.params.id));
    if (!a || a.deleted) return res.status(404).json({ error: "affectation introuvable" });
    const isChef = req.body?.isChef !== false;
    const updated: Assignment = {
      ...a,
      isChef,
      updatedAt: nowISO(),
      version: a.version + 1,
    };
    repo.upsertAssignment(updated);
    if (isChef) repo.clearChefFlag(a.chantierId, a.startDate, a.endDate, a.id);
    res.json(updated);
  });

  /** Retire une personne du planning. */
  api.delete("/assignments/:id", requireRole("CONDUCTEUR"), (req, res) => {
    if (!repo.deleteAssignment(String(req.params.id), nowISO())) {
      return res.status(404).json({ error: "affectation introuvable" });
    }
    res.status(204).end();
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
    const conflict = findConflict(
      repo.assignmentsForWorker(replacement.workerId, replacement.startDate, replacement.endDate),
      replacement.workerId,
      replacement.chantierId,
      replacement.startDate,
      replacement.endDate,
    );
    if (conflict) return res.status(409).json({ error: conflictMessage(conflict), conflict });
    repo.upsertAssignment(ended);
    repo.upsertAssignment(replacement);
    res.status(201).json({ ended, replacement });
  });

  // --- Pointages ---
  api.post("/entries", (req, res) => {
    const input = req.body as TimeEntryInput;
    if (!inScope(scopeChantiers(req), input.chantierId)) {
      return res.status(403).json({ error: "chantier hors de votre périmètre" });
    }
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
    const scope = scopeChantiers(req);
    const list = repo.queryEntries({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      workerId: req.query.workerId as string | undefined,
      chantierId: req.query.chantierId as string | undefined,
    });
    res.json(scope === null ? list : list.filter((e) => scope.includes(e.chantierId)));
  });

  // --- Synchronisation local-first ---
  api.post("/sync/push", (req, res) => {
    const incoming = (req.body.entries ?? []) as TimeEntry[];
    if (!Array.isArray(incoming)) return res.status(400).json({ error: "entries[] attendu" });
    const scope = scopeChantiers(req);
    const allowed = scope === null ? incoming : incoming.filter((e) => scope.includes(e.chantierId));
    const rejected = incoming.length - allowed.length;
    res.json({ ...repo.syncPush(allowed), rejected, serverTime: nowISO() });
  });

  api.get("/sync/pull", (req, res) => {
    const since = (req.query.since as string) || "1970-01-01T00:00:00.000Z";
    const scope = scopeChantiers(req);
    const entries = repo.syncPull(since);
    res.json({
      entries: scope === null ? entries : entries.filter((e) => scope.includes(e.chantierId)),
      serverTime: nowISO(),
    });
  });

  // --- Rapports (jour / semaine / mois) ---
  api.get("/reports/summary", (req: Request, res: Response) => {
    const scope = scopeChantiers(req);
    const entries0 = repo.queryEntries({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      chantierId: req.query.chantierId as string | undefined,
      workerId: req.query.workerId as string | undefined,
    });
    const entries = scope === null ? entries0 : entries0.filter((e) => scope.includes(e.chantierId));
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
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  // Relevés d'heures individuels sur une période libre.
  // Accessible aux conducteurs et admins ; un chef n'y a pas accès (il ne gère
  // pas la paie), mais les données restent limitées à son périmètre s'il y a lieu.
  api.get("/reports/timesheet.pdf", requireRole("CONDUCTEUR"), async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
      return res.status(400).json({ error: "paramètres from et to (AAAA-MM-JJ) requis" });
    }
    if (from > to) return res.status(400).json({ error: "période invalide (from > to)" });

    const workerId = req.query.workerId as string | undefined;
    const chantierId = req.query.chantierId as string | undefined;
    const scope = scopeChantiers(req);

    let entries = repo.queryEntries({ from, to, ...(chantierId ? { chantierId } : {}) });
    if (scope !== null) entries = entries.filter((e) => scope.includes(e.chantierId));

    const workers = repo.listWorkers();
    const sheets = workerTimesheets(
      entries,
      workers,
      from,
      to,
      (w) => (!workerId || w.id === workerId),
    );
    const pdf = await workerTimesheetPdf(sheets, repo.listChantiers(), from, to);
    res.setHeader("Content-Type", "application/pdf");
    const name = workerId ? `releve-${workerId}` : "releves-individuels";
    res.setHeader("Content-Disposition", `attachment; filename="${name}-${from}_${to}.pdf"`);
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
