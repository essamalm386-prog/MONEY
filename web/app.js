/**
 * TDMI Pointage — application PWA.
 *
 * Cinq écrans : Accueil, Pointage, Équipe (planning), Rapports, Profil,
 * plus un écran de bienvenue au premier lancement. Toute la logique métier
 * vit dans `domain.js` (calculs) et `store.js` (IndexedDB + synchro).
 */
import { Store } from "./store.js";
import {
  ABSENCE_LABEL,
  CATEGORY_LABEL,
  KIND_LABEL,
  SEVERITY_LABEL,
  entryCost,
  isoWeekKey,
  minutesToHours,
  monthKey,
  resolveRate,
  totalCost,
  totals,
  weeklyOvertime,
  workedMinutes,
} from "./domain.js";

const store = new Store();
const el = (id) => document.getElementById(id);
const view = () => el("view");

const ROLE_LABEL = { CHEF: "Chef de chantier", CONDUCTEUR: "Conducteur de travaux", ADMIN: "Administrateur" };

const TYPE_LABEL = {
  EMPLOYE: "Salarié",
  INTERIMAIRE: "Intérim",
  STAGIAIRE: "Stagiaire",
  ALTERNANT: "Alternant",
};

const today = () => new Date().toISOString().slice(0, 10);

const state = {
  tab: "accueil",
  date: today(),
  chantierId: "",
  period: "semaine",
  planWeek: today(),
  showAll: false,
  showAllCh: false,
  ref: { chantiers: [], workers: [], agencies: [], assignments: [], costs: [] },
  entries: [],
  users: [],
};

/* ===================================================================== */
/*  Icônes vectorielles (trait 1.8, cohérentes avec la maquette)         */
/* ===================================================================== */

const I = {
  bell: `<svg class="ic" viewBox="0 0 24 24"><path d="M18 8.4a6 6 0 1 0-12 0c0 6-2.5 7.2-2.5 7.2h17S18 14.4 18 8.4"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/></svg>`,
  back: `<svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>`,
  calendar: `<svg class="ic" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/></svg>`,
  clock: `<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  sync: `<svg class="ic" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>`,
  check: `<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.3l2.4 2.4 4.8-5"/></svg>`,
  chevR: `<svg class="ic" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>`,
  doc: `<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9.5 13h6M9.5 17h6"/></svg>`,
  gear: `<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.38 2.54a7 7 0 0 0-2.42 1.4l-2.36-.95-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.14 1.4l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.42 1.4l.38 2.54h3.4l.38-2.54a7 7 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55c.09-.46.14-.92.14-1.4z"/></svg>`,
  plus: `<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  alert: `<svg class="ic" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.6v.1"/></svg>`,
  rain: `<svg class="ic" viewBox="0 0 24 24"><path d="M17.5 13a4.5 4.5 0 0 0-.9-8.9A6 6 0 0 0 5 6.5 4 4 0 0 0 6 14.5h11.5z"/><path d="M8 17l-1 3M12.5 17l-1 3M17 17l-1 3"/></svg>`,
  helmet: `<svg class="ic" viewBox="0 0 24 24"><path d="M4 15a8 8 0 0 1 16 0"/><path d="M2.8 15h18.4v2.6H2.8z"/><path d="M12 5v3"/></svg>`,
};

/** Silhouette de grue (filigrane du bandeau chantier + splash). */
const CRANE = `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
  <path d="M30 112V30M38 112V30"/><path d="M30 40h8M30 56h8M30 72h8M30 88h8M30 104h8"/>
  <path d="M30 34l8 10M38 34l-8 10M30 50l8 10M38 50l-8 10M30 66l8 10M38 66l-8 10M30 82l8 10M38 82l-8 10"/>
  <path d="M14 30h96M34 14l60 16M34 14 14 30M34 14v16"/><path d="M96 30v22M90 52h12M96 74v-22" stroke-dasharray="0"/>
  <path d="M8 112h116" opacity=".6"/></svg>`;

/* ===================================================================== */
/*  Utilitaires                                                          */
/* ===================================================================== */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

