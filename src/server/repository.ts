/**
 * Dépôt de données — CRUD + synchronisation, au-dessus de SQLite.
 *
 * Convertit les entiers SQLite (0/1) en booléens du domaine et applique la
 * logique de fusion `mergeBatch` pour la synchro local-first.
 */
import { resolve } from "../core/sync.js";
import type {
  Agency,
  Assignment,
  Chantier,
  CostRate,
  TimeEntry,
  Worker,
} from "../core/types.js";
import type { Role, SessionUser, User } from "./auth.js";
import type { DB } from "./db.js";

/** Utilisateur avec secrets (usage interne au serveur uniquement). */
export interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

const bool = (v: unknown): boolean => Boolean(v);
const int = (v: boolean | undefined, dflt = 1): number => (v === undefined ? dflt : v ? 1 : 0);

function rowToWorker(r: any): Worker {
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    type: r.type,
    category: r.category ?? undefined,
    trade: r.trade ?? undefined,
    agencyId: r.agencyId ?? undefined,
    hourlyRate: r.hourlyRate ?? undefined,
    active: bool(r.active),
  };
}

function rowToCost(r: any): CostRate {
  return {
    workerId: r.workerId,
    chantierId: r.chantierId,
    hourlyRate: r.hourlyRate ?? undefined,
    overtime25Rate: r.overtime25Rate ?? undefined,
    overtime50Rate: r.overtime50Rate ?? undefined,
    holidayRate: r.holidayRate ?? undefined,
    weatherRate: r.weatherRate ?? undefined,
    mealAllowance: r.mealAllowance ?? undefined,
    travelAllowance: r.travelAllowance ?? undefined,
  };
}

function rowToAssignment(r: any): Assignment {
  return {
    id: r.id,
    workerId: r.workerId,
    chantierId: r.chantierId,
    startDate: r.startDate,
    endDate: r.endDate ?? undefined,
    assignedBy: r.assignedBy,
    replacesWorkerId: r.replacesWorkerId ?? undefined,
    status: r.status,
    note: r.note ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    version: r.version,
    sync: r.sync,
    deleted: bool(r.deleted),
  };
}

function rowToChantier(r: any): Chantier {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    address: r.address ?? undefined,
    client: r.client ?? undefined,
    startDate: r.startDate ?? undefined,
    endDate: r.endDate ?? undefined,
    active: bool(r.active),
  };
}

function rowToAgency(r: any): Agency {
  return { id: r.id, name: r.name, contact: r.contact ?? undefined, active: bool(r.active) };
}

function rowToEntry(r: any): TimeEntry {
  return {
    id: r.id,
    workerId: r.workerId,
    chantierId: r.chantierId,
    date: r.date,
    kind: r.kind,
    minutes: r.minutes,
    startTime: r.startTime ?? undefined,
    endTime: r.endTime ?? undefined,
    breakMinutes: r.breakMinutes ?? undefined,
    absenceReason: r.absenceReason ?? undefined,
    accidentSeverity: r.accidentSeverity ?? undefined,
    note: r.note ?? undefined,
    recordedBy: r.recordedBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    version: r.version,
    sync: r.sync,
    deleted: bool(r.deleted),
  };
}

function rowToUser(r: any): UserRecord {
  return {
    id: r.id,
    username: r.username,
    displayName: r.displayName,
    role: r.role as Role,
    active: bool(r.active),
    createdAt: r.createdAt,
    passwordHash: r.passwordHash,
    salt: r.salt,
  };
}

function publicUser(u: UserRecord): User {
  const { passwordHash: _h, salt: _s, ...pub } = u;
  return pub;
}

export class Repository {
  constructor(private readonly db: DB) {}

