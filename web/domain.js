/**
 * Domaine côté navigateur — sous-ensemble pur des calculs du cœur métier,
 * pour permettre la saisie et les totaux **hors-ligne**. Le serveur reste la
 * source de vérité ; ces fonctions reproduisent la même logique (mêmes tests
 * conceptuels que src/core).
 */

export const LABOR = {
  WEEKLY_LEGAL_HOURS: 35,
  WEEKLY_TIER2_HOURS: 43,
  OVERTIME_TIER1_RATE: 0.25,
  OVERTIME_TIER2_RATE: 0.5,
  WEATHER_DEDUCTIBLE_MINUTES: 60,
  WEATHER_INDEMNITY_RATE: 0.75,
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(value) {
  const m = HHMM.exec(String(value).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minutesToHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

export function workedMinutes(start, end, breakMinutes = 0) {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s === null || e === null) throw new Error("horaire invalide");
  let span = e - s;
  if (span < 0) span += 24 * 60;
  const net = span - breakMinutes;
  if (net < 0) throw new Error("pause > amplitude");
  return net;
}

export function weeklyOvertime(totalWorkedMinutes) {
  const clamped = Math.max(0, totalWorkedMinutes);
  const legal = LABOR.WEEKLY_LEGAL_HOURS * 60;
  const tier2Start = LABOR.WEEKLY_TIER2_HOURS * 60;
  const normalMinutes = Math.min(clamped, legal);
  const tier1Minutes = Math.min(Math.max(clamped - legal, 0), tier2Start - legal);
  const tier2Minutes = Math.max(clamped - tier2Start, 0);
  const paid =
    normalMinutes +
    tier1Minutes * (1 + LABOR.OVERTIME_TIER1_RATE) +
    tier2Minutes * (1 + LABOR.OVERTIME_TIER2_RATE);
  return { normalMinutes, tier1Minutes, tier2Minutes, paidEquivalentHours: minutesToHours(paid) };
}

function isoWeekday(date) {
  const wd = new Date(date + "T00:00:00Z").getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function isoWeekKey(date) {
  const dt = new Date(date + "T00:00:00Z");
  const day = isoWeekday(date);
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(date) {
  return date.slice(0, 7);
}

/** Totaux sur une liste de pointages (mêmes règles que src/core/reports). */
export function totals(entries) {
  const t = { workedMinutes: 0, weatherMinutes: 0, absenceDays: 0, accidentCount: 0 };
  for (const e of entries) {
    if (e.deleted) continue;
    if (e.kind === "TRAVAIL") t.workedMinutes += e.minutes;
    else if (e.kind === "INTEMPERIE") t.weatherMinutes += e.minutes;
    else if (e.kind === "ABSENCE") t.absenceDays += 1;
    else if (e.kind === "ACCIDENT") {
      t.accidentCount += 1;
      t.workedMinutes += e.minutes;
    }
  }
  t.workedHours = minutesToHours(t.workedMinutes);
  t.weatherHours = minutesToHours(t.weatherMinutes);
  return t;
}

export function groupBy(entries, keyOf) {
  const map = new Map();
  for (const e of entries) {
    if (e.deleted) continue;
    const k = keyOf(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

export const KIND_LABEL = {
  TRAVAIL: "Travail",
  ABSENCE: "Absence",
  INTEMPERIE: "Intempérie",
  ACCIDENT: "Accident",
};

export const ABSENCE_LABEL = {
  CONGE_PAYE: "Congé payé",
  RTT: "RTT",
  MALADIE: "Maladie",
  FORMATION: "Formation",
  INJUSTIFIEE: "Injustifiée",
  AUTRE: "Autre",
};

export const SEVERITY_LABEL = {
  BENIN: "Bénin",
  AVEC_ARRET: "Avec arrêt",
  GRAVE: "Grave",
};

export const CATEGORY_LABEL = {
  OUVRIER: "Ouvrier",
  ETAM: "ETAM",
  CADRE: "Cadre",
  APPRENTI: "Apprenti",
};

// --------- Coûts (mêmes règles que src/core/cost) ---------
function weatherIndemnityAmount(lostMinutes, hourlyRate) {
  const eligible = Math.max(0, lostMinutes - LABOR.WEATHER_DEDUCTIBLE_MINUTES);
  const amount = minutesToHours(eligible) * hourlyRate * LABOR.WEATHER_INDEMNITY_RATE;
  return Math.round(amount * 100) / 100;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Grille effective pour une personne sur un chantier (avec repli). */
export function resolveRate(workerId, chantierId, workers, rates) {
  const worker = workers.find((w) => w.id === workerId);
  const rate = rates.find((r) => r.workerId === workerId && r.chantierId === chantierId);
  return {
    hourlyRate: rate?.hourlyRate ?? worker?.hourlyRate ?? 0,
    mealAllowance: rate?.mealAllowance ?? 0,
    travelAllowance: rate?.travelAllowance ?? 0,
  };
}

/** Coût d'un pointage (jour). */
export function entryCost(e, rate) {
  let labor = 0;
  let meal = 0;
  let travel = 0;
  let weather = 0;
  if (e.kind === "TRAVAIL" || e.kind === "ACCIDENT") labor = minutesToHours(e.minutes) * rate.hourlyRate;
  if (e.kind === "INTEMPERIE") weather = weatherIndemnityAmount(e.minutes, rate.hourlyRate);
  if ((e.kind === "TRAVAIL" || e.kind === "ACCIDENT") && e.minutes > 0) {
    meal = rate.mealAllowance;
    travel = rate.travelAllowance;
  }
  return {
    labor: round2(labor),
    meal: round2(meal),
    travel: round2(travel),
    weather: round2(weather),
    total: round2(labor + meal + travel + weather),
  };
}

/** Coût total d'une liste de pointages. */
export function totalCost(entries, workers, rates) {
  const acc = { labor: 0, meal: 0, travel: 0, weather: 0, total: 0 };
  for (const e of entries) {
    if (e.deleted) continue;
    const c = entryCost(e, resolveRate(e.workerId, e.chantierId, workers, rates));
    for (const k of Object.keys(acc)) acc[k] = round2(acc[k] + c[k]);
  }
  return acc;
}

/** Une affectation couvre-t-elle la date ? */
export function coversDate(a, date) {
  if (a.deleted) return false;
  if (date < a.startDate) return false;
  if (a.endDate && date > a.endDate) return false;
  return true;
}

/** Ids des personnes affectées à un chantier une date donnée. */
export function assignedWorkerIds(assignments, chantierId, date) {
  return [
    ...new Set(
      assignments
        .filter((a) => a.chantierId === chantierId && coversDate(a, date))
        .map((a) => a.workerId),
    ),
  ];
}