function toast(msg, kind = "ok") {
  const t = el("toast");
  t.textContent = msg;
  t.className = `toast show ${kind === "err" ? "err" : "ok"}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 2600);
}

function fmtHM(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}
function fmtEur(n) {
  return `${(Math.round(n * 100) / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}
function fmtDateLong(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "il y a 5 min" / "hier 17:32" pour la dernière synchro. */
function fmtSyncTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDayMonth(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/* Avatar ouvrier casqué (SVG) : fond pastel + teint déterministes, couleur
   de casque selon le statut (intérim orange, salarié bleu, stagiaire violet,
   alternant vert) — écho des photos casquées de la maquette. */
const AV_BG = ["#ffedd2", "#ddeeff", "#e0f5e6", "#efe7fd", "#ffe3e0", "#e4f3f9", "#f4ead8"];
const AV_SKIN = ["#f4c9a4", "#e8b48c", "#c98e5f", "#a9714b", "#8a5a3b", "#6f4630"];
const HELMET = { EMPLOYE: "#1ca9e0", INTERIMAIRE: "#f5a623", STAGIAIRE: "#8a63d2", ALTERNANT: "#2fae5f" };

function avatarFor(w) {
  let h = 0;
  for (const ch of w.id || "x") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AV_BG[h % AV_BG.length];
  const skin = AV_SKIN[(h >> 3) % AV_SKIN.length];
  const hat = HELMET[w.type] || "#98a2b3";
  return `<span class="avatar"><svg viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="22" fill="${bg}"/>
    <path d="M8 44a14 11 0 0 1 28 0z" fill="#5b6b7d"/>
    <circle cx="22" cy="24.5" r="8.2" fill="${skin}"/>
    <path d="M13.2 21.5a8.8 8.8 0 0 1 17.6 0z" fill="${hat}"/>
    <rect x="11.6" y="20.6" width="20.8" height="2.6" rx="1.3" fill="${hat}"/>
  </svg></span>`;
}

function workerById(id) { return state.ref.workers.find((w) => w.id === id); }
function workerName(id) {
  const w = workerById(id);
  return w ? `${w.firstName} ${w.lastName}` : id;
}
function chantierById(id) { return state.ref.chantiers.find((c) => c.id === id); }
function chantierName(id) { return chantierById(id)?.name ?? id; }
function agencyName(id) {
  if (id === "INTERNE" || !id) return "Salariés internes";
  return state.ref.agencies.find((a) => a.id === id)?.name ?? id;
}

function assignedIdsForDate(chantierId, date) {
  const ids = new Set();
  for (const a of state.ref.assignments) {
    if (a.deleted || a.chantierId !== chantierId) continue;
    if (date < a.startDate) continue;
    if (a.endDate && date > a.endDate) continue;
    ids.add(a.workerId);
  }
  return ids;
}

function weekBounds(anyDate) {
  const wd = new Date(anyDate + "T00:00:00Z").getUTCDay();
  const iso = wd === 0 ? 7 : wd;
  const monday = new Date(anyDate + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - (iso - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}
function shiftDate(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function entriesForDate(date, chantierId) {
  return state.entries.filter(
    (e) => !e.deleted && e.date === date && (!chantierId || e.chantierId === chantierId),
  );
}

/* ===================================================================== */
/*  En-tête & bandeau réseau                                             */
/* ===================================================================== */

function renderAppbar() {
  const bar = el("appbar");
  const titles = {
    pointage: "Pointer les heures",
    equipe: "Équipe & planning",
    rapports: "Rapports",
    profil: "Profil",
  };
  if (state.tab === "accueil") {
    const accidentsToday = entriesForDate(today()).filter((e) => e.kind === "ACCIDENT").length;
    bar.className = "appbar";
    bar.innerHTML = `
      <div class="hello">
        <div class="sub">Bonjour,</div>
        <div class="name">${esc(store.userName || "Chef de chantier")} <span>👋</span></div>
      </div>
      <button class="iconbtn" id="hdr-bell" aria-label="Notifications">${I.bell}${accidentsToday ? `<span class="badge-dot"></span>` : ""}</button>`;
    el("hdr-bell").onclick = async () => {
      const p = await store.pendingCount();
      const parts = [];
      if (accidentsToday) parts.push(`${accidentsToday} accident(s) déclaré(s) aujourd'hui`);
      if (p) parts.push(`${p} pointage(s) à synchroniser`);
      toast(parts.join(" · ") || "Aucune notification");
    };
  } else {
    bar.className = "appbar compact";
    bar.innerHTML = `
      <button class="iconbtn plain" id="hdr-back" aria-label="Retour">${I.back}</button>
      <div class="title">${esc(titles[state.tab] ?? "")}</div>
      <button class="iconbtn plain" id="hdr-action" aria-label="${state.tab === "pointage" ? "Calendrier" : "Synchroniser"}">
        ${state.tab === "pointage" ? I.calendar : I.sync}
      </button>`;
    el("hdr-back").onclick = () => setTab("accueil");
    el("hdr-action").onclick = async () => {
      if (state.tab === "pointage") {
        const d = el("f-date");
        if (d) (d.showPicker ? d.showPicker() : d.focus());
        return;
      }
      try {
        await store.sync();
        await reload();
        toast("Synchronisé");
      } catch {
        toast("Serveur hors de portée — synchronisation automatique au dépôt (Wi-Fi)", "err");
      }
    };
  }
}

async function renderNetbar() {
  const bar = el("netbar");
  const pending = await store.pendingCount();
  if (!store.online) {
    bar.hidden = false;
    bar.className = "netbar offline";
    bar.textContent = `Hors-ligne — vos pointages sont enregistrés sur le téléphone${pending ? ` (${pending} en attente)` : ""} et partiront automatiquement au dépôt (Wi-Fi).`;
  } else if (pending > 0 && store.serverReachable === false) {
    bar.hidden = false;
    bar.className = "netbar pending";
    bar.textContent = `${pending} pointage(s) en attente — ils se synchroniseront automatiquement au dépôt (Wi-Fi).`;
  } else if (pending > 0) {
    bar.hidden = false;
    bar.className = "netbar pending";
    bar.textContent = `${pending} pointage(s) en cours de synchronisation…`;
  } else {
    bar.hidden = true;
  }
}

/* ===================================================================== */
/*  Écran de connexion (comptes & rôles)                                 */
/* ===================================================================== */

function showLogin() {
  if (el("login")) return;
  const sp = document.createElement("div");
  sp.className = "splash";
  sp.id = "login";
  sp.innerHTML = `
    <div class="scene" style="color:#9db3c8">
      <div style="position:absolute;right:-12px;bottom:0;width:230px;height:230px">${CRANE}</div>
      <div style="position:absolute;left:-30px;bottom:0;width:170px;height:170px;transform:scaleX(-1)">${CRANE}</div>
    </div>
    <div class="brand"><img src="/icons/tdmi-logo.svg" alt="TDMI" /></div>
    <div class="grow"></div>
    <h1>Le pointage simple pour des chantiers efficaces</h1>
    <p class="lead">Connectez-vous avec le compte fourni par votre administrateur.</p>
    <div class="login-card">
      <label class="f" style="margin-top:0">Identifiant</label>
      <input id="login-user" autocomplete="username" autocapitalize="none" />
      <label class="f">Mot de passe</label>
      <input id="login-pass" type="password" autocomplete="current-password" />
      <div id="login-status" class="hint" style="min-height:18px;color:#ffb3b3"></div>
      <button class="btn block" id="login-btn" style="margin-top:10px">Se connecter</button>
      <button class="link" id="login-config-toggle" style="display:block;margin:12px auto 0;color:#93a7bb">Configuration du serveur (administrateur)</button>
      <div id="login-config" hidden>
        <label class="f">Adresse du serveur</label>
        <input id="login-url" placeholder="http://192.168.1.20:3000" value="${esc(store.apiBase)}" />
        <p class="hint" style="color:#93a7bb">Réservé à l'administrateur, à configurer une seule fois par téléphone. L'adresse est affichée au démarrage du serveur.</p>
      </div>
    </div>`;
  document.body.appendChild(sp);
  const status = sp.querySelector("#login-status");
  const configBox = sp.querySelector("#login-config");
  sp.querySelector("#login-config-toggle").onclick = () => {
    configBox.hidden = !configBox.hidden;
  };

  // Premier lancement sur ce téléphone : si aucun serveur ne répond, on ouvre
  // la configuration (sinon le chef n'a que identifiant + mot de passe).
  store.pingServer().then((ok) => {
    if (!ok && el("login")) {
      configBox.hidden = false;
      if (!status.textContent) {
        status.textContent = store.apiBase
          ? "Le serveur configuré ne répond pas — vérifiez l'adresse ci-dessous."
          : "Première installation : l'administrateur doit renseigner l'adresse du serveur ci-dessous.";
      }
    }
  });

  const submit = async () => {
    const btn = sp.querySelector("#login-btn");
    btn.disabled = true;
    status.textContent = "";
    try {
      const user = await store.login(
        sp.querySelector("#login-url").value.trim(),
        sp.querySelector("#login-user").value.trim(),
        sp.querySelector("#login-pass").value,
      );
      sp.remove();
      await store.refreshReference().catch(() => {});
      await store.sync().catch(() => {});
      await reload();
      toast(`Bienvenue, ${user.displayName}`);
    } catch (err) {
      status.textContent = err.message;
      if (/injoignable|ne pointe pas/i.test(err.message)) configBox.hidden = false;
      btn.disabled = false;
    }
  };
  sp.querySelector("#login-btn").onclick = submit;
  sp.querySelector("#login-pass").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") submit();
  });
}

/* ===================================================================== */
/*  ÉCRAN 1 — ACCUEIL                                                    */
/* ===================================================================== */

function siteCardHtml(label, name, meta) {
  return `
    <button class="site-card" id="pick-site">
      <div class="crane">${CRANE}</div>
      <div class="txt">
        <div class="label">${esc(label)}</div>
        <div class="name">${esc(name)}</div>
        <div class="meta">${esc(meta)}</div>
      </div>
      <span class="chev">${I.chevR}</span>
    </button>`;
}

function renderAccueil() {
  const { chantiers, workers } = state.ref;
  if (!state.chantierId && chantiers[0]) state.chantierId = chantiers[0].id;
  const date = today();
  const ch = chantierById(state.chantierId);

  const assigned = assignedIdsForDate(state.chantierId, date);
  const dayEntries = entriesForDate(date, state.chantierId);
  const byWorker = new Map(dayEntries.map((e) => [e.workerId, e]));

  const team = workers.filter((w) => w.active && assigned.has(w.id));
  const present = dayEntries.filter((e) => (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") && e.minutes > 0).length;
  const absent = dayEntries.filter((e) => e.kind === "ABSENCE").length;
  const totalMin = dayEntries.reduce((s, e) => s + (e.kind === "TRAVAIL" || e.kind === "ACCIDENT" ? e.minutes : 0), 0);
  const notPointed = team.filter((w) => !byWorker.has(w.id)).length;

  const accidents = dayEntries.filter((e) => e.kind === "ACCIDENT");
  const weather = dayEntries.filter((e) => e.kind === "INTEMPERIE");

  view().innerHTML = `
    ${siteCardHtml(
      "Chantier en cours",
      ch ? ch.name : "Aucun chantier",
      ch ? [ch.address, ch.client].filter(Boolean).join(" · ") || ch.code : "Créez un chantier dans Profil",
    )}

    <div class="card">
      <div class="card-head" style="margin-bottom:14px">
        <div>
          <div class="sub">Aujourd'hui</div>
          <h2 style="font-size:17px">${capitalize(fmtDateLong(date))}</h2>
        </div>
        <button class="iconbtn" id="go-date" aria-label="Changer de date">${I.calendar}</button>
      </div>
      <div class="stat-row">
        <div class="stat ok"><div class="v">${present}</div><div class="l">Présents</div></div>
        <div class="stat danger"><div class="v">${absent}</div><div class="l">Absents</div></div>
        <div class="stat"><div class="v">${fmtHM(totalMin)}</div><div class="l">Heures totales</div></div>
      </div>
      <button class="btn block" id="go-point" style="margin-top:14px">
        ${I.clock} Pointer les heures${notPointed ? ` (${notPointed} restant${notPointed > 1 ? "s" : ""})` : ""}
      </button>
    </div>

    ${
      accidents.length || weather.length
        ? `<div class="card">
             <div class="card-head"><h2>Événements du jour</h2></div>
             ${accidents
               .map(
                 (e) => `<div class="rowline">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0">
                      <span style="color:var(--danger)">${I.alert}</span>
                      <div style="min-width:0"><div style="font-weight:700">Accident — ${esc(workerName(e.workerId))}</div>
                      <div class="muted">${esc(SEVERITY_LABEL[e.accidentSeverity] || "")}${e.note ? " · " + esc(e.note) : ""}</div></div>
                    </div>
                    <span class="chip alert">48 h</span>
                  </div>`,
               )
               .join("")}
             ${weather
               .map(
                 (e) => `<div class="rowline">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0">
                      <span style="color:var(--info)">${I.rain}</span>
                      <div style="min-width:0"><div style="font-weight:700">Intempérie — ${esc(workerName(e.workerId))}</div>
                      <div class="muted">${fmtHM(e.minutes)} perdues${e.note ? " · " + esc(e.note) : ""}</div></div>
                    </div>
                    <span class="chip INTEMPERIE">Intempérie</span>
                  </div>`,
               )
               .join("")}
           </div>`
        : ""
    }

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Mon équipe</h2>
          <div class="sub">${team.length} personne${team.length > 1 ? "s" : ""}</div>
        </div>
        <button class="link" id="see-team">Voir tout</button>
      </div>
      ${
        team.length === 0
          ? `<div class="empty">Personne n'est affecté à ce chantier aujourd'hui.<br/>Constituez l'équipe dans l'onglet <strong>Équipe</strong>.</div>`
          : team
              .slice(0, 6)
              .map((w) => {
                const e = byWorker.get(w.id);
                return `<div class="person">
                  ${avatarFor(w)}
                  <div class="who">
                    <div class="n"><span class="txt">${esc(w.firstName)} ${esc(w.lastName)}</span></div>
                    <div class="t">${esc(w.trade || TYPE_LABEL[w.type] || "")}</div>
                  </div>
                  ${entryBadge(e)}
                  <button class="kebab" data-kebab="${w.id}" aria-label="Détails">⋮</button>
                </div>`;
              })
              .join("")
      }
    </div>`;

  el("pick-site").onclick = openSitePicker;
  el("go-date").onclick = () => setTab("pointage");
  el("go-point").onclick = () => setTab("pointage");
  el("see-team").onclick = () => setTab("equipe");
  view().querySelectorAll("[data-kebab]").forEach((b) => {
    b.onclick = () => {
      state.date = today();
      openEntrySheet(b.dataset.kebab);
    };
  });
}

function entryBadge(e) {
  if (!e) return `<span class="chip neutral">Non pointé</span>`;
  if (e.kind === "TRAVAIL") return `<span class="hours ok">${fmtHM(e.minutes)}</span>`;
  if (e.kind === "ACCIDENT") return `<span class="chip ACCIDENT">Accident</span>`;
  if (e.kind === "INTEMPERIE") return `<span class="chip INTEMPERIE">${fmtHM(e.minutes)}</span>`;
  return `<span class="chip ABSENCE">${esc(ABSENCE_LABEL[e.absenceReason] || "Absent")}</span>`;
}

/* ===================================================================== */
/*  ÉCRAN 2 — POINTAGE                                                   */
/* ===================================================================== */

const STEP = 30;
const DEFAULT_MIN = 480;

function renderPointage() {
  const { chantiers, workers } = state.ref;
  if (!state.chantierId && chantiers[0]) state.chantierId = chantiers[0].id;
  const ch = chantierById(state.chantierId);

  const assigned = assignedIdsForDate(state.chantierId, state.date);
  const dayEntries = entriesForDate(state.date, state.chantierId);
  const byWorker = new Map(dayEntries.map((e) => [e.workerId, e]));

  let team = workers.filter((w) => w.active && assigned.has(w.id));
  for (const e of dayEntries) {
    if (!assigned.has(e.workerId)) {
      const w = workerById(e.workerId);
      if (w && !team.includes(w)) team.push(w);
    }
  }
  if (state.showAll) team = workers.filter((w) => w.active);

  const totalMin = dayEntries.reduce((s, e) => s + (e.kind === "TRAVAIL" || e.kind === "ACCIDENT" ? e.minutes : 0), 0);
  const missing = team.filter((w) => !byWorker.has(w.id)).length;

  view().innerHTML = `
    ${siteCardHtml(ch?.code || "Chantier", ch ? ch.name : "Aucun chantier", capitalize(fmtDateLong(state.date)))}

    <div class="card tight">
      <label class="f" style="margin-top:0">Date du pointage</label>
      <input type="date" id="f-date" value="${state.date}" />
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Équipe (${team.length})</h2>
          <div class="sub">${missing} non pointé${missing > 1 ? "s" : ""}</div>
        </div>
        <div style="display:flex;gap:14px;flex:none">
          <button class="link" id="toggle-all">${state.showAll ? "Affectés" : "Tous"}</button>
          <button class="link" id="all-point" ${missing === 0 ? "disabled" : ""}>Tout pointer</button>
        </div>
      </div>
      ${
        team.length === 0
          ? `<div class="empty">Aucune personne affectée à ce chantier ce jour.<br/>
             Affectez l'équipe dans l'onglet <strong>Équipe</strong>, ou « Tous » pour un ajout exceptionnel.</div>`
          : team.map((w) => personRow(w, byWorker.get(w.id), assigned.has(w.id))).join("")
      }
    </div>
    <div style="height:58px"></div>

    <div class="action-bar">
      <div class="inner">
        <button class="btn block" id="finish">${I.check} Enregistrer (${fmtHM(totalMin)})</button>
      </div>
    </div>`;

  el("pick-site").onclick = openSitePicker;
  el("f-date").onchange = (ev) => {
    state.date = ev.target.value || today();
    render();
  };
  el("toggle-all").onclick = () => {
    state.showAll = !state.showAll;
    render();
  };
  el("all-point").onclick = () => pointAll(team, byWorker);
  el("finish").onclick = () => {
    toast(`Journée du ${fmtDayMonth(state.date)} enregistrée — ${fmtHM(totalMin)}`);
    setTab("accueil");
  };

  view().querySelectorAll("[data-step]").forEach((b) => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      adjust(b.dataset.step, Number(b.dataset.delta));
    };
  });
  view().querySelectorAll("[data-detail]").forEach((b) => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      openEntrySheet(b.dataset.detail);
    };
  });
}

function personRow(w, e, isAssigned) {
  // Code couleur maquette : 0h rouge, journée standard encre, durée modifiée orange.
  let cls = "zero";
  let label = "0h00";
  if (e) {
    if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
      label = fmtHM(e.minutes);
      cls = e.minutes === 0 ? "zero" : e.minutes === DEFAULT_MIN ? "" : "warn";
      if (e.kind === "ACCIDENT") {
        label = "Accident";
        cls = "special";
      }
    } else if (e.kind === "INTEMPERIE") {
      label = "Intemp.";
      cls = "special";
    } else {
      label = "Absent";
      cls = "special";
    }
  }
  const canStep = !e || e.kind === "TRAVAIL";
  return `
    <div class="person">
      ${avatarFor(w)}
      <div class="who">
        <div class="n"><span class="txt">${esc(w.firstName)} ${esc(w.lastName)}</span></div>
        <div class="t">${esc(w.trade || "")}${w.trade ? " · " : ""}${TYPE_LABEL[w.type] || ""}
          ${!isAssigned ? `<span class="chip orange">hors équipe</span>` : ""}</div>
      </div>
      <div class="stepper ${cls}">
        <button data-step="${w.id}" data-delta="-1" ${canStep ? "" : "disabled"} aria-label="Retirer 30 minutes">−</button>
        <div class="val" data-detail="${w.id}" title="Détails (absence, intempérie, accident…)">${esc(label)}</div>
        <button data-step="${w.id}" data-delta="1" ${canStep ? "" : "disabled"} aria-label="Ajouter 30 minutes">+</button>
      </div>
    </div>`;
}

async function adjust(workerId, dir) {
  const existing = entriesForDate(state.date, state.chantierId).find((e) => e.workerId === workerId);
  if (existing && existing.kind !== "TRAVAIL") return;
  const base = existing ? existing.minutes : dir > 0 ? DEFAULT_MIN - STEP : STEP;
  let minutes = base + dir * STEP;
  minutes = Math.max(0, Math.min(13 * 60, minutes));
  try {
    await store.saveEntry({
      id: existing?.id,
      workerId,
      chantierId: state.chantierId,
      date: state.date,
      kind: "TRAVAIL",
      minutes,
      recordedBy: store.userName || "chef",
    });
    await reload();
  } catch (err) {
    toast(err.message, "err");
  }
}

async function pointAll(team, byWorker) {
  const todo = team.filter((w) => !byWorker.has(w.id));
  if (!todo.length) return;
  try {
    for (const w of todo) {
      await store.saveEntry({
        workerId: w.id,
        chantierId: state.chantierId,
        date: state.date,
        kind: "TRAVAIL",
        minutes: DEFAULT_MIN,
        startTime: "07:30",
        endTime: "16:30",
        breakMinutes: 60,
        recordedBy: store.userName || "chef",
      });
    }
    await reload();
    toast(`${todo.length} personne(s) pointée(s) à ${fmtHM(DEFAULT_MIN)}`);
  } catch (err) {
    toast(err.message, "err");
  }
}

/* --------------------- Feuille de saisie détaillée --------------------- */

function openEntrySheet(workerId) {
  const w = workerById(workerId);
  const existing = entriesForDate(state.date, state.chantierId).find((e) => e.workerId === workerId);
  let kind = existing?.kind || "TRAVAIL";

  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="sheet">
      <div class="grab"></div>
      <h3>${esc(w ? w.firstName + " " + w.lastName : "")}</h3>
      <div class="sheet-sub">${esc(w?.trade || "")} · ${capitalize(fmtDateLong(state.date))}</div>
      <label class="f">Nature de la journée</label>
      <div class="seg" id="seg-kind">
        ${["TRAVAIL", "INTEMPERIE", "ABSENCE", "ACCIDENT"]
          .map((k) => `<button data-k="${k}" class="${k === kind ? "on" : ""}">${KIND_LABEL[k]}</button>`)
          .join("")}
      </div>
      <div id="fields"></div>
      <div class="sheet-actions">
        ${existing ? `<button class="btn ghost" id="del">Supprimer</button>` : ""}
        <button class="btn ghost" id="cancel">Annuler</button>
        <button class="btn" id="save">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();

  const fields = ov.querySelector("#fields");
  const paint = () => (fields.innerHTML = fieldsFor(kind, existing));
  paint();

  ov.querySelectorAll("#seg-kind button").forEach((b) => {
    b.onclick = () => {
      kind = b.dataset.k;
      ov.querySelectorAll("#seg-kind button").forEach((x) => x.classList.toggle("on", x === b));
      paint();
    };
  });
  ov.querySelector("#cancel").onclick = close;
  ov.onclick = (ev) => ev.target === ov && close();

  if (existing) {
    ov.querySelector("#del").onclick = async () => {
      await store.deleteEntry(existing.id);
      await reload();
      close();
      toast("Pointage supprimé");
    };
  }

  ov.querySelector("#save").onclick = async () => {
    try {
      const payload = collectFields(kind, ov, workerId, existing);
      await store.saveEntry(payload);
      await reload();
      close();
      toast("Pointage enregistré");
    } catch (err) {
      toast(err.message, "err");
    }
  };
}

function fieldsFor(kind, e) {
  if (kind === "TRAVAIL") {
    return `
      <div class="grid2">
        <div><label class="f">Début</label><input type="time" id="start" value="${e?.startTime || "07:30"}" /></div>
        <div><label class="f">Fin</label><input type="time" id="end" value="${e?.endTime || "16:30"}" /></div>
      </div>
      <label class="f">Pause (minutes)</label>
      <input type="number" id="break" min="0" step="5" value="${e?.breakMinutes ?? 60}" />
      <p class="hint">Les heures supplémentaires sont calculées à la semaine (35 h, puis +25 % et +50 %).</p>`;
  }
  if (kind === "INTEMPERIE") {
    return `
      <label class="f">Heures perdues</label>
      <input type="number" id="hours" min="0" step="0.5" value="${e?.minutes ? minutesToHours(e.minutes) : 4}" />
      <label class="f">Motif</label>
      <textarea id="note" rows="2" placeholder="Pluie, gel, vent…">${esc(e?.note || "")}</textarea>
      <p class="hint">Chômage-intempéries : 1re heure en franchise, le reste indemnisé à 75 %.</p>`;
  }
  if (kind === "ABSENCE") {
    return `
      <label class="f">Motif d'absence</label>
      <select id="reason">
        ${Object.entries(ABSENCE_LABEL)
          .map(([k, v]) => `<option value="${k}" ${e?.absenceReason === k ? "selected" : ""}>${v}</option>`)
          .join("")}
      </select>
      <label class="f">Commentaire</label>
      <textarea id="note" rows="2">${esc(e?.note || "")}</textarea>`;
  }
  return `
    <label class="f">Gravité</label>
    <select id="severity">
      ${Object.entries(SEVERITY_LABEL)
        .map(([k, v]) => `<option value="${k}" ${e?.accidentSeverity === k ? "selected" : ""}>${v}</option>`)
        .join("")}
    </select>
    <label class="f">Heures travaillées avant l'arrêt</label>
    <input type="number" id="hours" min="0" step="0.5" value="${e?.minutes ? minutesToHours(e.minutes) : 0}" />
    <label class="f">Circonstances</label>
    <textarea id="note" rows="3" placeholder="Nature, partie du corps, tiers impliqué…">${esc(e?.note || "")}</textarea>
    <p class="hint">La déclaration d'accident du travail doit être transmise sous 48 h.</p>`;
}

function collectFields(kind, ov, workerId, existing) {
  const v = (sel) => ov.querySelector(sel)?.value;
  const base = {
    id: existing?.id,
    workerId,
    chantierId: state.chantierId,
    date: state.date,
    kind,
    recordedBy: store.userName || "chef",
  };
  if (kind === "TRAVAIL") {
    const minutes = workedMinutes(v("#start"), v("#end"), Number(v("#break") || 0));
    if (minutes <= 0) throw new Error("La durée doit être supérieure à zéro");
    return { ...base, minutes, startTime: v("#start"), endTime: v("#end"), breakMinutes: Number(v("#break") || 0) };
  }
  if (kind === "INTEMPERIE") {
    const minutes = Math.round(Number(v("#hours")) * 60);
    if (minutes <= 0) throw new Error("Précisez les heures perdues");
    return { ...base, minutes, note: v("#note") };
  }
  if (kind === "ABSENCE") {
    return { ...base, minutes: 0, absenceReason: v("#reason"), note: v("#note") };
  }
  return {
    ...base,
    minutes: Math.round(Number(v("#hours") || 0) * 60),
    accidentSeverity: v("#severity"),
    note: v("#note"),
  };
}

function openSitePicker() {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="sheet">
      <div class="grab"></div>
      <h3>Choisir le chantier</h3>
      <div class="sheet-sub">${state.ref.chantiers.length} chantier(s)</div>
      ${
        state.ref.chantiers.length === 0
          ? `<div class="empty">Aucun chantier. Créez-en un dans l'onglet Profil.</div>`
          : state.ref.chantiers
              .map(
                (c) => `<div class="person tappable" data-ch="${c.id}">
                  <span class="avatar"><svg viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="22" fill="${c.id === state.chantierId ? "#fff4e2" : "#eef2f6"}"/>
                    <g transform="translate(10 10) scale(0.2)" stroke="${c.id === state.chantierId ? "#d97f00" : "#667085"}">${CRANE.replace(/<\/?svg[^>]*>/g, "")}</g>
                  </svg></span>
                  <div class="who"><div class="n"><span class="txt">${esc(c.name)}</span></div>
                  <div class="t">${esc([c.code, c.client].filter(Boolean).join(" · "))}</div></div>
                  ${c.id === state.chantierId ? `<span class="chip orange">Actuel</span>` : ""}
                </div>`,
              )
              .join("")
      }
      <div class="sheet-actions"><button class="btn ghost" id="cancel">Fermer</button></div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector("#cancel").onclick = close;
  ov.onclick = (ev) => ev.target === ov && close();
  ov.querySelectorAll("[data-ch]").forEach((r) => {
    r.onclick = () => {
      state.chantierId = r.dataset.ch;
      close();
      render();
    };
  });
}

/* ===================================================================== */
/*  ÉCRAN 3 — ÉQUIPE (affectations & remplacements)                      */
/* ===================================================================== */

function renderEquipe() {
  const { chantiers, assignments, workers } = state.ref;
  if (!state.chantierId && chantiers[0]) state.chantierId = chantiers[0].id;
  const { from, to } = weekBounds(state.planWeek);
  const offline = !store.online;

  const weekAsg = assignments.filter(
    (a) => !a.deleted && a.chantierId === state.chantierId && a.startDate <= to && (!a.endDate || a.endDate >= from),
  );
  const activeIds = new Set(weekAsg.filter((a) => a.status === "ACTIVE").map((a) => a.workerId));
  const available = workers.filter((w) => w.active && !activeIds.has(w.id));

  view().innerHTML = `
    ${siteCardHtml(
      "Planning du chantier",
      chantierName(state.chantierId),
      `${isoWeekKey(state.planWeek).replace(/^\d+-W/, "Semaine ")} · ${fmtDayMonth(from)} → ${fmtDayMonth(to)}`,
    )}

    <div class="card tight">
      <label class="f" style="margin-top:0">Semaine (choisir un jour)</label>
      <input type="date" id="pl-week" value="${state.planWeek}" />
      <p class="hint">Le conducteur de travaux compose l'équipe pour la semaine. Les chefs ne pointent que le personnel affecté.</p>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Équipe affectée</h2><div class="sub">${activeIds.size} active(s) · ${weekAsg.length} ligne(s)</div></div>
      </div>
      ${
        weekAsg.length === 0
          ? `<div class="empty">Aucune affectation cette semaine.</div>`
          : weekAsg
              .slice()
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((a) => {
                const w = workerById(a.workerId);
                const ended = a.status === "ENDED";
                return `<div class="person">
                  ${w ? avatarFor(w) : ""}
                  <div class="who">
                    <div class="n"><span class="txt">${esc(w ? w.firstName + " " + w.lastName : a.workerId)}</span></div>
                    <div class="t">
                      ${fmtDayMonth(a.startDate)} → ${a.endDate ? fmtDayMonth(a.endDate) : "…"}
                      ${a.replacesWorkerId ? `<span class="chip INTEMPERIE">remplaçant</span>` : ""}
                      ${ended ? `<span class="chip neutral">clôturée</span>` : ""}
                    </div>
                  </div>
                  ${!ended && store.canManage ? `<button class="btn ghost sm" data-rep="${a.id}" ${offline ? "disabled" : ""}>Remplacer</button>` : ""}
                </div>`;
              })
              .join("")
      }
    </div>

    ${
      !store.canManage
        ? `<div class="card"><p class="muted" style="margin:0">Le planning est géré par le conducteur de travaux ou l'administrateur. Vous pointez le personnel affecté ci-dessus.</p></div>`
        : `<div class="card">
      <div class="card-head"><h2>Affecter une personne</h2></div>
      ${
        available.length === 0
          ? `<div class="empty">Tout le personnel disponible est déjà affecté.</div>`
          : `<label class="f" style="margin-top:0">Personne</label>
             <select id="pl-worker">${available
               .map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)} — ${TYPE_LABEL[w.type]}${w.trade ? " · " + esc(w.trade) : ""}</option>`)
               .join("")}</select>
             <button class="btn block" id="pl-add" style="margin-top:12px" ${offline ? "disabled" : ""}>${I.plus} Affecter pour la semaine</button>
             ${offline ? `<p class="hint">Le planning nécessite une connexion.</p>` : ""}`
      }
    </div>`
    }`;

  el("pick-site").onclick = openSitePicker;
  el("pl-week").onchange = (ev) => {
    state.planWeek = ev.target.value || today();
    render();
  };
  const add = el("pl-add");
  if (add) {
    add.onclick = async () => {
      try {
        await store.addAssignment({
          workerId: el("pl-worker").value,
          chantierId: state.chantierId,
          anyDate: state.planWeek,
          assignedBy: store.userName || "conducteur",
        });
        await reload();
        toast("Personne affectée");
      } catch (err) {
        toast(err.message, "err");
      }
    };
  }
  view().querySelectorAll("[data-rep]").forEach((b) => {
    b.onclick = () => openReplaceSheet(b.dataset.rep, weekAsg);
  });
}

