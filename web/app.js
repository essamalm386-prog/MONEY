/**
 * TDMI Pointage — application PWA.
 *
 * Cinq écrans : Accueil, Pointage, Équipe (planning), Rapports, Profil.
 * Toute la logique métier vit dans `domain.js` (calculs) et `store.js`
 * (persistance locale IndexedDB + synchronisation serveur).
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
  period: "semaine", // rapports : jour | semaine | mois
  planWeek: today(),
  showAll: false, // pointage : afficher hors affectation
  ref: { chantiers: [], workers: [], agencies: [], assignments: [], costs: [] },
  entries: [],
};

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

/** Minutes → "8h00" / "7h30" (format terrain). */
function fmtHM(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}
/** Minutes → "8,5 h" (format synthèse). */
function fmtH(minutes) {
  return `${minutesToHours(minutes).toLocaleString("fr-FR")} h`;
}
function fmtEur(n) {
  return `${(Math.round(n * 100) / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}
function fmtDateLong(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "2026-07-27" → "27/07" (affichage compact des périodes). */
function fmtDayMonth(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const AVATAR_COLORS = ["#e08600", "#1ca9e0", "#16a34a", "#6d4bc4", "#e5484d", "#0b7fae", "#c2410c"];
function avatarFor(w) {
  const initials = `${(w.firstName || "?")[0]}${(w.lastName || "")[0] || ""}`.toUpperCase();
  let hash = 0;
  for (const ch of w.id || initials) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const helmet = { EMPLOYE: "#1ca9e0", INTERIMAIRE: "#f39200", STAGIAIRE: "#6d4bc4", ALTERNANT: "#16a34a" }[w.type] || "#8b95a7";
  return `<div class="avatar" style="background:${bg}">${esc(initials)}<span class="helmet" style="background:${helmet}"></span></div>`;
}

function workerById(id) {
  return state.ref.workers.find((w) => w.id === id);
}
function workerName(id) {
  const w = workerById(id);
  return w ? `${w.firstName} ${w.lastName}` : id;
}
function chantierById(id) {
  return state.ref.chantiers.find((c) => c.id === id);
}
function chantierName(id) {
  return chantierById(id)?.name ?? id;
}
function agencyName(id) {
  if (id === "INTERNE" || !id) return "Salariés internes";
  return state.ref.agencies.find((a) => a.id === id)?.name ?? id;
}

/** Personnes affectées à un chantier une date donnée. */
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

/** Bornes lundi→dimanche de la semaine contenant `anyDate`. */
function weekBounds(anyDate) {
  const wd = new Date(anyDate + "T00:00:00Z").getUTCDay();
  const iso = wd === 0 ? 7 : wd;
  const monday = new Date(anyDate + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - (iso - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
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
    profil: "Profil & réglages",
  };
  if (state.tab === "accueil") {
    bar.className = "appbar";
    bar.innerHTML = `
      <div class="hello">
        <div class="sub">Bonjour,</div>
        <div class="name">${esc(store.userName || "Chef de chantier")} <span>👋</span></div>
      </div>
      <button class="iconbtn" id="hdr-settings" title="Réglages" aria-label="Réglages">⚙️</button>`;
    el("hdr-settings").onclick = openSettings;
  } else {
    bar.className = "appbar compact";
    bar.innerHTML = `
      <img class="logo" src="/icons/tdmi-logo.svg" alt="TDMI" />
      <div class="title">${esc(titles[state.tab] ?? "")}</div>
      <button class="iconbtn" id="hdr-sync" title="Synchroniser" aria-label="Synchroniser">⟳</button>`;
    el("hdr-sync").onclick = async () => {
      try {
        await store.sync();
        await reload();
        toast("Synchronisé");
      } catch {
        toast("Synchronisation impossible", "err");
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
    bar.innerHTML = `🔌 Hors-ligne — la saisie reste possible, elle sera synchronisée au retour du réseau${pending ? ` (${pending} en attente)` : ""}.`;
  } else if (pending > 0) {
    bar.hidden = false;
    bar.className = "netbar pending";
    bar.innerHTML = `⟳ ${pending} pointage(s) en cours de synchronisation…`;
  } else {
    bar.hidden = true;
  }
}

/* ===================================================================== */
/*  ÉCRAN 1 — ACCUEIL                                                    */
/* ===================================================================== */

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

  // Alertes du jour : accidents déclarés, intempéries
  const accidents = dayEntries.filter((e) => e.kind === "ACCIDENT");
  const weather = dayEntries.filter((e) => e.kind === "INTEMPERIE");

  view().innerHTML = `
    <button class="site-card" id="pick-site">
      <div class="ic">🏗️</div>
      <div class="txt">
        <div class="label">Chantier en cours</div>
        <div class="name">${ch ? esc(ch.name) : "Aucun chantier"}</div>
        <div class="meta">${ch ? esc([ch.code, ch.address, ch.client].filter(Boolean).join(" · ")) : "Créez un chantier dans Profil"}</div>
      </div>
      <div class="chev">›</div>
    </button>

    <div class="card">
      <div class="card-head">
        <div>
          <div class="sub">Aujourd'hui</div>
          <h2>${capitalize(fmtDateLong(date))}</h2>
        </div>
        <button class="iconbtn" id="go-date" title="Changer de date">📅</button>
      </div>
      <div class="stat-row">
        <div class="stat ok"><div class="v">${present}</div><div class="l">Présents</div></div>
        <div class="stat danger"><div class="v">${absent}</div><div class="l">Absents</div></div>
        <div class="stat navy"><div class="v">${fmtHM(totalMin)}</div><div class="l">Heures totales</div></div>
      </div>
      <button class="btn block" id="go-point" style="margin-top:14px">
        🕒 Pointer les heures${notPointed ? ` (${notPointed} restant${notPointed > 1 ? "s" : ""})` : ""}
      </button>
    </div>

    ${
      accidents.length || weather.length
        ? `<div class="card">
             <div class="card-head"><h2>Événements du jour</h2></div>
             ${accidents
               .map(
                 (e) => `<div class="rowline">
                    <div><div style="font-weight:650">⚠️ Accident — ${esc(workerName(e.workerId))}</div>
                    <div class="muted">${esc(SEVERITY_LABEL[e.accidentSeverity] || "")}${e.note ? " · " + esc(e.note) : ""}</div></div>
                    <span class="chip alert">48 h</span>
                  </div>`,
               )
               .join("")}
             ${weather
               .map(
                 (e) => `<div class="rowline">
                    <div><div style="font-weight:650">🌧️ Intempérie — ${esc(workerName(e.workerId))}</div>
                    <div class="muted">${fmtHM(e.minutes)} perdues${e.note ? " · " + esc(e.note) : ""}</div></div>
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
          <div class="sub">${team.length} personne${team.length > 1 ? "s" : ""} affectée${team.length > 1 ? "s" : ""}</div>
        </div>
        <button class="link" id="see-team">Voir tout</button>
      </div>
      ${
        team.length === 0
          ? `<div class="empty"><span class="ic">👷</span>Personne n'est affecté à ce chantier aujourd'hui.<br/>Constituez l'équipe dans l'onglet <strong>Équipe</strong>.</div>`
          : team
              .slice(0, 5)
              .map((w) => {
                const e = byWorker.get(w.id);
                return `<div class="person">
                  ${avatarFor(w)}
                  <div class="who">
                    <div class="n"><span class="txt">${esc(w.firstName)} ${esc(w.lastName)}</span></div>
                    <div class="t">${esc(w.trade || TYPE_LABEL[w.type] || "")}</div>
                  </div>
                  ${entryBadge(e)}
                </div>`;
              })
              .join("")
      }
    </div>`;

  el("pick-site").onclick = openSitePicker;
  el("go-date").onclick = () => setTab("pointage");
  el("go-point").onclick = () => setTab("pointage");
  el("see-team").onclick = () => setTab("equipe");
}

/** Pastille d'état d'un pointage (liste d'accueil). */
function entryBadge(e) {
  if (!e) return `<span class="chip neutral">Non pointé</span>`;
  if (e.kind === "TRAVAIL") return `<strong style="color:var(--ok)">${fmtHM(e.minutes)}</strong>`;
  if (e.kind === "ACCIDENT") return `<span class="chip ACCIDENT">Accident</span>`;
  if (e.kind === "INTEMPERIE") return `<span class="chip INTEMPERIE">${fmtHM(e.minutes)}</span>`;
  return `<span class="chip ABSENCE">${esc(ABSENCE_LABEL[e.absenceReason] || "Absent")}</span>`;
}

/* ===================================================================== */
/*  ÉCRAN 2 — POINTAGE                                                   */
/* ===================================================================== */

const STEP = 30; // pas du stepper, en minutes
const DEFAULT_MIN = 480; // journée type : 8 h

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
    <button class="site-card" id="pick-site">
      <div class="ic">🏗️</div>
      <div class="txt">
        <div class="label">${ch ? esc(ch.code || "Chantier") : "Chantier"}</div>
        <div class="name">${ch ? esc(ch.name) : "Aucun chantier"}</div>
        <div class="meta">${capitalize(fmtDateLong(state.date))}</div>
      </div>
      <div class="chev">›</div>
    </button>

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
          ? `<div class="empty"><span class="ic">👷</span>Aucune personne affectée à ce chantier ce jour.<br/>
             Affectez l'équipe dans l'onglet <strong>Équipe</strong>, ou utilisez « Tous » pour un ajout exceptionnel.</div>`
          : team.map((w) => personRow(w, byWorker.get(w.id), assigned.has(w.id))).join("")
      }
    </div>
    <div style="height:56px"></div>

    <div class="action-bar">
      <div class="inner">
        <button class="btn block" id="finish">✓ Journée enregistrée — ${fmtHM(totalMin)}</button>
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
    toast(`Journée du ${state.date} : ${fmtHM(totalMin)}`);
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
  let cls = "zero";
  let label = "0h00";
  if (e) {
    if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") {
      label = fmtHM(e.minutes);
      cls = e.kind === "ACCIDENT" ? "special" : e.minutes >= 420 ? "ok" : e.minutes > 0 ? "warn" : "zero";
      if (e.kind === "ACCIDENT") label = "Accident";
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

/** Incrémente / décrémente les heures d'un ouvrier (enregistrement immédiat). */
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

/** Pointe d'un coup toutes les personnes non encore pointées (journée type). */
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
      <p class="hint">Les heures supplémentaires sont calculées automatiquement à la semaine (35 h, puis +25 % et +50 %).</p>`;
  }
  if (kind === "INTEMPERIE") {
    return `
      <label class="f">Heures perdues</label>
      <input type="number" id="hours" min="0" step="0.5" value="${e?.minutes ? minutesToHours(e.minutes) : 4}" />
      <label class="f">Motif</label>
      <textarea id="note" rows="2" placeholder="Pluie, gel, vent…">${esc(e?.note || "")}</textarea>
      <p class="hint">Chômage-intempéries : la 1re heure est en franchise, le reste est indemnisé à 75 %.</p>`;
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
    <p class="hint">⚠️ La déclaration d'accident du travail doit être transmise sous 48 h.</p>`;
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

/** Sélecteur de chantier. */
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
          ? `<div class="empty"><span class="ic">🏗️</span>Aucun chantier. Créez-en un dans l'onglet Profil.</div>`
          : state.ref.chantiers
              .map(
                (c) => `<div class="person tappable" data-ch="${c.id}">
                  <div class="avatar" style="background:${c.id === state.chantierId ? "var(--orange)" : "#8b95a7"}">🏗</div>
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
    <button class="site-card" id="pick-site">
      <div class="ic">🏗️</div>
      <div class="txt">
        <div class="label">Planning du chantier</div>
        <div class="name">${esc(chantierName(state.chantierId))}</div>
        <div class="meta">${isoWeekKey(state.planWeek).replace(/^\d+-W/, "Semaine ")} · ${fmtDayMonth(from)} → ${fmtDayMonth(to)}</div>
      </div>
      <div class="chev">›</div>
    </button>

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
          ? `<div class="empty"><span class="ic">📋</span>Aucune affectation cette semaine.</div>`
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
                  ${!ended ? `<button class="btn ghost sm" data-rep="${a.id}" ${offline ? "disabled" : ""}>Remplacer</button>` : ""}
                </div>`;
              })
              .join("")
      }
    </div>

    <div class="card">
      <div class="card-head"><h2>Affecter une personne</h2></div>
      ${
        available.length === 0
          ? `<div class="empty">Tout le personnel disponible est déjà affecté.</div>`
          : `<label class="f" style="margin-top:0">Personne</label>
             <select id="pl-worker">${available
               .map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)} — ${TYPE_LABEL[w.type]}${w.trade ? " · " + esc(w.trade) : ""}</option>`)
               .join("")}</select>
             <button class="btn block" id="pl-add" style="margin-top:12px" ${offline ? "disabled" : ""}>+ Affecter pour la semaine</button>
             ${offline ? `<p class="hint">🔌 Le planning nécessite une connexion.</p>` : ""}`
      }
    </div>`;

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
      <div class="sheet-sub">Affectation du ${asg.startDate} au ${asg.endDate || "…"}</div>
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

