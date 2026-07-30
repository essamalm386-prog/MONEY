/**
 * Store local-first — IndexedDB + moteur de synchronisation.
 *
 * Les pointages sont d'abord écrits localement (utilisables hors-ligne), puis
 * poussés au serveur dès que le réseau est disponible. Le pull récupère les
 * modifications distantes (autres chefs de chantier) depuis le dernier point
 * de synchro. Les référentiels (chantiers, personnes, agences) sont mis en
 * cache localement pour l'affichage hors-ligne.
 */

const DB_NAME = "pointage-btp";
const DB_VERSION = 1;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ref")) {
        db.createObjectStore("ref", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class Store {
  constructor() {
    this.db = null;
    this.online = navigator.onLine;
    this.listeners = new Set();
    this._syncing = false;
  }

  async init() {
    this.db = await openIDB();
    window.addEventListener("online", () => this._setOnline(true));
    window.addEventListener("offline", () => this._setOnline(false));
    await this.refreshReference().catch(() => {});
    this.sync().catch(() => {});
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  _emit() {
    for (const fn of this.listeners) fn();
  }
  _setOnline(v) {
    this.online = v;
    this._emit();
    if (v) this.sync().catch(() => {});
  }

  // --- Référentiels (cache local + API) ---
  async refreshReference() {
    if (!this.online) return this._cachedReference();
    const [chantiers, workers, agencies] = await Promise.all([
      fetch("/api/chantiers").then((r) => r.json()),
      fetch("/api/workers").then((r) => r.json()),
      fetch("/api/agencies").then((r) => r.json()),
    ]);
    await tx(this.db, "ref", "readwrite", (s) => {
      s.put({ key: "chantiers", value: chantiers });
      s.put({ key: "workers", value: workers });
      s.put({ key: "agencies", value: agencies });
    });
    return { chantiers, workers, agencies };
  }

  async _cachedReference() {
    const rows = await tx(this.db, "ref", "readonly", (s) => getAll(s));
    const by = Object.fromEntries((await rows).map((r) => [r.key, r.value]));
    return { chantiers: by.chantiers || [], workers: by.workers || [], agencies: by.agencies || [] };
  }

  async reference() {
    return this._cachedReference();
  }

  async addChantier(payload) {
    return this._postRef("/api/chantiers", "chantiers", payload);
  }
  async addWorker(payload) {
    return this._postRef("/api/workers", "workers", payload);
  }
  async addAgency(payload) {
    return this._postRef("/api/agencies", "agencies", payload);
  }
  async _postRef(url, key, payload) {
    if (!this.online) throw new Error("Connexion requise pour modifier le référentiel");
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Erreur serveur");
    await this.refreshReference();
    this._emit();
    return res.json();
  }

  // --- Pointages ---
  async allEntries() {
    return tx(this.db, "entries", "readonly", (s) => getAll(s)).then((p) => p);
  }

  async entriesForDate(date, chantierId) {
    const all = await this.allEntries();
    return all.filter(
      (e) => !e.deleted && e.date === date && (!chantierId || e.chantierId === chantierId),
    );
  }

  /** Crée un pointage localement puis tente la synchro. */
  async saveEntry(input) {
    const now = new Date().toISOString();
    const existing = input.id ? await this._get(input.id) : null;
    const entry = {
      ...input,
      id: input.id || `loc_${crypto.randomUUID()}`,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      version: existing ? existing.version + 1 : 1,
      sync: "LOCAL",
      deleted: false,
    };
    await tx(this.db, "entries", "readwrite", (s) => s.put(entry));
    this._emit();
    this.sync().catch(() => {});
    return entry;
  }

  async deleteEntry(id) {
    const e = await this._get(id);
    if (!e) return;
    e.deleted = true;
    e.version += 1;
    e.updatedAt = new Date().toISOString();
    e.sync = "LOCAL";
    await tx(this.db, "entries", "readwrite", (s) => s.put(e));
    this._emit();
    this.sync().catch(() => {});
  }

  _get(id) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction("entries", "readonly");
      const req = t.objectStore("entries").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _meta(key) {
    return new Promise((resolve) => {
      const t = this.db.transaction("meta", "readonly");
      const req = t.objectStore("meta").get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  }
  async _setMeta(key, value) {
    return tx(this.db, "meta", "readwrite", (s) => s.put({ key, value }));
  }

  /** Push des pointages locaux non synchronisés, puis pull des nouveautés. */
  async sync() {
    if (!this.online || this._syncing) return;
    this._syncing = true;
    try {
      const all = await this.allEntries();
      const dirty = all.filter((e) => e.sync === "LOCAL");
      if (dirty.length) {
        const res = await fetch("/api/sync/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entries: dirty }),
        }).then((r) => r.json());
        const acked = new Set([...(res.applied || []), ...(res.conflicts || [])]);
        await tx(this.db, "entries", "readwrite", (s) => {
          for (const e of dirty) if (acked.has(e.id)) s.put({ ...e, sync: "SYNCED" });
        });
      }

      const since = (await this._meta("lastPull")) || "1970-01-01T00:00:00.000Z";
      const pull = await fetch(`/api/sync/pull?since=${encodeURIComponent(since)}`).then((r) =>
        r.json(),
      );
      if (pull.entries && pull.entries.length) {
        await tx(this.db, "entries", "readwrite", (s) => {
          for (const remote of pull.entries) s.put({ ...remote, sync: "SYNCED" });
        });
      }
      await this._setMeta("lastPull", pull.serverTime || new Date().toISOString());
      this._emit();
    } finally {
      this._syncing = false;
    }
  }

  async pendingCount() {
    const all = await this.allEntries();
    return all.filter((e) => e.sync === "LOCAL").length;
  }
}