function openReplaceSheet(assignmentId, weekAsg) {
  const asg = weekAsg.find((a) => a.id === assignmentId);
  if (!asg) return;
  const leaving = workerById(asg.workerId);
  const candidates = state.ref.workers.filter((w) => w.active && w.id !== asg.workerId);

  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="sheet">
      <div class="grab"></div>
      <h3>Remplacer ${esc(leaving ? leaving.firstName + " " + leaving.lastName : "")}</h3>
      <div class="sheet-sub">Affectation du ${fmtDayMonth(asg.startDate)} au ${asg.endDate ? fmtDayMonth(asg.endDate) : "…"}</div>
      <label class="f">Remplaçant</label>
      <select id="rep-worker">${candidates
        .map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)} — ${TYPE_LABEL[w.type]}${w.trade ? " · " + esc(w.trade) : ""}</option>`)
        .join("")}</select>
      <label class="f">À partir du</label>
      <input type="date" id="rep-date" value="${state.date}" min="${asg.startDate}" ${asg.endDate ? `max="${asg.endDate}"` : ""} />
      <label class="f">Motif</label>
      <input id="rep-note" placeholder="Arrêt maladie, fin de mission…" />
      <p class="hint">L'affectation en cours sera clôturée la veille ; le remplaçant prend le relais à partir de cette date.</p>
      <div class="sheet-actions">
        <button class="btn ghost" id="cancel">Annuler</button>
        <button class="btn" id="ok">Valider</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector("#cancel").onclick = close;
  ov.onclick = (ev) => ev.target === ov && close();
  ov.querySelector("#ok").onclick = async () => {
    try {
      await store.replaceAssignment(assignmentId, {
        newWorkerId: ov.querySelector("#rep-worker").value,
        fromDate: ov.querySelector("#rep-date").value,
        assignedBy: store.userName || "conducteur",
        note: ov.querySelector("#rep-note").value,
      });
      await reload();
      close();
      toast("Remplacement enregistré");
    } catch (err) {
      toast(err.message, "err");
    }
  };
}

/* ===================================================================== */
/*  ÉCRAN 4 — RAPPORTS                                                   */
/* ===================================================================== */

function periodRange(refDate = state.date) {
  if (state.period === "jour") return { from: refDate, to: refDate, label: capitalize(fmtDateLong(refDate)) };
  if (state.period === "semaine") {
    const { from, to } = weekBounds(refDate);
    return { from, to, label: `${isoWeekKey(refDate).replace(/^\d+-W/, "Semaine ")} · ${fmtDayMonth(from)} → ${fmtDayMonth(to)}` };
  }
  const from = refDate.slice(0, 7) + "-01";
  const [y, m] = refDate.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to, label: `Mois de ${monthKey(refDate)}` };
}

/** Date de référence de la période précédente (pour la variation). */
function previousRef() {
  if (state.period === "jour") return shiftDate(state.date, -1);
  if (state.period === "semaine") return shiftDate(state.date, -7);
  const [y, m] = state.date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 10);
}

function workedMinutesIn(from, to) {
  return state.entries
    .filter((e) => !e.deleted && e.date >= from && e.date <= to && (e.kind === "TRAVAIL" || e.kind === "ACCIDENT"))
    .reduce((s, e) => s + e.minutes, 0);
}

const PREV_LABEL = { jour: "vs veille", semaine: "vs semaine dernière", mois: "vs mois dernier" };

function renderRapports() {
  const { from, to, label } = periodRange();
  const inRange = state.entries.filter((e) => !e.deleted && e.date >= from && e.date <= to);
  const t = totals(inRange);
  const cost = totalCost(inRange, state.ref.workers, state.ref.costs);

  // Variation vs période précédente (pastille verte/rouge comme la maquette).
  const prev = periodRange(previousRef());
  const prevMin = workedMinutesIn(prev.from, prev.to);
  let deltaHtml = "";
  if (prevMin > 0) {
    const pct = Math.round(((t.workedMinutes - prevMin) / prevMin) * 100);
    deltaHtml = `<span class="delta ${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "↑" : "↓"} ${pct >= 0 ? "+" : ""}${pct}%</span>`;
  }

  // Barres de la semaine avec axe des heures.
  const { from: wFrom } = weekBounds(state.date);
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const dayTotals = days.map((lb, i) => {
    const iso = shiftDate(wFrom, i);
    return { lb, iso, mins: workedMinutesIn(iso, iso) };
  });
  const maxDay = Math.max(...dayTotals.map((d) => d.mins), 60);
  const axisMax = Math.max(1, Math.ceil(maxDay / 60)); // heures entières
  const axisMid = Math.round(axisMax / 2);

  // Par chantier.
  const perCh = new Map();
  for (const e of inRange) {
    if (e.kind !== "TRAVAIL" && e.kind !== "ACCIDENT") continue;
    perCh.set(e.chantierId, (perCh.get(e.chantierId) || 0) + e.minutes);
  }
  const chRows = [...perCh.entries()].sort((a, b) => b[1] - a[1]);
  const maxCh = Math.max(1, ...chRows.map((r) => r[1]));
  const chShown = state.showAllCh ? chRows : chRows.slice(0, 3);

  // Présence.
  const nbPresent = inRange.filter((e) => (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") && e.minutes > 0).length;
  const nbAbsent = inRange.filter((e) => e.kind === "ABSENCE").length;
  const nbWeather = inRange.filter((e) => e.kind === "INTEMPERIE").length;

  view().innerHTML = `
    <div class="card tight">
      <div class="seg" id="seg-period">
        ${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]]
          .map(([k, v]) => `<button data-p="${k}" class="${state.period === k ? "on" : ""}">${v}</button>`)
          .join("")}
      </div>
      <label class="f">Date de référence</label>
      <input type="date" id="rp-date" value="${state.date}" />
      <p class="hint">${esc(label)}</p>
    </div>

    <div class="card">
      <div class="card-head" style="margin-bottom:6px"><h2>Heures totales</h2></div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div id="rp-total-hours" style="font-size:33px;font-weight:800;letter-spacing:-0.035em">${fmtHM(t.workedMinutes)}</div>
        ${deltaHtml}
      </div>
      <div class="muted" style="margin:2px 0 14px">${PREV_LABEL[state.period]}</div>
      <div class="chart">
        <div class="yaxis"><span>${axisMax}h</span><span>${axisMid}h</span><span>0h</span></div>
        <div class="bars">
          <div class="grid"><i></i><i></i><i></i></div>
          ${dayTotals
            .map(
              (d) => `<div class="b ${d.iso === state.date ? "on" : ""}">
                <div class="track"><div class="fill" style="height:${Math.round((d.mins / (axisMax * 60)) * 100)}%"></div></div>
                <div class="lb">${d.lb}</div>
              </div>`,
            )
            .join("")}
        </div>
      </div>
      <div class="stat-row four" style="margin-top:14px">
        <div class="stat ok"><div class="v">${nbPresent}</div><div class="l">Présences</div></div>
        <div class="stat danger"><div class="v">${t.absenceDays}</div><div class="l">Absences</div></div>
        <div class="stat info"><div class="v">${fmtHM(t.weatherMinutes)}</div><div class="l">Intempéries</div></div>
        <div class="stat warn"><div class="v">${t.accidentCount}</div><div class="l">Accidents</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Par chantier</h2>
        ${chRows.length > 3 ? `<button class="link" id="ch-all">${state.showAllCh ? "Réduire" : "Voir tout"}</button>` : ""}
      </div>
      ${
        chShown.length === 0
          ? `<div class="empty">Aucune heure sur la période.</div>`
          : chShown
              .map(
                ([id, mins]) => `<div class="meter">
                  <div class="top"><span class="nm">${esc(chantierName(id))}</span><span class="vl">${fmtHM(mins)}</span></div>
                  <div class="track"><div class="fill" style="width:${Math.round((mins / maxCh) * 100)}%"></div></div>
                </div>`,
              )
              .join("")
      }
    </div>

    <div class="card">
      <div class="card-head"><h2>Présence</h2></div>
      ${donutCard([
        { label: "Présents", value: nbPresent, color: "#17a34a" },
        { label: "Absents", value: nbAbsent, color: "#ef4444" },
        { label: "Intempéries", value: nbWeather, color: "#f5a623" },
      ])}
    </div>

    ${personTable(inRange)}
    ${store.isAdmin ? costCard(cost, inRange) : ""}
    ${store.isAdmin ? exportCard() : ""}`;

  view().querySelectorAll("#seg-period button").forEach((b) => {
    b.onclick = () => {
      state.period = b.dataset.p;
      render();
    };
  });
  el("rp-date").onchange = (ev) => {
    state.date = ev.target.value || today();
    render();
  };
  const chAll = el("ch-all");
  if (chAll) {
    chAll.onclick = () => {
      state.showAllCh = !state.showAllCh;
      render();
    };
  }
  bindExports();
}

function donutCard(items) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return `<div class="empty">Aucune donnée sur la période.</div>`;
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = items
    .filter((i) => i.value > 0)
    .map((i) => {
      const len = (i.value / total) * C;
      const seg = `<circle cx="59" cy="59" r="${R}" fill="none" stroke="${i.color}" stroke-width="16"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 59 59)" />`;
      offset += len;
      return seg;
    })
    .join("");
  return `
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r="${R}" fill="none" stroke="#eef2f6" stroke-width="16" />
        ${arcs}
        <text x="59" y="64" text-anchor="middle" font-size="19" font-weight="800" fill="#101828" font-family="inherit">${total}</text>
      </svg>
      <div class="legend">
        ${items
          .map(
            (i) => `<div class="li"><span class="dot" style="background:${i.color}"></span>
              <span class="lb">${i.label}</span>
              <span class="vl">${total ? Math.round((i.value / total) * 100) : 0}% (${i.value})</span></div>`,
          )
          .join("")}
      </div>
    </div>`;
}