  // --- Utilisateurs & sessions ---
  countUsers(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  }
  createUser(u: UserRecord): void {
    this.db
      .prepare(
        `INSERT INTO users(id,username,displayName,role,passwordHash,salt,active,createdAt)
         VALUES(@id,@username,@displayName,@role,@passwordHash,@salt,@active,@createdAt)`,
      )
      .run({ ...u, active: int(u.active) });
  }
  getUserByUsername(username: string): UserRecord | undefined {
    const r = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    return r ? rowToUser(r) : undefined;
  }
  getUserById(id: string): UserRecord | undefined {
    const r = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return r ? rowToUser(r) : undefined;
  }
  listUsers(): User[] {
    return this.db
      .prepare("SELECT * FROM users ORDER BY displayName")
      .all()
      .map((r) => publicUser(rowToUser(r)));
  }
  updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, "displayName" | "role" | "active" | "passwordHash" | "salt">>,
  ): void {
    const existing = this.getUserById(id);
    if (!existing) throw new Error("utilisateur introuvable");
    const merged = { ...existing, ...patch };
    this.db
      .prepare(
        `UPDATE users SET displayName=@displayName, role=@role, active=@active,
           passwordHash=@passwordHash, salt=@salt WHERE id=@id`,
      )
      .run({ ...merged, active: int(merged.active) });
  }

  createSession(token: string, userId: string, createdAt: string, expiresAt: string): void {
    this.db
      .prepare("INSERT INTO sessions(token,userId,createdAt,expiresAt) VALUES(?,?,?,?)")
      .run(token, userId, createdAt, expiresAt);
  }
  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  /** Session valide (non expirée) → utilisateur public + jeton. */
  getSessionUser(token: string): SessionUser | undefined {
    const r = this.db
      .prepare(
        `SELECT u.*, s.token AS sessToken FROM sessions s
         JOIN users u ON u.id = s.userId
         WHERE s.token = ? AND s.expiresAt > ?`,
      )
      .get(token, new Date().toISOString()) as any;
    if (!r) return undefined;
    return { ...publicUser(rowToUser(r)), token: r.sessToken };
  }

  // --- Agences ---
  upsertAgency(a: Agency): void {
    this.db
      .prepare(
        `INSERT INTO agencies(id,name,contact,active) VALUES(@id,@name,@contact,@active)
         ON CONFLICT(id) DO UPDATE SET name=@name, contact=@contact, active=@active`,
      )
      .run({ ...a, contact: a.contact ?? null, active: int(a.active) });
  }
  listAgencies(): Agency[] {
    return this.db.prepare("SELECT * FROM agencies ORDER BY name").all().map(rowToAgency);
  }

  // --- Chantiers ---
  upsertChantier(c: Chantier): void {
    this.db
      .prepare(
        `INSERT INTO chantiers(id,code,name,address,client,startDate,endDate,active)
         VALUES(@id,@code,@name,@address,@client,@startDate,@endDate,@active)
         ON CONFLICT(id) DO UPDATE SET code=@code,name=@name,address=@address,
           client=@client,startDate=@startDate,endDate=@endDate,active=@active`,
      )
      .run({
        ...c,
        address: c.address ?? null,
        client: c.client ?? null,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        active: int(c.active),
      });
  }
  listChantiers(): Chantier[] {
    return this.db.prepare("SELECT * FROM chantiers ORDER BY name").all().map(rowToChantier);
  }

  // --- Personnes ---
  upsertWorker(w: Worker): void {
    this.db
      .prepare(
        `INSERT INTO workers(id,firstName,lastName,type,category,trade,agencyId,hourlyRate,active)
         VALUES(@id,@firstName,@lastName,@type,@category,@trade,@agencyId,@hourlyRate,@active)
         ON CONFLICT(id) DO UPDATE SET firstName=@firstName,lastName=@lastName,type=@type,
           category=@category,trade=@trade,agencyId=@agencyId,hourlyRate=@hourlyRate,active=@active`,
      )
      .run({
        ...w,
        category: w.category ?? null,
        trade: w.trade ?? null,
        agencyId: w.agencyId ?? null,
        hourlyRate: w.hourlyRate ?? null,
        active: int(w.active),
      });
  }
  listWorkers(): Worker[] {
    return this.db
      .prepare("SELECT * FROM workers ORDER BY lastName, firstName")
      .all()
      .map(rowToWorker);
  }

  // --- Grille de coûts (personne × chantier) ---
  upsertCost(c: CostRate): void {
    this.db
      .prepare(
        `INSERT INTO costs(workerId,chantierId,hourlyRate,overtime25Rate,overtime50Rate,
            holidayRate,weatherRate,mealAllowance,travelAllowance)
         VALUES(@workerId,@chantierId,@hourlyRate,@overtime25Rate,@overtime50Rate,
            @holidayRate,@weatherRate,@mealAllowance,@travelAllowance)
         ON CONFLICT(workerId,chantierId) DO UPDATE SET hourlyRate=@hourlyRate,
           overtime25Rate=@overtime25Rate, overtime50Rate=@overtime50Rate,
           holidayRate=@holidayRate, weatherRate=@weatherRate,
           mealAllowance=@mealAllowance, travelAllowance=@travelAllowance`,
      )
      .run({
        ...c,
        hourlyRate: c.hourlyRate ?? null,
        overtime25Rate: c.overtime25Rate ?? null,
        overtime50Rate: c.overtime50Rate ?? null,
        holidayRate: c.holidayRate ?? null,
        weatherRate: c.weatherRate ?? null,
        mealAllowance: c.mealAllowance ?? null,
        travelAllowance: c.travelAllowance ?? null,
      });
  }
  listCosts(): CostRate[] {
    return this.db.prepare("SELECT * FROM costs").all().map(rowToCost);
  }

  // --- Affectations ---
  upsertAssignment(a: Assignment): void {
    this.db
      .prepare(
        `INSERT INTO assignments(id,workerId,chantierId,startDate,endDate,assignedBy,
            replacesWorkerId,status,note,createdAt,updatedAt,version,sync,deleted)
         VALUES(@id,@workerId,@chantierId,@startDate,@endDate,@assignedBy,
            @replacesWorkerId,@status,@note,@createdAt,@updatedAt,@version,@sync,@deleted)
         ON CONFLICT(id) DO UPDATE SET workerId=@workerId,chantierId=@chantierId,startDate=@startDate,
            endDate=@endDate,assignedBy=@assignedBy,replacesWorkerId=@replacesWorkerId,status=@status,
            note=@note,updatedAt=@updatedAt,version=@version,sync=@sync,deleted=@deleted`,
      )
      .run({
        ...a,
        endDate: a.endDate ?? null,
        replacesWorkerId: a.replacesWorkerId ?? null,
        note: a.note ?? null,
        sync: "SYNCED",
        deleted: int(a.deleted, 0),
      });
  }
  getAssignment(id: string): Assignment | undefined {
    const r = this.db.prepare("SELECT * FROM assignments WHERE id = ?").get(id);
    return r ? rowToAssignment(r) : undefined;
  }
  listAssignments(filter: { chantierId?: string; from?: string; to?: string } = {}): Assignment[] {
    const clauses = ["deleted = 0"];
    const params: Record<string, unknown> = {};
    if (filter.chantierId) {
      clauses.push("chantierId = @chantierId");
      params.chantierId = filter.chantierId;
    }
    if (filter.to) {
      clauses.push("startDate <= @to");
      params.to = filter.to;
    }
    if (filter.from) {
      clauses.push("(endDate IS NULL OR endDate >= @from)");
      params.from = filter.from;
    }
    return this.db
      .prepare(`SELECT * FROM assignments WHERE ${clauses.join(" AND ")} ORDER BY startDate`)
      .all(params)
      .map(rowToAssignment);
  }

  // --- Pointages ---
  getEntry(id: string): TimeEntry | undefined {
    const r = this.db.prepare("SELECT * FROM entries WHERE id = ?").get(id);
    return r ? rowToEntry(r) : undefined;
  }

  private writeEntry(e: TimeEntry): void {
    this.db
      .prepare(
        `INSERT INTO entries(id,workerId,chantierId,date,kind,minutes,startTime,endTime,
            breakMinutes,absenceReason,accidentSeverity,note,recordedBy,createdAt,updatedAt,version,sync,deleted)
         VALUES(@id,@workerId,@chantierId,@date,@kind,@minutes,@startTime,@endTime,
            @breakMinutes,@absenceReason,@accidentSeverity,@note,@recordedBy,@createdAt,@updatedAt,@version,@sync,@deleted)
         ON CONFLICT(id) DO UPDATE SET workerId=@workerId,chantierId=@chantierId,date=@date,kind=@kind,
            minutes=@minutes,startTime=@startTime,endTime=@endTime,breakMinutes=@breakMinutes,
            absenceReason=@absenceReason,accidentSeverity=@accidentSeverity,note=@note,recordedBy=@recordedBy,
            createdAt=@createdAt,updatedAt=@updatedAt,version=@version,sync=@sync,deleted=@deleted`,
      )
      .run({
        ...e,
        startTime: e.startTime ?? null,
        endTime: e.endTime ?? null,
        breakMinutes: e.breakMinutes ?? null,
        absenceReason: e.absenceReason ?? null,
        accidentSeverity: e.accidentSeverity ?? null,
        note: e.note ?? null,
        deleted: int(e.deleted, 0),
      });
  }

  /** Écrit un pointage (création/mise à jour côté serveur). */
  saveEntry(e: TimeEntry): TimeEntry {
    this.writeEntry({ ...e, sync: "SYNCED" });
    return this.getEntry(e.id)!;
  }

  /**
   * Applique un lot entrant depuis un client et renvoie les enregistrements
   * plus récents que `since` (pull). Résolution de conflits déterministe.
   */
  syncPush(incoming: TimeEntry[]): { applied: string[]; conflicts: string[] } {
    const applied: string[] = [];
    const conflicts: string[] = [];
    const tx = this.db.transaction((batch: TimeEntry[]) => {
      for (const inc of batch) {
        const existing = this.getEntry(inc.id);
        if (!existing) {
          this.writeEntry({ ...inc, sync: "SYNCED" });
          applied.push(inc.id);
          continue;
        }
        const winner = resolve(existing, inc);
        if (winner === existing) {
          conflicts.push(inc.id); // le serveur avait déjà mieux
        } else {
          this.writeEntry({ ...inc, sync: "SYNCED" });
          applied.push(inc.id);
        }
      }
    });
    tx(incoming);
    return { applied, conflicts };
  }

  /** Renvoie les pointages modifiés strictement après `sinceISO`. */
  syncPull(sinceISO: string): TimeEntry[] {
    return this.db
      .prepare("SELECT * FROM entries WHERE updatedAt > ? ORDER BY updatedAt")
      .all(sinceISO)
      .map(rowToEntry);
  }

  /** Liste filtrée pour les rapports. */
  queryEntries(filter: {
    from?: string;
    to?: string;
    workerId?: string;
    chantierId?: string;
    includeDeleted?: boolean;
  }): TimeEntry[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (!filter.includeDeleted) clauses.push("deleted = 0");
    if (filter.from) {
      clauses.push("date >= @from");
      params.from = filter.from;
    }
    if (filter.to) {
      clauses.push("date <= @to");
      params.to = filter.to;
    }
    if (filter.workerId) {
      clauses.push("workerId = @workerId");
      params.workerId = filter.workerId;
    }
    if (filter.chantierId) {
      clauses.push("chantierId = @chantierId");
      params.chantierId = filter.chantierId;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return this.db
      .prepare(`SELECT * FROM entries ${where} ORDER BY date, workerId`)
      .all(params)
      .map(rowToEntry);
  }
}
