/**
 * Dépôt de données — CRUD + synchronisation, au-dessus de SQLite.
 *
 * Convertit les entiers SQLite (0/1) en booléens du domaine et applique la
 * logique de fusion `mergeBatch` pour la synchro local-first.
 */
import { resolve } from "../core/sync.js";
import type {
  Agency,
  Chantier,
  TimeEntry,
  Worker,
} from "../core/types.js";
import type { DB } from "./db.js";

const bool = (v: unknown): boolean => Boolean(v);
const int = (v: boolean | undefined, dflt = 1): number => (v === undefined ? dflt : v ? 1 : 0);

function rowToWorker(r: any): Worker {
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    type: r.type,
    trade: r.trade ?? undefined,
    agencyId: r.agencyId ?? undefined,
    hourlyRate: r.hourlyRate ?? undefined,
    active: bool(r.active),
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

export class Repository {
  constructor(private readonly db: DB) {}

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
        `INSERT INTO workers(id,firstName,lastName,type,trade,agencyId,hourlyRate,active)
         VALUES(@id,@firstName,@lastName,@type,@trade,@agencyId,@hourlyRate,@active)
         ON CONFLICT(id) DO UPDATE SET firstName=@firstName,lastName=@lastName,type=@type,
           trade=@trade,agencyId=@agencyId,hourlyRate=@hourlyRate,active=@active`,
      )
      .run({
        ...w,
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
