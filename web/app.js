/**
 * Application PWA — pilote les trois vues (Pointage, Tableau de bord,
 * Référentiel) au-dessus du Store local-first.
 */
import { Store } from "./store.js";
import {
  ABSENCE_LABEL,
  CATEGORY_LABEL,
  KIND_LABEL,
  SEVERITY_LABEL,
  entryCost,
  groupBy,
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
const view = el("view");

const state = {
  tab: "pointage",
  date: new Date().toISOString().slice(0, 10),
  chantierId: "",
  period: "jour", // jour | semaine | mois
  showAll: false, // pointage : afficher tout le monde (hors affectation)
  planWeek: new Date().toISOString().slice(0, 10),
  ref: { chantiers: [], workers: [], agencies: [], assignments: [], costs: [] },
};

// --------- Utilitaires UI ---------
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function toast(msg, isErr = false) {
  const t = el("toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  setTimeout(() => (t.className = "toast"), 2600);
}
function workerName(id) {
  const w = state.ref.workers.find((x) => x.id === id);
  return w ? `${w.firstName} ${w.lastName}` : id;
}
function chantierName(id) {
  const c = state.ref.chantiers.find((x) => x.id === id);
  return c ? c.name : id;
}
function agencyName(id) {
  if (id === "INTERNE") return "Employés internes";
  const a = state.ref.agencies.find((x) => x.id === id);
  return a ? a.name : id;
}
function fmtH(minutes) {
  return `${minutesToHours(minutes).toLocaleString("fr-FR")} h`;
}
function fmtEur(n) {
  return `${(Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function workerById(id) {
  return state.ref.workers.find((w) => w.id === id);
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

// --------- Barre de statut réseau ---------
async function refreshStatus() {
  const dot = el("dot");
  dot.className = "dot " + (store.online ? "online" : "offline");
  el("netlabel").textContent = store.online ? "En ligne" : "Hors-ligne";
  const p = await store.pendingCount();
  const badge = el("pending");
  if (p > 0) {
    badge.hidden = false;
    badge.textContent = `${p} à synchro.`;
  } else {
    badge.hidden = true;
  }
}

// =====================================================================
//  VUE POINTAGE
// =====================================================================
async function renderPointage() {
  const { chantiers } = state.ref;
  if (!state.chantierId && chantiers[0]) state.chantierId = chantiers[0].id;

  const entries = await store.entriesForDate(state.date, state.chantierId);
  const byWorker = new Map(entries.map((e) => [e.workerId, e]));

  // Personnel affecté à ce chantier ce jour-là (roster).
  const assignedIds = assignedIdsForDate(state.chantierId, state.date);
  const all = state.ref.workers.filter((w) => w.active);
  let team = all.filter((w) => assignedIds.has(w.id));
  // Personnes non affectées mais déjà pointées ce jour (ex. remplacement).
  for (const e of entries) if (!assignedIds.has(e.workerId)) {
    const w = workerById(e.workerId);
    if (w && !team.includes(w)) team.push(w);
  }
  if (state.showAll) team = all;

  view.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <label>Chantier</label>
          <select id="f-chantier">
            ${chantiers.map((c) => `<option value="${c.id}" ${c.id === state.chantierId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Date</label>
          <input type="date" id="f-date" value="${state.date}" />
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        <h2 style="margin:0">Équipe affectée — ${esc(chantierName(state.chantierId))}</h2>
        <button class="btn ghost sm" id="toggle-all">${state.showAll ? "Voir affectés" : "Voir tous"}</button>
      </div>
      <p class="muted" style="margin:.5rem 0 0">${team.length} personne(s) · ${state.date}</p>
      ${
        team.length === 0
          ? `<div class="empty">Personne n'est affecté à ce chantier ce jour.<br/>Affectez l'équipe dans l'onglet <strong>Planning</strong>, ou « Voir tous » pour un ajout exceptionnel.</div>`
          : ""
      }
      <div id="worker-list">
        ${team
          .map((w) => {
            const e = byWorker.get(w.id);
            const info = e ? entrySummary(e) : `<span class="muted">Non pointé</span>`;
            const exceptional = !assignedIds.has(w.id);
            return `
            <div class="worker-row">
              <div class="who">
                <div class="name">${esc(w.firstName)} ${esc(w.lastName)} ${exceptional ? `<span class="pill" style="border-color:var(--warn);color:var(--warn)">hors affectation</span>` : ""}</div>
                <div class="meta"><span class="pill ${w.type}">${w.type === "EMPLOYE" ? "Employé" : "Intérim"}</span> ${w.category ? esc(CATEGORY_LABEL[w.category] || w.category) + " · " : ""}${esc(w.trade || "")}</div>
                <div style="margin-top:.25rem">${info}</div>
              </div>
              <button class="btn sm" data-point="${w.id}">${e ? "Modifier" : "Pointer"}</button>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;

  el("f-chantier").onchange = (ev) => {
    state.chantierId = ev.target.value;
    renderPointage();
  };
  el("f-date").onchange = (ev) => {
    state.date = ev.target.value;
    renderPointage();
  };
  el("toggle-all").onclick = () => {
    state.showAll = !state.showAll;
    renderPointage();
  };
  view.querySelectorAll("[data-point]").forEach((b) => {
    b.onclick = () => openEntrySheet(b.getAttribute("data-point"), byWorker.get(b.getAttribute("data-point")));
  });
}

function entrySummary(e) {
  const tag = `<span class="tag ${e.kind}">${KIND_LABEL[e.kind]}</span>`;
  if (e.kind === "TRAVAIL") return `${tag} <strong>${fmtH(e.minutes)}</strong>${e.startTime ? ` (${e.startTime}–${e.endTime})` : ""}`;
  if (e.kind === "INTEMPERIE") return `${tag} ${fmtH(e.minutes)} perdues${e.note ? ` · ${esc(e.note)}` : ""}`;
  if (e.kind === "ABSENCE") return `${tag} ${ABSENCE_LABEL[e.absenceReason] || ""}`;
  if (e.kind === "ACCIDENT") return `${tag} ${SEVERITY_LABEL[e.accidentSeverity] || ""}${e.minutes ? ` · ${fmtH(e.minutes)} avant arrêt` : ""}`;
  return tag;
}

// --------- Feuille de saisie d'un pointage ---------
function openEntrySheet(workerId, existing) {
  const kind = existing?.kind || "TRAVAIL";
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="sheet">
      <h3>${esc(workerName(workerId))} — ${state.date}</h3>
      <label>Nature</label>
      <div class="seg" id="seg-kind">
        ${["TRAVAIL", "INTEMPERIE", "ABSENCE", "ACCIDENT"]
          .map((k) => `<button data-k="${k}" class="${k === kind ? "on" : ""}">${KIND_LABEL[k]}</button>`)
          .join("")}
      </div>
      <div id="kind-fields"></div>
      <div class="row" style="margin-top:1rem">
        ${existing ? `<button class="btn danger" id="del">Supprimer</button>` : ""}
        <button class="btn ghost" id="cancel">Annuler</button>
        <button class="btn" id="save">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let current = kind;
  const fields = overlay.querySelector("#kind-fields");
  const renderFields = () => {
    fields.innerHTML = fieldsFor(current, existing);
  };
  renderFields();

  overlay.querySelectorAll("#seg-kind button").forEach((b) => {
    b.onclick = () => {
      current = b.getAttribute("data-k");
      overlay.querySelectorAll("#seg-kind button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      renderFields();
    };
  });

  const close = () => overlay.remove();
  overlay.querySelector("#cancel").onclick = close;
  overlay.onclick = (ev) => {
    if (ev.target === overlay) close();
  };
  if (existing) {
    overlay.querySelector("#del").onclick = async () => {
      await store.deleteEntry(existing.id);
      close();
      toast("Pointage supprimé");
      renderPointage();
      refreshStatus();
    };
  }

  overlay.querySelector("#save").onclick = async () => {
    try {
      const payload = collectFields(current, overlay, workerId, existing);
      await store.saveEntry(payload);
      close();
      toast("Pointage enregistré");
      renderPointage();
      refreshStatus();
    } catch (e) {
      toast(e.message, true);
    }
  };
}

function fieldsFor(kind, e) {
  if (kind === "TRAVAIL") {
    return `
      <div class="row">
        <div><label>Début</label><input type="time" id="start" value="${e?.startTime || "07:30"}" /></div>
        <div><label>Fin</label><input type="time" id="end" value="${e?.endTime || "16:30"}" /></div>
      </div>
      <label>Pause (minutes)</label>
      <input type="number" id="break" min="0" step="5" value="${e?.breakMinutes ?? 60}" />
      <p class="muted" id="calc"></p>`;
  }
  if (kind === "INTEMPERIE") {
    return `
      <label>Heures perdues</label>
      <input type="number" id="hours" min="0" step="0.25" value="${e?.minutes ? minutesToHours(e.minutes) : 4}" />
      <label>Motif / commentaire</label>
      <textarea id="note" rows="2" placeholder="Pluie, gel, vent…">${esc(e?.note || "")}</textarea>`;
  }
  if (kind === "ABSENCE") {
    return `
      <label>Motif</label>
      <select id="reason">
        ${Object.entries(ABSENCE_LABEL).map(([k, v]) => `<option value="${k}" ${e?.absenceReason === k ? "selected" : ""}>${v}</option>`).join("")}
      </select>
      <label>Commentaire</label>
      <textarea id="note" rows="2">${esc(e?.note || "")}</textarea>`;
  }
  // ACCIDENT
  return `
    <label>Gravité</label>
    <select id="severity">
      ${Object.entries(SEVERITY_LABEL).map(([k, v]) => `<option value="${k}" ${e?.accidentSeverity === k ? "selected" : ""}>${v}</option>`).join("")}
    </select>
    <label>Heures travaillées avant l'arrêt</label>
    <input type="number" id="hours" min="0" step="0.25" value="${e?.minutes ? minutesToHours(e.minutes) : 0}" />
    <label>Circonstances</label>
    <textarea id="note" rows="3" placeholder="Nature, partie du corps, tiers…">${esc(e?.note || "")}</textarea>
    <p class="muted">⚠️ Déclaration d'accident du travail à transmettre sous 48 h.</p>`;
}

function collectFields(kind, overlay, workerId, existing) {
  const base = {
    id: existing?.id,
    workerId,
    chantierId: state.chantierId,
    date: state.date,
    kind,
    recordedBy: "chef", // identifiant du chef connecté (à brancher sur l'auth)
  };
  const val = (sel) => overlay.querySelector(sel)?.value;
  if (kind === "TRAVAIL") {
    const minutes = workedMinutes(val("#start"), val("#end"), Number(val("#break") || 0));
    if (minutes <= 0) throw new Error("Durée nulle");
    return { ...base, minutes, startTime: val("#start"), endTime: val("#end"), breakMinutes: Number(val("#break") || 0) };
  }
  if (kind === "INTEMPERIE") {
    const minutes = Math.round(Number(val("#hours")) * 60);
    if (minutes <= 0) throw new Error("Préciser les heures perdues");
    return { ...base, minutes, note: val("#note") };
  }
  if (kind === "ABSENCE") {
    return { ...base, minutes: 0, absenceReason: val("#reason"), note: val("#note") };
  }
  return {
    ...base,
    minutes: Math.round(Number(val("#hours") || 0) * 60),
    accidentSeverity: val("#severity"),
    note: val("#note"),
  };
}

// =====================================================================
//  VUE PLANNING (affectations)
// =====================================================================
function weekBounds(anyDate) {
  const wd = new Date(anyDate + "T00:00:00Z").getUTCDay();
  const iso = wd === 0 ? 7 : wd;
  const monday = new Date(anyDate + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - (iso - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

function renderPlanning() {
  const { chantiers, assignments, workers } = state.ref;
  if (!state.chantierId && chantiers[0]) state.chantierId = chantiers[0].id;
  const offline = !store.online;
  const { from, to } = weekBounds(state.planWeek);

  // Affectations du chantier qui recoupent la semaine.
  const weekAsg = assignments.filter(
    (a) => !a.deleted && a.chantierId === state.chantierId && a.startDate <= to && (!a.endDate || a.endDate >= from),
  );
  const assignedIds = new Set(weekAsg.filter((a) => a.status === "ACTIVE").map((a) => a.workerId));
  const available = workers.filter((w) => w.active && !assignedIds.has(w.id));

  view.innerHTML = `
    ${offline ? `<div class="card"><span class="muted">🔌 Hors-ligne : le planning nécessite une connexion.</span></div>` : ""}
    <div class="card">
      <div class="row">
        <div><label>Chantier</label>
          <select id="pl-chantier">${chantiers.map((c) => `<option value="${c.id}" ${c.id === state.chantierId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </div>
        <div><label>Semaine (un jour)</label><input type="date" id="pl-week" value="${state.planWeek}" /></div>
      </div>
      <p class="muted">Semaine du ${from} au ${to}</p>
    </div>

    <div class="card">
      <h2>Équipe affectée (${weekAsg.length})</h2>
      ${weekAsg.length === 0 ? `<div class="empty">Aucune affectation cette semaine.</div>` : ""}
      ${weekAsg
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((a) => {
          const w = workerById(a.workerId);
          const ended = a.status === "ENDED";
          return `<div class="worker-row">
            <div class="who">
              <div class="name">${w ? esc(w.firstName + " " + w.lastName) : a.workerId} ${a.replacesWorkerId ? `<span class="pill" style="border-color:var(--accent);color:var(--accent)">remplaçant</span>` : ""}</div>
              <div class="meta">${a.startDate} → ${a.endDate || "…"} ${ended ? `· <span style="color:var(--muted)">clôturée</span>` : ""}</div>
            </div>
            ${!ended ? `<button class="btn ghost sm" data-replace="${a.id}" ${offline ? "disabled" : ""}>Remplacer</button>` : ""}
          </div>`;
        })
        .join("")}
    </div>

    <div class="card">
      <h2>Affecter une personne</h2>
      <label>Personne disponible</label>
      <select id="pl-worker">${available.map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)} — ${w.type === "EMPLOYE" ? "Employé" : "Intérim"} ${esc(w.trade || "")}</option>`).join("")}</select>
      <button class="btn" id="pl-add" style="margin-top:.6rem" ${offline || available.length === 0 ? "disabled" : ""}>Affecter pour la semaine</button>
    </div>`;

  el("pl-chantier").onchange = (ev) => {
    state.chantierId = ev.target.value;
    renderPlanning();
  };
  el("pl-week").onchange = (ev) => {
    state.planWeek = ev.target.value;
    renderPlanning();
  };
  el("pl-add").onclick = async () => {
    const workerId = el("pl-worker").value;
    if (!workerId) return;
    try {
      await store.addAssignment({ workerId, chantierId: state.chantierId, anyDate: state.planWeek, assignedBy: "conducteur" });
      await loadReference();
      toast("Personne affectée");
      renderPlanning();
    } catch (e) {
      toast(e.message, true);
    }
  };
  view.querySelectorAll("[data-replace]").forEach((b) => {
    b.onclick = () => openReplaceSheet(b.getAttribute("data-replace"), weekAsg);
  });
}

function openReplaceSheet(assignmentId, weekAsg) {
  const asg = weekAsg.find((a) => a.id === assignmentId);
  if (!asg) return;
  const leaving = workerById(asg.workerId);
  const { workers } = state.ref;
  const candidates = workers.filter((w) => w.active && w.id !== asg.workerId);
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="sheet">
      <h3>Remplacer ${leaving ? esc(leaving.firstName + " " + leaving.lastName) : ""}</h3>
      <label>Remplaçant</label>
      <select id="rep-worker">${candidates.map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)} — ${w.type === "EMPLOYE" ? "Employé" : "Intérim"} ${esc(w.trade || "")}</option>`).join("")}</select>
      <label>À partir du</label>
      <input type="date" id="rep-date" value="${state.date}" min="${asg.startDate}" ${asg.endDate ? `max="${asg.endDate}"` : ""} />
      <label>Motif</label>
      <input id="rep-note" placeholder="Ex. arrêt maladie, fin de mission…" />
      <div class="row" style="margin-top:1rem">
        <button class="btn ghost" id="rep-cancel">Annuler</button>
        <button class="btn" id="rep-save">Valider le remplacement</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#rep-cancel").onclick = close;
  overlay.onclick = (ev) => {
    if (ev.target === overlay) close();
  };
  overlay.querySelector("#rep-save").onclick = async () => {
    try {
      await store.replaceAssignment(assignmentId, {
        newWorkerId: overlay.querySelector("#rep-worker").value,
        fromDate: overlay.querySelector("#rep-date").value,
        assignedBy: "conducteur",
        note: overlay.querySelector("#rep-note").value,
      });
      await loadReference();
      close();
      toast("Remplacement enregistré");
      renderPlanning();
    } catch (e) {
      toast(e.message, true);
    }
  };
}

// =====================================================================
//  VUE TABLEAU DE BORD
// =====================================================================
async function renderDashboard() {
  const all = (await store.allEntries()).filter((e) => !e.deleted);
  const { from, to, label } = periodRange();
  const inRange = all.filter((e) => e.date >= from && e.date <= to);
  const t = totals(inRange);

  const perWorker = groupBy(inRange, (e) => e.workerId);
  const perChantier = groupBy(inRange, (e) => e.chantierId);
  const perAgency = groupBy(inRange, (e) => {
    const w = state.ref.workers.find((x) => x.id === e.workerId);
    return w?.agencyId || "INTERNE";
  });
  const cost = totalCost(inRange, state.ref.workers, state.ref.costs);

  view.innerHTML = `
    <div class="card">
      <div class="seg" id="seg-period">
        ${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]]
          .map(([k, v]) => `<button data-p="${k}" class="${state.period === k ? "on" : ""}">${v}</button>`)
          .join("")}
      </div>
      <label>Date de référence</label>
      <input type="date" id="dash-date" value="${state.date}" />
      <p class="muted">Période : ${label}</p>
    </div>

    <div class="card">
      <h2>Synthèse</h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${minutesToHours(t.workedMinutes).toLocaleString("fr-FR")}</div><div class="l">Heures travaillées</div></div>
        <div class="kpi weather"><div class="v">${minutesToHours(t.weatherMinutes).toLocaleString("fr-FR")}</div><div class="l">Heures intempéries</div></div>
        <div class="kpi"><div class="v">${t.absenceDays}</div><div class="l">Jours d'absence</div></div>
        <div class="kpi accident"><div class="v">${t.accidentCount}</div><div class="l">Accidents</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Exports PDF — relevés mensuels</h2>
      <p class="muted">Relevé détaillé par intérimaire (à comparer aux factures ETT) et relevé heures/chantier des salariés, stagiaires et alternants.</p>
      <label>Mois</label>
      <input type="month" id="exp-month" value="${monthKey(state.date)}" />
      <p class="muted" style="margin:.6rem 0 .2rem">Filtres du relevé intérim (impression par agence, chantier ou catégorie) :</p>
      <div class="row">
        <select id="exp-agency"><option value="">Toutes agences</option>${state.ref.agencies.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
        <select id="exp-chantier"><option value="">Tous chantiers</option>${state.ref.chantiers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        <select id="exp-category"><option value="">Toutes catégories</option>${Object.entries(CATEGORY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      </div>
      <div class="row" style="margin-top:.7rem">
        <button class="btn" id="exp-interim" ${!store.online ? "disabled" : ""}>PDF facturation intérim</button>
        <button class="btn ghost" id="exp-salaried" ${!store.online ? "disabled" : ""}>PDF salariés</button>
      </div>
      ${!store.online ? `<p class="muted">🔌 Connexion requise pour générer les PDF.</p>` : ""}
    </div>

    <div class="card">
      <h2>Coût estimé (admin)</h2>
      <div class="kpis">
        <div class="kpi"><div class="v" style="font-size:1.25rem">${fmtEur(cost.total)}</div><div class="l">Coût total</div></div>
        <div class="kpi"><div class="v" style="font-size:1.25rem">${fmtEur(cost.labor)}</div><div class="l">Main d'œuvre</div></div>
        <div class="kpi"><div class="v" style="font-size:1.25rem">${fmtEur(cost.meal)}</div><div class="l">Paniers repas</div></div>
        <div class="kpi"><div class="v" style="font-size:1.25rem">${fmtEur(cost.travel + cost.weather)}</div><div class="l">Déplacements + intemp.</div></div>
      </div>
    </div>

    ${tableCard("Par personne", perWorker, workerName, state.period === "semaine")}
    ${costTableCard("Coût par personne", perWorker, workerName)}
    ${tableCard("Par chantier", perChantier, chantierName, false)}
    ${costTableCard("Coût par chantier", perChantier, chantierName)}
    ${tableCard("Par agence / interne", perAgency, agencyName, false)}
  `;

  view.querySelectorAll("#seg-period button").forEach((b) => {
    b.onclick = () => {
      state.period = b.getAttribute("data-p");
      renderDashboard();
    };
  });
  el("dash-date").onchange = (ev) => {
    state.date = ev.target.value;
    renderDashboard();
  };
  const expMonth = () => el("exp-month").value || monthKey(state.date);
  el("exp-interim").onclick = () => {
    const q = new URLSearchParams({ month: expMonth() });
    if (el("exp-agency").value) q.set("agencyId", el("exp-agency").value);
    if (el("exp-chantier").value) q.set("chantierId", el("exp-chantier").value);
    if (el("exp-category").value) q.set("category", el("exp-category").value);
    openExport(`/api/reports/interim.pdf?${q.toString()}`);
  };
  el("exp-salaried").onclick = () => openExport(`/api/reports/salaried.pdf?month=${expMonth()}`);
}

/** Ouvre un export (PDF) en tenant compte d'une éventuelle base API distante. */
function openExport(path) {
  const url = (store.apiBase || "") + path;
  window.open(url, "_blank");
}

function tableCard(title, group, nameOf, showOvertime) {
  const rows = [...group.entries()]
    .map(([key, list]) => ({ key, t: totals(list) }))
    .sort((a, b) => b.t.workedMinutes - a.t.workedMinutes);
  if (rows.length === 0) return `<div class="card"><h2>${title}</h2><div class="empty">Aucune donnée</div></div>`;
  return `
    <div class="card">
      <h2>${title}</h2>
      <table>
        <thead><tr>
          <th>${title.includes("personne") ? "Personne" : title.includes("chantier") ? "Chantier" : "Agence"}</th>
          <th class="num">Trav.</th>
          <th class="num">Intemp.</th>
          <th class="num">Abs.</th>
          <th class="num">Acc.</th>
          ${showOvertime ? `<th class="num">H. payées*</th>` : ""}
        </tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
                <td>${esc(nameOf(r.key))}</td>
                <td class="num">${minutesToHours(r.t.workedMinutes).toLocaleString("fr-FR")}</td>
                <td class="num">${minutesToHours(r.t.weatherMinutes).toLocaleString("fr-FR")}</td>
                <td class="num">${r.t.absenceDays}</td>
                <td class="num">${r.t.accidentCount}</td>
                ${showOvertime ? `<td class="num">${weeklyOvertime(r.t.workedMinutes).paidEquivalentHours.toLocaleString("fr-FR")}</td>` : ""}
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      ${showOvertime ? `<p class="muted">* équivalent payé avec majorations heures sup. (35 h légales, +25 % puis +50 %).</p>` : ""}
    </div>`;
}

function costTableCard(title, group, nameOf) {
  const rows = [...group.entries()]
    .map(([key, list]) => {
      const c = { labor: 0, meal: 0, travel: 0, weather: 0, total: 0 };
      for (const e of list) {
        const ec = entryCost(e, resolveRate(e.workerId, e.chantierId, state.ref.workers, state.ref.costs));
        for (const k of Object.keys(c)) c[k] += ec[k];
      }
      return { key, c };
    })
    .filter((r) => r.c.total > 0)
    .sort((a, b) => b.c.total - a.c.total);
  if (rows.length === 0) return "";
  return `
    <div class="card">
      <h2>${title}</h2>
      <table>
        <thead><tr><th>${title.includes("personne") ? "Personne" : "Chantier"}</th>
          <th class="num">Main d'œuvre</th><th class="num">Panier</th><th class="num">Dépl.</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr><td>${esc(nameOf(r.key))}</td>
                <td class="num">${fmtEur(r.c.labor)}</td>
                <td class="num">${fmtEur(r.c.meal)}</td>
                <td class="num">${fmtEur(r.c.travel + r.c.weather)}</td>
                <td class="num"><strong>${fmtEur(r.c.total)}</strong></td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function periodRange() {
  const d = state.date;
  if (state.period === "jour") return { from: d, to: d, label: d };
  if (state.period === "semaine") {
    const wd = new Date(d + "T00:00:00Z").getUTCDay();
    const iso = wd === 0 ? 7 : wd;
    const monday = new Date(d + "T00:00:00Z");
    monday.setUTCDate(monday.getUTCDate() - (iso - 1));
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const from = monday.toISOString().slice(0, 10);
    const to = sunday.toISOString().slice(0, 10);
    return { from, to, label: `${isoWeekKey(d)} (${from} → ${to})` };
  }
  const from = d.slice(0, 7) + "-01";
  const [y, m] = d.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to, label: monthKey(d) };
}

// =====================================================================
//  VUE RÉFÉRENTIEL
// =====================================================================
function renderReferentiel() {
  const { chantiers, workers, agencies } = state.ref;
  const offline = !store.online;
  view.innerHTML = `
    ${offline ? `<div class="card"><span class="muted">🔌 Hors-ligne : la création de chantiers/personnes nécessite une connexion. La saisie des pointages reste possible.</span></div>` : ""}
    <div class="card">
      <h2>Chantiers (${chantiers.length})</h2>
      <div id="list-ch">${chantiers.map((c) => `<div class="worker-row"><div class="who"><div class="name">${esc(c.name)}</div><div class="meta">${esc(c.code)} · ${esc(c.client || "")}</div></div></div>`).join("") || `<div class="empty">Aucun chantier</div>`}</div>
      <div class="row" style="margin-top:.75rem"><input id="ch-code" placeholder="Code (ex. LY-2026-01)" /><input id="ch-name" placeholder="Nom du chantier" /></div>
      <input id="ch-client" placeholder="Client" style="margin-top:.5rem" />
      <button class="btn" id="add-ch" style="margin-top:.5rem" ${offline ? "disabled" : ""}>Ajouter le chantier</button>
    </div>

    <div class="card">
      <h2>Personnes (${workers.length})</h2>
      <div>${workers.map((w) => `<div class="worker-row"><div class="who"><div class="name">${esc(w.firstName)} ${esc(w.lastName)}</div><div class="meta"><span class="pill ${w.type}">${w.type === "EMPLOYE" ? "Employé" : "Intérim"}</span> ${w.category ? esc(CATEGORY_LABEL[w.category] || w.category) + " · " : ""}${esc(w.trade || "")}${w.agencyId ? " · " + esc(agencyName(w.agencyId)) : ""}${w.hourlyRate ? " · " + fmtEur(w.hourlyRate) + "/h" : ""}</div></div></div>`).join("") || `<div class="empty">Aucune personne</div>`}</div>
      <div class="row" style="margin-top:.75rem"><input id="w-first" placeholder="Prénom" /><input id="w-last" placeholder="Nom" /></div>
      <div class="row" style="margin-top:.5rem">
        <select id="w-type"><option value="EMPLOYE">Employé</option><option value="INTERIMAIRE">Intérimaire</option></select>
        <select id="w-cat">${Object.entries(CATEGORY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      </div>
      <div class="row" style="margin-top:.5rem">
        <input id="w-trade" placeholder="Métier (maçon, coffreur…)" />
        <input id="w-rate" type="number" step="0.5" min="0" placeholder="Coût horaire €/h" />
      </div>
      <select id="w-agency" style="margin-top:.5rem"><option value="">— Agence (si intérim) —</option>${agencies.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
      <button class="btn" id="add-w" style="margin-top:.5rem" ${offline ? "disabled" : ""}>Ajouter la personne</button>
    </div>

    <div class="card">
      <h2>Coûts par chantier</h2>
      <p class="muted">Ce que coûte une personne selon le chantier : salaire horaire chargé, panier repas et indemnité de déplacement (par jour travaillé).</p>
      <div>${state.ref.costs.map((c) => `<div class="worker-row"><div class="who"><div class="name">${esc(workerName(c.workerId))}</div><div class="meta">${esc(chantierName(c.chantierId))} · ${c.hourlyRate ? fmtEur(c.hourlyRate) + "/h · " : ""}panier ${fmtEur(c.mealAllowance || 0)} · dépl. ${fmtEur(c.travelAllowance || 0)}</div></div></div>`).join("") || `<div class="empty">Aucune grille de coût</div>`}</div>
      <div class="row" style="margin-top:.75rem">
        <select id="co-worker">${workers.map((w) => `<option value="${w.id}">${esc(w.lastName)} ${esc(w.firstName)}</option>`).join("")}</select>
        <select id="co-chantier">${chantiers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      </div>
      <div class="row" style="margin-top:.5rem">
        <input id="co-rate" type="number" step="0.5" min="0" placeholder="€/h normale" />
        <input id="co-meal" type="number" step="0.5" min="0" placeholder="Panier €/j" />
        <input id="co-travel" type="number" step="0.5" min="0" placeholder="Déplacement €/j" />
      </div>
      <p class="muted" style="margin:.5rem 0 .2rem">Prix unitaires spécifiques (optionnels — sinon calculés : +25 %, +50 %, férié ×2, intempérie ×0,75) :</p>
      <div class="row">
        <input id="co-ot25" type="number" step="0.5" min="0" placeholder="€/h +25%" />
        <input id="co-ot50" type="number" step="0.5" min="0" placeholder="€/h +50%" />
        <input id="co-holiday" type="number" step="0.5" min="0" placeholder="€/h férié" />
        <input id="co-weather" type="number" step="0.5" min="0" placeholder="€/h intemp." />
      </div>
      <button class="btn" id="add-co" style="margin-top:.5rem" ${offline ? "disabled" : ""}>Enregistrer le coût</button>
    </div>

    <div class="card">
      <h2>Agences d'intérim (${agencies.length})</h2>
      <div>${agencies.map((a) => `<div class="worker-row"><div class="who"><div class="name">${esc(a.name)}</div><div class="meta">${esc(a.contact || "")}</div></div></div>`).join("") || `<div class="empty">Aucune agence</div>`}</div>
      <input id="a-name" placeholder="Nom de l'agence" style="margin-top:.75rem" />
      <button class="btn" id="add-a" style="margin-top:.5rem" ${offline ? "disabled" : ""}>Ajouter l'agence</button>
    </div>`;

  const v = (id) => el(id)?.value.trim();
  const num = (id) => {
    const x = Number(el(id)?.value);
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  el("add-ch") && (el("add-ch").onclick = () => guarded(() => store.addChantier({ code: v("ch-code"), name: v("ch-name"), client: v("ch-client") }), "Chantier ajouté"));
  el("add-w") &&
    (el("add-w").onclick = () =>
      guarded(
        () =>
          store.addWorker({
            firstName: v("w-first"),
            lastName: v("w-last"),
            type: v("w-type"),
            category: v("w-cat"),
            trade: v("w-trade"),
            hourlyRate: num("w-rate"),
            agencyId: v("w-agency") || undefined,
          }),
        "Personne ajoutée",
      ));
  el("add-a") && (el("add-a").onclick = () => guarded(() => store.addAgency({ name: v("a-name") }), "Agence ajoutée"));
  el("add-co") &&
    (el("add-co").onclick = () =>
      guarded(
        () =>
          store.addCost({
            workerId: v("co-worker"),
            chantierId: v("co-chantier"),
            hourlyRate: num("co-rate"),
            overtime25Rate: num("co-ot25"),
            overtime50Rate: num("co-ot50"),
            holidayRate: num("co-holiday"),
            weatherRate: num("co-weather"),
            mealAllowance: num("co-meal"),
            travelAllowance: num("co-travel"),
          }),
        "Coût enregistré",
      ));
}

async function guarded(fn, okMsg) {
  try {
    await fn();
    await loadReference();
    toast(okMsg);
    renderReferentiel();
  } catch (e) {
    toast(e.message, true);
  }
}

// =====================================================================
//  Bootstrap
// =====================================================================
async function loadReference() {
  state.ref = await store.reference();
}

// =====================================================================
//  RÉGLAGES (URL du serveur — indispensable sur l'app mobile TDMI)
// =====================================================================
function openSettings() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="sheet">
      <h3>Réglages — TDMI Pointage</h3>
      <label>Adresse du serveur</label>
      <input id="set-url" placeholder="https://pointage.mon-entreprise.fr" value="${esc(store.apiBase)}" />
      <p class="muted">Laisser vide si l'application et le serveur sont sur la même adresse (usage web). Sur mobile, indiquez l'URL de votre serveur de pointage.</p>
      <div id="set-status" class="muted"></div>
      <div class="row" style="margin-top:1rem">
        <button class="btn ghost" id="set-cancel">Fermer</button>
        <button class="btn ghost" id="set-sync">Synchroniser</button>
        <button class="btn" id="set-save">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#set-cancel").onclick = close;
  overlay.onclick = (ev) => {
    if (ev.target === overlay) close();
  };
  const status = overlay.querySelector("#set-status");

  overlay.querySelector("#set-save").onclick = async () => {
    store.setApiBase(overlay.querySelector("#set-url").value.trim());
    status.textContent = "Test de connexion…";
    try {
      const r = await fetch(store.api("/api/health"));
      const j = await r.json();
      status.style.color = "var(--ok)";
      status.textContent = j.ok ? "✅ Connecté au serveur." : "Réponse inattendue.";
      await store.refreshReference();
      await loadReference();
      await store.sync();
      render();
    } catch {
      status.style.color = "var(--danger)";
      status.textContent = "❌ Serveur injoignable (les données locales restent disponibles hors-ligne).";
    }
  };
  overlay.querySelector("#set-sync").onclick = async () => {
    status.style.color = "var(--muted)";
    status.textContent = "Synchronisation…";
    try {
      await store.sync();
      await loadReference();
      render();
      status.style.color = "var(--ok)";
      status.textContent = "✅ Synchronisé.";
    } catch {
      status.style.color = "var(--danger)";
      status.textContent = "❌ Échec de synchronisation.";
    }
    refreshStatus();
  };
}

function render() {
  if (state.tab === "pointage") renderPointage();
  else if (state.tab === "planning") renderPlanning();
  else if (state.tab === "dashboard") renderDashboard();
  else renderReferentiel();
  refreshStatus();
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
  render();
}

async function main() {
  document.querySelectorAll("nav.tabs button").forEach((b) => {
    b.onclick = () => setTab(b.getAttribute("data-tab"));
  });
  const settingsBtn = el("settings-btn");
  if (settingsBtn) settingsBtn.onclick = openSettings;

  await store.init();
  await loadReference();
  store.onChange(async () => {
    await loadReference();
    render();
  });
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

main();