function personTable(entries) {
  const map = new Map();
  for (const e of entries) {
    let r = map.get(e.workerId);
    if (!r) {
      r = { worked: 0, weather: 0, abs: 0, acc: 0 };
      map.set(e.workerId, r);
    }
    if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") r.worked += e.minutes;
    if (e.kind === "INTEMPERIE") r.weather += e.minutes;
    if (e.kind === "ABSENCE") r.abs += 1;
    if (e.kind === "ACCIDENT") r.acc += 1;
  }
  const rows = [...map.entries()].sort((a, b) => b[1].worked - a[1].worked);
  if (!rows.length) return "";
  const showOt = state.period === "semaine";
  return `
    <div class="card">
      <div class="card-head"><h2>Par personne</h2>${showOt ? `<span class="sub">avec heures sup.</span>` : ""}</div>
      <div class="table-scroll">
        <table>
          <thead><tr>
            <th>Personne</th><th class="num">Travail</th><th class="num">Intemp.</th>
            <th class="num">Abs.</th>${showOt ? `<th class="num">Sup. +25%</th><th class="num">Sup. +50%</th>` : ""}
          </tr></thead>
          <tbody>
            ${rows
              .map(([id, r]) => {
                const ot = weeklyOvertime(r.worked);
                const w = workerById(id);
                return `<tr>
                  <td>${esc(workerName(id))}${w ? ` <span class="chip ${w.type}">${TYPE_LABEL[w.type]}</span>` : ""}</td>
                  <td class="num">${fmtHM(r.worked)}</td>
                  <td class="num">${r.weather ? fmtHM(r.weather) : "—"}</td>
                  <td class="num">${r.abs || "—"}</td>
                  ${showOt ? `<td class="num">${ot.tier1Minutes ? fmtHM(ot.tier1Minutes) : "—"}</td><td class="num">${ot.tier2Minutes ? fmtHM(ot.tier2Minutes) : "—"}</td>` : ""}
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function costCard(cost, entries) {
  if (cost.total <= 0) return "";
  const perCh = new Map();
  for (const e of entries) {
    const c = entryCost(e, resolveRate(e.workerId, e.chantierId, state.ref.workers, state.ref.costs));
    perCh.set(e.chantierId, (perCh.get(e.chantierId) || 0) + c.total);
  }
  return `
    <div class="card">
      <div class="card-head"><h2>Coût estimé</h2><span class="sub">vue admin</span></div>
      <div id="rp-total-cost" style="font-size:28px;font-weight:800;letter-spacing:-0.03em;margin-bottom:12px">${fmtEur(cost.total)}</div>
      <div class="stat-row four">
        <div class="stat"><div class="v" style="font-size:15px">${fmtEur(cost.labor)}</div><div class="l">Main d'œuvre</div></div>
        <div class="stat"><div class="v" style="font-size:15px">${fmtEur(cost.meal)}</div><div class="l">Paniers</div></div>
        <div class="stat"><div class="v" style="font-size:15px">${fmtEur(cost.travel)}</div><div class="l">Déplacements</div></div>
        <div class="stat"><div class="v" style="font-size:15px">${fmtEur(cost.weather)}</div><div class="l">Intempéries</div></div>
      </div>
      <div class="divider"></div>
      ${[...perCh.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, v]) => `<div class="rowline"><span>${esc(chantierName(id))}</span><strong>${fmtEur(v)}</strong></div>`)
        .join("")}
    </div>`;
}

function exportCard() {
  return `
    <div class="card">
      <div class="card-head"><h2>Relevés PDF</h2><span class="sub">facturation & paie</span></div>
      <label class="f" style="margin-top:0">Mois</label>
      <input type="month" id="exp-month" value="${monthKey(state.date)}" />
      <p class="hint" style="margin:10px 0 4px">Filtres du relevé de facturation intérim :</p>
      <div class="grid3">
        <select id="exp-agency"><option value="">Toutes agences</option>${state.ref.agencies
          .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
          .join("")}</select>
        <select id="exp-chantier"><option value="">Tous chantiers</option>${state.ref.chantiers
          .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
          .join("")}</select>
        <select id="exp-category"><option value="">Toutes catégories</option>${Object.entries(CATEGORY_LABEL)
          .map(([k, v]) => `<option value="${k}">${v}</option>`)
          .join("")}</select>
      </div>
      <button class="btn block" id="exp-interim" style="margin-top:12px" ${!store.online ? "disabled" : ""}>
        ${I.doc} Relevé facturation intérim (ETT)
      </button>
      <button class="btn ghost block" id="exp-salaried" style="margin-top:8px" ${!store.online ? "disabled" : ""}>
        ${I.doc} Relevé salariés / stagiaires / alternants
      </button>
      ${!store.online ? `<p class="hint">Connexion requise pour générer les PDF.</p>` : ""}
    </div>`;
}

/**
 * Télécharge un PDF via l'API authentifiée (les jetons ne passent pas par
 * window.open : on récupère le fichier puis on le propose au téléchargement).
 * Toute erreur s'affiche en toast au lieu d'une page d'erreur.
 */
async function downloadPdf(path, filename) {
  toast("Génération du relevé…");
  try {
    const res = await store.authFetch(path);
    if (!res.ok) {
      let msg = `Erreur serveur (${res.status})`;
      try {
        msg = (await res.json()).error || msg;
      } catch {
        /* réponse non JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    toast("Relevé PDF téléchargé");
  } catch (err) {
    const msg = /fetch/i.test(err.message)
      ? "Serveur injoignable — vérifiez l'adresse dans Réglages"
      : err.message;
    toast(msg, "err");
  }
}

function bindExports() {
  const int = el("exp-interim");
  if (!int) return; // cartes admin absentes pour les autres rôles
  const month = () => el("exp-month").value || monthKey(state.date);
  int.onclick = () => {
    const q = new URLSearchParams({ month: month() });
    if (el("exp-agency").value) q.set("agencyId", el("exp-agency").value);
    if (el("exp-chantier").value) q.set("chantierId", el("exp-chantier").value);
    if (el("exp-category").value) q.set("category", el("exp-category").value);
    downloadPdf(`/api/reports/interim.pdf?${q}`, `releve-interim-${month()}.pdf`);
  };
  el("exp-salaried").onclick = () =>
    downloadPdf(`/api/reports/salaried.pdf?month=${month()}`, `releve-salaries-${month()}.pdf`);
}

/* ===================================================================== */
/*  ÉCRAN 5 — PROFIL & RÉFÉRENTIEL                                       */
/* ===================================================================== */

function renderProfil() {
  const { chantiers, workers, agencies, costs } = state.ref;
  const offline = !store.online;
  const byType = (t) => workers.filter((w) => w.type === t).length;

  view().innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Mon compte</h2><span class="chip ${store.role === "ADMIN" ? "ACCIDENT" : store.role === "CONDUCTEUR" ? "INTEMPERIE" : "TRAVAIL"}">${ROLE_LABEL[store.role] || store.role}</span></div>
      <div class="rowline"><span>Nom</span><strong>${esc(store.userName || "—")}</strong></div>
      <div class="rowline"><span>Identifiant</span><span class="muted">${esc(store.username || "—")}</span></div>
      <div class="grid2" style="margin-top:12px">
        <button class="btn ghost" id="change-pass">Mot de passe</button>
        <button class="btn ghost" id="logout" style="color:var(--danger)">Se déconnecter</button>
      </div>
    </div>

    ${store.isAdmin ? usersCard() : ""}

    <div class="card">
      <div class="card-head"><h2>Synchronisation</h2></div>
      <div class="rowline">
        <span>État</span>
        <strong style="color:${!store.online ? "var(--danger)" : store.serverReachable === false ? "var(--warn)" : "var(--ok)"}">
          ${!store.online ? "Hors-ligne" : store.serverReachable === false ? "Serveur hors de portée" : "Connecté"}
        </strong>
      </div>
      <div class="rowline"><span>Dernière synchronisation</span><span class="muted">${store.lastSyncAt ? esc(fmtSyncTime(store.lastSyncAt)) : "jamais"}</span></div>
      <div class="rowline"><span>Pointages en attente</span><strong id="pending-count">…</strong></div>
      <p class="hint">La synchronisation est automatique : au dépôt (Wi-Fi), les pointages partent tout seuls.</p>
      <button class="btn ghost block" id="sync-now" style="margin-top:12px">${I.sync} Synchroniser maintenant</button>
      ${store.isAdmin ? `<div class="rowline" style="margin-top:6px"><span>Adresse du serveur</span><span class="muted">${esc(store.apiBase || "même origine")}</span></div>
      <button class="btn ghost block" id="open-settings" style="margin-top:8px">${I.gear} Modifier l'adresse (admin)</button>` : ""}
    </div>

    <div class="card">
      <div class="card-head"><h2>Personnel</h2><span class="sub">${workers.length} personne(s)</span></div>
      <div class="stat-row four">
        <div class="stat info"><div class="v">${byType("EMPLOYE")}</div><div class="l">Salariés</div></div>
        <div class="stat warn"><div class="v">${byType("INTERIMAIRE")}</div><div class="l">Intérim</div></div>
        <div class="stat"><div class="v">${byType("STAGIAIRE")}</div><div class="l">Stagiaires</div></div>
        <div class="stat ok"><div class="v">${byType("ALTERNANT")}</div><div class="l">Alternants</div></div>
      </div>
      <div class="divider"></div>
      ${
        workers.length === 0
          ? `<div class="empty">Aucune personne enregistrée.</div>`
          : workers
              .slice(0, 6)
              .map(
                (w) => `<div class="person">${avatarFor(w)}
                  <div class="who"><div class="n"><span class="txt">${esc(w.firstName)} ${esc(w.lastName)}</span></div>
                  <div class="t">${esc(w.trade || "")}${w.category ? " · " + esc(CATEGORY_LABEL[w.category] || w.category) : ""}${w.agencyId ? " · " + esc(agencyName(w.agencyId)) : ""}</div></div>
                  <span class="chip ${w.type}">${TYPE_LABEL[w.type]}</span>
                </div>`,
              )
              .join("") + (workers.length > 6 ? `<div class="muted" style="margin-top:8px">+ ${workers.length - 6} autre(s)</div>` : "")
      }
      ${store.canManage ? `<button class="btn block" id="add-worker" style="margin-top:12px" ${offline ? "disabled" : ""}>${I.plus} Ajouter une personne</button>` : ""}
    </div>

    <div class="card">
      <div class="card-head"><h2>Chantiers</h2><span class="sub">${chantiers.length}</span></div>
      ${
        chantiers.length === 0
          ? `<div class="empty">Aucun chantier.</div>`
          : chantiers
              .map(
                (c) => `<div class="rowline"><div><div style="font-weight:700">${esc(c.name)}</div>
                  <div class="muted">${esc([c.code, c.client, c.address].filter(Boolean).join(" · "))}</div></div></div>`,
              )
              .join("")
      }
      ${store.canManage ? `<button class="btn block" id="add-chantier" style="margin-top:12px" ${offline ? "disabled" : ""}>${I.plus} Ajouter un chantier</button>` : ""}
    </div>

    <div class="card">
      <div class="card-head"><h2>Agences d'intérim</h2><span class="sub">${agencies.length}</span></div>
      ${
        agencies.length === 0
          ? `<div class="empty">Aucune agence.</div>`
          : agencies.map((a) => `<div class="rowline"><span>${esc(a.name)}</span><span class="muted">${esc(a.contact || "")}</span></div>`).join("")
      }
      ${store.canManage ? `<button class="btn block" id="add-agency" style="margin-top:12px" ${offline ? "disabled" : ""}>${I.plus} Ajouter une agence</button>` : ""}
    </div>

    ${store.isAdmin ? `<div class="card">
      <div class="card-head"><h2>Coûts par chantier</h2><span class="sub">${costs.length} grille(s)</span></div>
      <p class="muted">Ce que coûte une personne selon le chantier : taux horaire, panier repas, indemnité de déplacement et prix unitaires (heures sup., fériées, intempéries).</p>
      ${costs
        .slice(0, 6)
        .map(
          (c) => `<div class="rowline"><div><div style="font-weight:700">${esc(workerName(c.workerId))}</div>
            <div class="muted">${esc(chantierName(c.chantierId))} · ${c.hourlyRate ? fmtEur(c.hourlyRate) + "/h · " : ""}panier ${fmtEur(c.mealAllowance || 0)} · dépl. ${fmtEur(c.travelAllowance || 0)}</div></div></div>`,
        )
        .join("")}
      <button class="btn block" id="add-cost" style="margin-top:12px" ${offline ? "disabled" : ""}>${I.plus} Définir un coût</button>
    </div>` : ""}`;

  store.pendingCount().then((n) => {
    const c = el("pending-count");
    if (c) c.textContent = String(n);
  });
  const settingsBtn = el("open-settings");
  if (settingsBtn) settingsBtn.onclick = openSettings;
  el("sync-now").onclick = async () => {
    try {
      await store.sync();
      await reload();
      toast("Synchronisé");
    } catch {
      toast("Serveur hors de portée — nouvelle tentative automatique au dépôt (Wi-Fi)", "err");
    }
  };
  el("change-pass").onclick = openPasswordSheet;
  el("logout").onclick = async () => {
    await store.logout();
    toast("Déconnecté");
  };
  const bind = (id, fn) => {
    const n = el(id);
    if (n) n.onclick = fn;
  };
  bind("add-worker", openWorkerSheet);
  bind("add-chantier", openChantierSheet);
  bind("add-agency", openAgencySheet);
  bind("add-cost", openCostSheet);
  bind("add-user", openUserSheet);
  view().querySelectorAll("[data-user]").forEach((r) => {
    r.onclick = () => openUserEditSheet(r.dataset.user);
  });
}

/* --------------------------- Feuilles Profil --------------------------- */

function sheet(title, sub, body, onSave) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="sheet">
      <div class="grab"></div>
      <h3>${esc(title)}</h3>
      ${sub ? `<div class="sheet-sub">${esc(sub)}</div>` : ""}
      ${body}
      <div class="sheet-actions">
        <button class="btn ghost" id="cancel">Annuler</button>
        <button class="btn" id="ok">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector("#cancel").onclick = close;
  ov.onclick = (ev) => ev.target === ov && close();
  ov.querySelector("#ok").onclick = async () => {
    try {
      await onSave(ov);
      await reload();
      close();
      toast("Enregistré");
    } catch (err) {
      toast(err.message, "err");
    }
  };
  return ov;
}

const val = (ov, sel) => ov.querySelector(sel)?.value.trim();
const numVal = (ov, sel) => {
  const n = Number(ov.querySelector(sel)?.value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function openWorkerSheet() {
  sheet(
    "Nouvelle personne",
    "Salarié, intérimaire, stagiaire ou alternant",
    `<div class="grid2">
       <div><label class="f">Prénom</label><input id="w-first" /></div>
       <div><label class="f">Nom</label><input id="w-last" /></div>
     </div>
     <div class="grid2">
       <div><label class="f">Statut</label><select id="w-type">${Object.entries(TYPE_LABEL)
         .map(([k, v]) => `<option value="${k}">${v}</option>`)
         .join("")}</select></div>
       <div><label class="f">Catégorie</label><select id="w-cat">${Object.entries(CATEGORY_LABEL)
         .map(([k, v]) => `<option value="${k}">${v}</option>`)
         .join("")}</select></div>
     </div>
     <div class="grid2">
       <div><label class="f">Métier</label><input id="w-trade" placeholder="Maçon, coffreur…" /></div>
       <div><label class="f">Taux horaire (€/h)</label><input id="w-rate" type="number" step="0.5" min="0" /></div>
     </div>
     <label class="f">Agence (si intérimaire)</label>
     <select id="w-agency"><option value="">—</option>${state.ref.agencies
       .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
       .join("")}</select>`,
    async (ov) => {
      if (!val(ov, "#w-first") || !val(ov, "#w-last")) throw new Error("Prénom et nom requis");
      await store.addWorker({
        firstName: val(ov, "#w-first"),
        lastName: val(ov, "#w-last"),
        type: val(ov, "#w-type"),
        category: val(ov, "#w-cat"),
        trade: val(ov, "#w-trade"),
        hourlyRate: numVal(ov, "#w-rate"),
        agencyId: val(ov, "#w-agency") || undefined,
      });
    },
  );
}

function openChantierSheet() {
  sheet(
    "Nouveau chantier",
    "",
    `<div class="grid2">
       <div><label class="f">Code</label><input id="c-code" placeholder="LY-2026-01" /></div>
       <div><label class="f">Nom</label><input id="c-name" placeholder="Résidence…" /></div>
     </div>
     <label class="f">Client</label><input id="c-client" />
     <label class="f">Adresse</label><input id="c-addr" />`,
    async (ov) => {
      if (!val(ov, "#c-code") || !val(ov, "#c-name")) throw new Error("Code et nom requis");
      await store.addChantier({
        code: val(ov, "#c-code"),
        name: val(ov, "#c-name"),
        client: val(ov, "#c-client"),
        address: val(ov, "#c-addr"),
      });
    },
  );
}

function openAgencySheet() {
  sheet(
    "Nouvelle agence d'intérim",
    "",
    `<label class="f">Nom</label><input id="a-name" />
     <label class="f">Contact</label><input id="a-contact" placeholder="Téléphone, e-mail…" />`,
    async (ov) => {
      if (!val(ov, "#a-name")) throw new Error("Nom requis");
      await store.addAgency({ name: val(ov, "#a-name"), contact: val(ov, "#a-contact") });
    },
  );
}

function openCostSheet() {
  sheet(
    "Coût d'une personne sur un chantier",
    "Les prix unitaires non renseignés sont calculés automatiquement (+25 %, +50 %, férié ×2, intempérie ×0,75).",
    `<div class="grid2">
       <div><label class="f">Personne</label><select id="co-worker">${state.ref.workers
         .map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)}</option>`)
         .join("")}</select></div>
       <div><label class="f">Chantier</label><select id="co-chantier">${state.ref.chantiers
         .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
         .join("")}</select></div>
     </div>
     <div class="grid3">
       <div><label class="f">€/h normale</label><input id="co-rate" type="number" step="0.5" min="0" /></div>
       <div><label class="f">Panier €/j</label><input id="co-meal" type="number" step="0.5" min="0" /></div>
       <div><label class="f">Dépl. €/j</label><input id="co-travel" type="number" step="0.5" min="0" /></div>
     </div>
     <p class="hint">Prix unitaires spécifiques (optionnels) :</p>
     <div class="grid2">
       <div><label class="f">€/h +25 %</label><input id="co-ot25" type="number" step="0.5" min="0" /></div>
       <div><label class="f">€/h +50 %</label><input id="co-ot50" type="number" step="0.5" min="0" /></div>
     </div>
     <div class="grid2">
       <div><label class="f">€/h férié</label><input id="co-holiday" type="number" step="0.5" min="0" /></div>
       <div><label class="f">€/h intempérie</label><input id="co-weather" type="number" step="0.5" min="0" /></div>
     </div>`,
    async (ov) => {
      await store.addCost({
        workerId: val(ov, "#co-worker"),
        chantierId: val(ov, "#co-chantier"),
        hourlyRate: numVal(ov, "#co-rate"),
        mealAllowance: numVal(ov, "#co-meal"),
        travelAllowance: numVal(ov, "#co-travel"),
        overtime25Rate: numVal(ov, "#co-ot25"),
        overtime50Rate: numVal(ov, "#co-ot50"),
        holidayRate: numVal(ov, "#co-holiday"),
        weatherRate: numVal(ov, "#co-weather"),
      });
    },
  );
}

/* ------------------------ Comptes & rôles (admin) ---------------------- */

function usersCard() {
  const users = state.users || [];
  return `
    <div class="card">
      <div class="card-head"><h2>Comptes & rôles</h2><span class="sub">${users.length} compte(s)</span></div>
      ${
        users.length === 0
          ? `<div class="empty">Liste indisponible hors-ligne.</div>`
          : users
              .map(
                (u) => `<div class="rowline" data-user="${u.id}" style="cursor:pointer">
                  <div><div style="font-weight:700">${esc(u.displayName)}${u.active ? "" : ` <span class="chip neutral">désactivé</span>`}</div>
                  <div class="muted">${esc(u.username)}</div></div>
                  <span class="chip ${u.role === "ADMIN" ? "ACCIDENT" : u.role === "CONDUCTEUR" ? "INTEMPERIE" : "TRAVAIL"}">${ROLE_LABEL[u.role]}</span>
                </div>`,
              )
              .join("")
      }
      <button class="btn block" id="add-user" style="margin-top:12px" ${store.online ? "" : "disabled"}>${I.plus} Créer un compte</button>
      <p class="hint">Chef : pointe son équipe. Conducteur : + planning et référentiel. Admin : + coûts, relevés PDF et comptes.</p>
    </div>`;
}

function openUserSheet() {
  sheet(
    "Nouveau compte",
    "L'identifiant et le mot de passe seront communiqués à la personne.",
    `<div class="grid2">
       <div><label class="f">Nom affiché</label><input id="u-name" placeholder="Karim Benali" /></div>
       <div><label class="f">Identifiant</label><input id="u-username" autocapitalize="none" placeholder="kbenali" /></div>
     </div>
     <label class="f">Rôle</label>
     <select id="u-role">${Object.entries(ROLE_LABEL)
       .map(([k, v]) => `<option value="${k}">${v}</option>`)
       .join("")}</select>
     <label class="f">Mot de passe</label>
     <input id="u-pass" type="text" placeholder="4 caractères minimum" />`,
    async (ov) => {
      const r = await store.authFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          displayName: val(ov, "#u-name"),
          username: val(ov, "#u-username"),
          role: val(ov, "#u-role"),
          password: ov.querySelector("#u-pass").value,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Erreur serveur");
    },
  );
}

function openUserEditSheet(userId) {
  const u = (state.users || []).find((x) => x.id === userId);
  if (!u) return;
  sheet(
    u.displayName,
    `${u.username} · ${ROLE_LABEL[u.role]}`,
    `<label class="f">Rôle</label>
     <select id="ue-role">${Object.entries(ROLE_LABEL)
       .map(([k, v]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${v}</option>`)
       .join("")}</select>
     <label class="f">Nouveau mot de passe (laisser vide pour ne pas changer)</label>
     <input id="ue-pass" type="text" />
     <label class="f">Statut du compte</label>
     <select id="ue-active"><option value="1" ${u.active ? "selected" : ""}>Actif</option><option value="0" ${u.active ? "" : "selected"}>Désactivé</option></select>`,
    async (ov) => {
      const body = { role: val(ov, "#ue-role"), active: val(ov, "#ue-active") === "1" };
      const pass = ov.querySelector("#ue-pass").value;
      if (pass) body.password = pass;
      const r = await store.authFetch(`/api/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Erreur serveur");
    },
  );
}