function periodRange() {
  if (state.period === "jour") return { from: state.date, to: state.date, label: capitalize(fmtDateLong(state.date)) };
  if (state.period === "semaine") {
    const { from, to } = weekBounds(state.date);
    return { from, to, label: `${isoWeekKey(state.date).replace(/^\d+-W/, "Semaine ")} · ${from} → ${to}` };
  }
  const from = state.date.slice(0, 7) + "-01";
  const [y, m] = state.date.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to, label: `Mois de ${monthKey(state.date)}` };
}

function renderRapports() {
  const { from, to, label } = periodRange();
  const inRange = state.entries.filter((e) => !e.deleted && e.date >= from && e.date <= to);
  const t = totals(inRange);
  const cost = totalCost(inRange, state.ref.workers, state.ref.costs);

  // Répartition par jour de la semaine (graphique à barres)
  const { from: wFrom } = weekBounds(state.date);
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const dayTotals = days.map((lb, i) => {
    const d = new Date(wFrom + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const mins = state.entries
      .filter((e) => !e.deleted && e.date === iso && (e.kind === "TRAVAIL" || e.kind === "ACCIDENT"))
      .reduce((s, e) => s + e.minutes, 0);
    return { lb, iso, mins };
  });
  const maxDay = Math.max(1, ...dayTotals.map((d) => d.mins));

  // Par chantier (jauges)
  const perCh = new Map();
  for (const e of inRange) {
    if (e.kind !== "TRAVAIL" && e.kind !== "ACCIDENT") continue;
    perCh.set(e.chantierId, (perCh.get(e.chantierId) || 0) + e.minutes);
  }
  const chRows = [...perCh.entries()].sort((a, b) => b[1] - a[1]);
  const maxCh = Math.max(1, ...chRows.map((r) => r[1]));

  // Présence (donut)
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
      <div class="card-head"><h2>Heures totales</h2></div>
      <div id="rp-total-hours" style="font-size:32px;font-weight:800;letter-spacing:-0.02em">${fmtHM(t.workedMinutes)}</div>
      <div class="muted" style="margin-bottom:8px">sur la période sélectionnée</div>
      <div class="stat-row four" style="margin-top:12px">
        <div class="stat ok"><div class="v">${nbPresent}</div><div class="l">Présences</div></div>
        <div class="stat danger"><div class="v">${t.absenceDays}</div><div class="l">Absences</div></div>
        <div class="stat info"><div class="v">${fmtHM(t.weatherMinutes)}</div><div class="l">Intempéries</div></div>
        <div class="stat warn"><div class="v">${t.accidentCount}</div><div class="l">Accidents</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Répartition de la semaine</h2></div>
      <div class="bars">
        ${dayTotals
          .map(
            (d) => `<div class="b ${d.iso === state.date ? "on" : ""}">
              <div class="track"><div class="fill" style="height:${Math.round((d.mins / maxDay) * 100)}%"></div></div>
              <div class="lb">${d.lb}</div>
            </div>`,
          )
          .join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Par chantier</h2></div>
      ${
        chRows.length === 0
          ? `<div class="empty">Aucune heure sur la période.</div>`
          : chRows
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
        { label: "Présents", value: nbPresent, color: "#16a34a" },
        { label: "Absents", value: nbAbsent, color: "#e5484d" },
        { label: "Intempéries", value: nbWeather, color: "#1ca9e0" },
      ])}
    </div>

    ${personTable(inRange)}
    ${costCard(cost, inRange)}
    ${exportCard()}`;

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
      const seg = `<circle cx="58" cy="58" r="${R}" fill="none" stroke="${i.color}" stroke-width="15"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 58 58)" stroke-linecap="butt" />`;
      offset += len;
      return seg;
    })
    .join("");
  return `
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 116 116">
        <circle cx="58" cy="58" r="${R}" fill="none" stroke="#eef0f4" stroke-width="15" />
        ${arcs}
        <text x="58" y="63" text-anchor="middle" font-size="19" font-weight="700" fill="#16202f">${total}</text>
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
      <div id="rp-total-cost" style="font-size:28px;font-weight:800;margin-bottom:10px">${fmtEur(cost.total)}</div>
      <div class="stat-row four">
        <div class="stat"><div class="v" style="font-size:16px">${fmtEur(cost.labor)}</div><div class="l">Main d'œuvre</div></div>
        <div class="stat"><div class="v" style="font-size:16px">${fmtEur(cost.meal)}</div><div class="l">Paniers</div></div>
        <div class="stat"><div class="v" style="font-size:16px">${fmtEur(cost.travel)}</div><div class="l">Déplacements</div></div>
        <div class="stat"><div class="v" style="font-size:16px">${fmtEur(cost.weather)}</div><div class="l">Intempéries</div></div>
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
        📄 Relevé facturation intérim (ETT)
      </button>
      <button class="btn ghost block" id="exp-salaried" style="margin-top:8px" ${!store.online ? "disabled" : ""}>
        📄 Relevé salariés / stagiaires / alternants
      </button>
      ${!store.online ? `<p class="hint">🔌 Connexion requise pour générer les PDF.</p>` : ""}
    </div>`;
}

