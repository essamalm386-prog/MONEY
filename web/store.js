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
    // Base de l'API. Vide = même origine (PWA/web). Sur l'app Android empaquetée,
    // on configure l'URL du serveur (ex. https://pointage.tdmi.fr) via l'écran
    // de réglages, persistée dans localStorage.
    this.apiBase = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
    // Session : jeton + identité + rôle, persistés pour rester connecté
    // (et pouvoir travailler hors-ligne avec les données locales).
    const ls = (k) => (typeof localStorage !== "undefined" && localStorage.getItem(k)) || "";
    this.token = ls("authToken");
    this.role = ls("authRole");
    this.userName = ls("userName");
    this.username = ls("authUsername");
    this.workerId = ls("authWorkerId");
    this.authListeners = new Set();
    // État de la synchronisation automatique : le serveur n'est joignable
    // qu'au dépôt (Wi-Fi) — hors de portée, on réessaie sans déranger le chef.
    this.serverReachable = null; // null = inconnu, true/false après tentative
    this.lastSyncAt = ls("lastSyncAt");
  }

  get loggedIn() {
    return Boolean(this.token);
  }
  get isAdmin() {
    return this.role === "ADMIN";
  }
  get canManage() {
    return this.role === "ADMIN" || this.role === "CONDUCTEUR";
  }

  onAuthChange(fn) {
    this.authListeners.add(fn);
    return () => this.authListeners.delete(fn);
  }
  _emitAuth() {
    for (const fn of this.authListeners) fn();
  }

  _saveSession() {
    try {
      localStorage.setItem("authToken", this.token || "");
      localStorage.setItem("authRole", this.role || "");
      localStorage.setItem("userName", this.userName || "");
      localStorage.setItem("authUsername", this.username || "");
      localStorage.setItem("authWorkerId", this.workerId || "");
    } catch {
      /* stockage indisponible */
    }
  }

  /** Connexion : enregistre l'URL du serveur puis ouvre une session. */
  async login(base, username, password) {
    this.setApiBase(base);

    // Vérifie d'abord qu'on parle bien au serveur TDMI Pointage : un site
    // statique (hébergement de fichiers, mauvaise URL, portail Wi-Fi…) peut
    // répondre « 200 » avec du HTML et provoquer des erreurs incompréhensibles.
    let health = null;
    try {
      const h = await this._fetchTimeout(this.api("/api/health"));
      health = await h.json().catch(() => null);
    } catch {
      throw new Error(
        "Serveur injoignable à cette adresse. Vérifiez que le serveur est démarré, " +
          "que le téléphone est sur le même réseau Wi-Fi, et que l'adresse est celle " +
          "affichée au démarrage du serveur.",
      );
    }
    if (!health || health.ok !== true) {
      throw new Error(
        "Cette adresse ne pointe pas vers le serveur TDMI Pointage. " +
          "Saisissez l'adresse affichée au démarrage du serveur (ex. http://192.168.1.20:3000).",
      );
    }

    let res;
    try {
      res = await this._fetchTimeout(this.api("/api/auth/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("Serveur injoignable — vérifiez l'adresse du serveur");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Connexion refusée");
    if (!body.token || !body.user || !body.user.role) {
      throw new Error(
        "Réponse inattendue du serveur — sa version est peut-être trop ancienne, mettez-la à jour.",
      );
    }
    this.token = body.token;
    this.role = body.user.role;
    this.userName = body.user.displayName;
    this.username = body.user.username;
    this.workerId = body.user.workerId || "";
    this._saveSession();
    // Récupère le périmètre (chantiers du chef) juste après la connexion.
    this.refreshMe().catch(() => {});
    this._emitAuth();
    return body.user;
  }

  async logout() {
    try {
      await this.authFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* le serveur peut être injoignable : on se déconnecte quand même */
    }
    this.token = "";
    this.role = "";
    this.username = "";
    this._saveSession();
    this._emitAuth();
  }

  /** Session invalide côté serveur : on repasse à l'écran de connexion. */
  _sessionLost() {
    this.token = "";
    this.role = "";
    this._saveSession();
    this._emitAuth();
  }

  /** fetch authentifié : ajoute le jeton, détecte les sessions expirées. */
  async authFetch(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (opts.body && !headers["content-type"]) headers["content-type"] = "application/json";
    const res = await fetch(this.api(path), { ...opts, headers });
    if (res.status === 401 && this.token) this._sessionLost();
    return res;
  }

  setUserName(name) {
    this.userName = (name || "").trim();
    this._saveSession();
  }

  setApiBase(url) {
    this.apiBase = (url || "").replace(/\/$/, "");
    try {
      localStorage.setItem("apiBase", this.apiBase);
    } catch {
      /* stockage indisponible */
    }
  }
  api(path) {
    return this.apiBase + path;
  }

  async init() {
    this.db = await openIDB();
    window.addEventListener("online", () => this._setOnline(true));
    window.addEventListener("offline", () => this._setOnline(false));
    // Retour au dépôt : rejoindre le Wi-Fi ne déclenche pas toujours
    // l'événement « online » (le téléphone était déjà en 4G). On synchronise
    // donc aussi périodiquement et à chaque retour de l'app au premier plan.
    setInterval(() => this._autoSync(), 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this._autoSync();
    });
    await this.refreshReference().catch(() => {});
    this._autoSync();
  }

  /** Tentative silencieuse : jamais d'erreur affichée au chef. */
  _autoSync() {
    this.sync()
      .then(() => this.refreshReference())
      .catch(() => {});
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
    if (!this.online || !this.token) return this._cachedReference();
    // Chaque liste est tolérante à l'échec (ex. /api/costs renvoie 403 pour un
    // chef : les coûts sont réservés aux admins) — on garde alors le cache.
    const load = async (path) => {
      try {
        const r = await this.authFetch(path);
        if (!r.ok) return null;
        const data = await r.json();
        // On n'accepte que des listes : toute autre réponse (HTML, erreur…)
        // est ignorée pour ne pas corrompre le cache hors-ligne.
        return Array.isArray(data) ? data : null;
      } catch {
        return null;
      }
    };
    const [chantiers, workers, agencies, assignments, costs] = await Promise.all([
      load("/api/chantiers"),
      load("/api/workers"),
      load("/api/agencies"),
      load("/api/assignments"),
      load("/api/costs"),
    ]);
    const cached = await this._cachedReference();
    const merged = {
      chantiers: chantiers ?? cached.chantiers,
      workers: workers ?? cached.workers,
      agencies: agencies ?? cached.agencies,
      assignments: assignments ?? cached.assignments,
      costs: costs ?? cached.costs,
    };
    await tx(this.db, "ref", "readwrite", (s) => {
      for (const [key, value] of Object.entries(merged)) s.put({ key, value });
    });
    return merged;
  }

  async _cachedReference() {
    const rows = await tx(this.db, "ref", "readonly", (s) => getAll(s));
    const by = Object.fromEntries((await rows).map((r) => [r.key, r.value]));
    return {
      chantiers: by.chantiers || [],
      workers: by.workers || [],
      agencies: by.agencies || [],
      assignments: by.assignments || [],
      costs: by.costs || [],
    };
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
  async addCost(payload) {
    return this._postRef("/api/costs", "costs", payload);
  }
  async addAssignment(payload) {
    return this._postRef("/api/assignments", "assignments", payload);
  }
  async replaceAssignment(assignmentId, payload) {
    return this._postRef(`/api/assignments/${assignmentId}/replace`, "assignments", payload);
  }
  /** Roster : personnes affectées à un chantier une date donnée. */
  async roster(chantierId, date) {
    const { assignments, workers } = await this.reference();
    const ids = new Set();
    for (const a of assignments) {
      if (a.deleted || a.chantierId !== chantierId) continue;
      if (date < a.startDate) continue;
      if (a.endDate && date > a.endDate) continue;
      ids.add(a.workerId);
    }
    return workers.filter((w) => ids.has(w.id));
  }
  async _postRef(url, key, payload) {
    if (!this.online) throw new Error("Connexion requise pour modifier le référentiel");
    const res = await this.authFetch(url, {
      method: "POST",
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
    if (!this.online || !this.token || this._syncing) return;
    this._syncing = true;
    try {
      const all = await this.allEntries();
      const dirty = all.filter((e) => e.sync === "LOCAL");
      if (dirty.length) {
        const res = await this.authFetch("/api/sync/push", {
          method: "POST",
          body: JSON.stringify({ entries: dirty }),
        }).then((r) => r.json());
        const acked = new Set([...(res.applied || []), ...(res.conflicts || [])]);
        await tx(this.db, "entries", "readwrite", (s) => {
          for (const e of dirty) if (acked.has(e.id)) s.put({ ...e, sync: "SYNCED" });
        });
      }

      const since = (await this._meta("lastPull")) || "1970-01-01T00:00:00.000Z";
      const pull = await this.authFetch(`/api/sync/pull?since=${encodeURIComponent(since)}`).then(
        (r) => r.json(),
      );
      if (pull.entries && pull.entries.length) {
        await tx(this.db, "entries", "readwrite", (s) => {
          for (const remote of pull.entries) s.put({ ...remote, sync: "SYNCED" });
        });
      }
      await this._setMeta("lastPull", pull.serverTime || new Date().toISOString());
      this.serverReachable = true;
      this.lastSyncAt = new Date().toISOString();
      try {
        localStorage.setItem("lastSyncAt", this.lastSyncAt);
      } catch {
        /* stockage indisponible */
      }
    } catch (err) {
      // Hors de portée du serveur (4G sur chantier, serveur éteint…) :
      // les pointages restent en attente, on réessaiera automatiquement.
      this.serverReachable = false;
      throw err;
    } finally {
      this._syncing = false;
      this._emit();
    }
  }

  /** Rafraîchit l'identité et le périmètre du compte connecté. */
  async refreshMe() {
    const r = await this.authFetch("/api/auth/me");
    if (!r.ok) return null;
    const me = await r.json();
    this.workerId = me.workerId || "";
    this.role = me.role || this.role;
    this._saveSession();
    return me;
  }

  /** fetch avec délai maximal : une adresse injoignable répond en ~6 s, pas 30. */
  _fetchTimeout(url, opts = {}, ms = 6000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(timer));
  }

  /** Le serveur configuré répond-il comme un serveur TDMI Pointage ? */
  async pingServer(base = this.apiBase) {
    try {
      const url = (base || "").replace(/\/$/, "") + "/api/health";
      const r = await this._fetchTimeout(url);
      const j = await r.json().catch(() => null);
      return Boolean(j && j.ok === true);
    } catch {
      return false;
    }
  }

  async pendingCount() {
    const all = await this.allEntries();
    return all.filter((e) => e.sync === "LOCAL").length;
  }
}