function openPasswordSheet() {
  sheet(
    "Changer mon mot de passe",
    "",
    `<label class="f">Mot de passe actuel</label>
     <input id="pw-cur" type="password" autocomplete="current-password" />
     <label class="f">Nouveau mot de passe</label>
     <input id="pw-new" type="password" autocomplete="new-password" placeholder="4 caractères minimum" />`,
    async (ov) => {
      const r = await store.authFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: ov.querySelector("#pw-cur").value,
          newPassword: ov.querySelector("#pw-new").value,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Erreur serveur");
    },
  );
}

/* ----------------------------- Réglages -------------------------------- */

function openSettings() {
  if (!store.isAdmin) {
    toast("Réglages du serveur réservés à l'administrateur", "err");
    return;
  }
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="sheet">
      <div class="grab"></div>
      <h3>Réglages</h3>
      <div class="sheet-sub">Connecté : ${esc(store.userName || "—")} (${esc(ROLE_LABEL[store.role] || "")})</div>
      <label class="f">Adresse du serveur</label>
      <input id="set-url" placeholder="https://pointage.tdmi.fr" value="${esc(store.apiBase)}" />
      <p class="hint">Laissez vide si l'application et le serveur sont à la même adresse (usage web). Sur mobile, indiquez l'URL de votre serveur.</p>
      <div id="set-status" class="hint"></div>
      <div class="sheet-actions">
        <button class="btn ghost" id="cancel">Fermer</button>
        <button class="btn ghost" id="sync">Synchroniser</button>
        <button class="btn" id="save">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  const status = ov.querySelector("#set-status");
  ov.querySelector("#cancel").onclick = close;
  ov.onclick = (ev) => ev.target === ov && close();

  ov.querySelector("#save").onclick = async () => {
    store.setApiBase(ov.querySelector("#set-url").value.trim());
    status.textContent = "Test de connexion…";
    try {
      const r = await fetch(store.api("/api/health"));
      const j = await r.json();
      status.style.color = "var(--ok)";
      status.textContent = j.ok ? "✅ Connecté au serveur." : "Réponse inattendue.";
      await store.refreshReference();
      await store.sync();
      await reload();
    } catch {
      status.style.color = "var(--danger)";
      status.textContent = "❌ Serveur injoignable — les données locales restent disponibles hors-ligne.";
    }
  };
  ov.querySelector("#sync").onclick = async () => {
    status.style.color = "var(--muted)";
    status.textContent = "Synchronisation…";
    try {
      await store.sync();
      await reload();
      status.style.color = "var(--ok)";
      status.textContent = "✅ Synchronisé.";
    } catch {
      status.style.color = "var(--danger)";
      status.textContent = "❌ Échec de synchronisation.";
    }
  };
}

/* ===================================================================== */
/*  Routeur & amorçage                                                   */
/* ===================================================================== */

const VIEWS = {
  accueil: renderAccueil,
  pointage: renderPointage,
  equipe: renderEquipe,
  rapports: renderRapports,
  profil: renderProfil,
};

function render() {
  renderAppbar();
  (VIEWS[state.tab] || renderAccueil)();
  renderNetbar();
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  window.scrollTo(0, 0);
  render();
}

async function reload() {
  state.ref = await store.reference();
  state.entries = await store.allEntries();
  if (store.isAdmin && store.online) {
    try {
      const r = await store.authFetch("/api/users");
      if (r.ok) state.users = await r.json();
    } catch {
      /* hors-ligne : on garde la dernière liste */
    }
  }
  render();
}

async function main() {
  document.querySelectorAll(".tabbar button").forEach((b) => {
    b.onclick = () => setTab(b.dataset.tab);
  });

  await store.init();
  await reload();
  store.onChange(reload);
  store.onAuthChange(() => {
    if (!store.loggedIn) showLogin();
  });
  if (!store.loggedIn) showLogin();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

main();