function bindExports() {
  const month = () => el("exp-month").value || monthKey(state.date);
  const open = (path) => window.open(store.api(path), "_blank");
  el("exp-interim").onclick = () => {
    const q = new URLSearchParams({ month: month() });
    if (el("exp-agency").value) q.set("agencyId", el("exp-agency").value);
    if (el("exp-chantier").value) q.set("chantierId", el("exp-chantier").value);
    if (el("exp-category").value) q.set("category", el("exp-category").value);
    open(`/api/reports/interim.pdf?${q}`);
  };
  el("exp-salaried").onclick = () => open(`/api/reports/salaried.pdf?month=${month()}`);
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
      <div class="card-head"><h2>Serveur & synchronisation</h2></div>
      <div class="rowline">
        <span>État</span>
        <strong style="color:${store.online ? "var(--ok)" : "var(--danger)"}">${store.online ? "En ligne" : "Hors-ligne"}</strong>
      </div>
      <div class="rowline"><span>Adresse</span><span class="muted">${esc(store.apiBase || "même origine")}</span></div>
      <div class="rowline"><span id="pending-line">Pointages en attente</span><strong id="pending-count">…</strong></div>
      <button class="btn ghost block" id="open-settings" style="margin-top:12px">⚙️ Modifier les réglages</button>
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
      <button class="btn block" id="add-worker" style="margin-top:12px" ${offline ? "disabled" : ""}>+ Ajouter une personne</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>Chantiers</h2><span class="sub">${chantiers.length}</span></div>
      ${
        chantiers.length === 0
          ? `<div class="empty">Aucun chantier.</div>`
          : chantiers
              .map(
                (c) => `<div class="rowline"><div><div style="font-weight:650">${esc(c.name)}</div>
                  <div class="muted">${esc([c.code, c.client, c.address].filter(Boolean).join(" · "))}</div></div></div>`,
              )
              .join("")
      }
      <button class="btn block" id="add-chantier" style="margin-top:12px" ${offline ? "disabled" : ""}>+ Ajouter un chantier</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>Agences d'intérim</h2><span class="sub">${agencies.length}</span></div>
      ${
        agencies.length === 0
          ? `<div class="empty">Aucune agence.</div>`
          : agencies.map((a) => `<div class="rowline"><span>${esc(a.name)}</span><span class="muted">${esc(a.contact || "")}</span></div>`).join("")
      }
      <button class="btn block" id="add-agency" style="margin-top:12px" ${offline ? "disabled" : ""}>+ Ajouter une agence</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>Coûts par chantier</h2><span class="sub">${costs.length} grille(s)</span></div>
      <p class="muted">Ce que coûte une personne selon le chantier : taux horaire, panier repas, indemnité de déplacement et prix unitaires (heures sup., fériées, intempéries).</p>
      ${costs
        .slice(0, 6)
        .map(
          (c) => `<div class="rowline"><div><div style="font-weight:650">${esc(workerName(c.workerId))}</div>
            <div class="muted">${esc(chantierName(c.chantierId))} · ${c.hourlyRate ? fmtEur(c.hourlyRate) + "/h · " : ""}panier ${fmtEur(c.mealAllowance || 0)} · dépl. ${fmtEur(c.travelAllowance || 0)}</div></div></div>`,
        )
        .join("")}
      <button class="btn block" id="add-cost" style="margin-top:12px" ${offline ? "disabled" : ""}>+ Définir un coût</button>
    </div>`;

  store.pendingCount().then((n) => {
    const c = el("pending-count");
    if (c) c.textContent = String(n);
  });
  el("open-settings").onclick = openSettings;
  el("add-worker").onclick = () => openWorkerSheet();
  el("add-chantier").onclick = () => openChantierSheet();
  el("add-agency").onclick = () => openAgencySheet();
  el("add-cost").onclick = () => openCostSheet();
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

/* ----------------------------- Réglages -------------------------------- */

function openSettings() {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="sheet">
      <div class="grab"></div>
      <h3>Réglages</h3>
      <div class="sheet-sub">TDMI Pointage</div>
      <label class="f">Votre nom (chef de chantier)</label>
      <input id="set-user" placeholder="Ex. Karim Benali" value="${esc(store.userName || "")}" />
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
    store.setUserName(ov.querySelector("#set-user").value.trim());
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

/** Recharge référentiel + pointages depuis le store local, puis réaffiche. */
async function reload() {
  state.ref = await store.reference();
  state.entries = await store.allEntries();
  render();
}

async function main() {
  document.querySelectorAll(".tabbar button").forEach((b) => {
    b.onclick = () => setTab(b.dataset.tab);
  });

  await store.init();
  await reload();
  store.onChange(reload);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

main();
