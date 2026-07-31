/**
 * Jeu de données de démonstration : 2 chantiers, 1 agence, 5 personnes et une
 * semaine de pointages (travail, intempérie, absence, accident).
 */
import { buildTimeEntry, buildWeekAssignment, replaceWorker, type TimeEntryInput } from "../core/index.js";
import { openDb } from "./db.js";
import { Repository } from "./repository.js";
import { hashPassword, type Role } from "./auth.js";
import { nowISO } from "./ids.js";

const DB_PATH = process.env.DB_PATH ?? "data/pointage.db";

export function seed(repo: Repository): void {
  // Comptes de démonstration (identifiant = mot de passe) : admin, conducteur, chef.
  if (repo.countUsers() === 0) {
    const demoUsers: Array<{ u: string; n: string; r: Role }> = [
      { u: "admin", n: "Direction TDMI", r: "ADMIN" },
      { u: "conducteur", n: "Karim Benali", r: "CONDUCTEUR" },
      { u: "chef", n: "Luc Dupont", r: "CHEF" },
    ];
    for (const d of demoUsers) {
      const { salt, hash } = hashPassword(d.u);
      repo.createUser({
        id: `us_${d.u}`,
        username: d.u,
        displayName: d.n,
        role: d.r,
        passwordHash: hash,
        salt,
        active: true,
        createdAt: nowISO(),
      });
    }
  }

  repo.upsertAgency({ id: "ag_demo", name: "Intérim Bâtiment SudEst", contact: "04 90 00 00 00", active: true });

  repo.upsertChantier({
    id: "ch_lyon", code: "LY-2026-01", name: "Résidence Les Terrasses",
    address: "Lyon 7e", client: "Nexity", startDate: "2026-06-01", active: true,
  });
  repo.upsertChantier({
    id: "ch_villeurb", code: "VU-2026-04", name: "Groupe scolaire Jean Zay",
    address: "Villeurbanne", client: "Ville de Villeurbanne", startDate: "2026-07-01", active: true,
  });

  const workers = [
    { id: "wk_martin", firstName: "Karim", lastName: "Benali", type: "EMPLOYE" as const, category: "ETAM", trade: "Chef d'équipe maçonnerie", hourlyRate: 24, active: true },
    { id: "wk_dupont", firstName: "Luc", lastName: "Dupont", type: "EMPLOYE" as const, category: "OUVRIER", trade: "Coffreur", hourlyRate: 21, active: true },
    { id: "wk_silva", firstName: "João", lastName: "Silva", type: "INTERIMAIRE" as const, category: "OUVRIER", trade: "Maçon", agencyId: "ag_demo", hourlyRate: 20, active: true },
    { id: "wk_koffi", firstName: "Yao", lastName: "Koffi", type: "INTERIMAIRE" as const, category: "OUVRIER", trade: "Manœuvre", agencyId: "ag_demo", hourlyRate: 18, active: true },
    { id: "wk_moreau", firstName: "Sophie", lastName: "Moreau", type: "EMPLOYE" as const, category: "OUVRIER", trade: "Grutier", hourlyRate: 23, active: true },
    { id: "wk_petit", firstName: "Marc", lastName: "Petit", type: "INTERIMAIRE" as const, category: "OUVRIER", trade: "Manœuvre", agencyId: "ag_demo", hourlyRate: 18, active: true },
    { id: "wk_leroy", firstName: "Emma", lastName: "Leroy", type: "STAGIAIRE" as const, category: "APPRENTI", trade: "Conductrice de travaux (stage)", hourlyRate: 0, active: true },
    { id: "wk_nguyen", firstName: "Hugo", lastName: "Nguyen", type: "ALTERNANT" as const, category: "APPRENTI", trade: "Maçonnerie (alternance)", hourlyRate: 12, active: true },
  ];
  for (const w of workers) repo.upsertWorker(w);

  // Grille de coûts par chantier : panier repas + indemnité de déplacement
  // (le chantier de Villeurbanne, plus éloigné, ouvre une indemnité plus élevée).
  const costs = [
    { workerId: "wk_dupont", chantierId: "ch_lyon", mealAllowance: 11, travelAllowance: 8 },
    { workerId: "wk_silva", chantierId: "ch_lyon", mealAllowance: 11, travelAllowance: 8 },
    { workerId: "wk_moreau", chantierId: "ch_lyon", mealAllowance: 11, travelAllowance: 8 },
    { workerId: "wk_koffi", chantierId: "ch_villeurb", mealAllowance: 11, travelAllowance: 18 },
    { workerId: "wk_petit", chantierId: "ch_villeurb", mealAllowance: 11, travelAllowance: 18 },
  ];
  for (const c of costs) repo.upsertCost(c);

  // Affectations de la semaine (décidées par le conducteur de travaux).
  const cond = "conducteur1";
  const week1 = "2026-07-30";
  const asgList = [
    { workerId: "wk_dupont", chantierId: "ch_lyon" },
    { workerId: "wk_silva", chantierId: "ch_lyon" },
    { workerId: "wk_moreau", chantierId: "ch_lyon" },
  ];
  let ai = 0;
  for (const a of asgList) {
    ai += 1;
    repo.upsertAssignment(
      buildWeekAssignment({ ...a, anyDate: week1, assignedBy: cond }, { id: `asg_${ai}`, now: nowISO() }),
    );
  }
  // Remplacement en cours de semaine : Koffi (arrêt maladie) remplacé par Petit dès le jeudi.
  const koffiAsg = buildWeekAssignment(
    { workerId: "wk_koffi", chantierId: "ch_villeurb", anyDate: week1, assignedBy: cond },
    { id: "asg_koffi", now: nowISO() },
  );
  const { ended, replacement } = replaceWorker(koffiAsg, "wk_petit", "2026-07-30", {
    id: "asg_petit",
    now: nowISO(),
    assignedBy: cond,
    note: "Remplacement suite arrêt maladie",
  });
  repo.upsertAssignment(ended);
  repo.upsertAssignment(replacement);

  const chef = "wk_martin";
  const week = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
  let n = 0;
  const add = (input: Omit<TimeEntryInput, "recordedBy">) => {
    n += 1;
    const e = buildTimeEntry({ ...input, recordedBy: chef }, { id: `seed_${n}`, now: nowISO() });
    repo.saveEntry(e);
  };

  for (const date of week) {
    add({ workerId: "wk_dupont", chantierId: "ch_lyon", date, kind: "TRAVAIL", startTime: "07:30", endTime: "16:30", breakMinutes: 60 });
    add({ workerId: "wk_silva", chantierId: "ch_lyon", date, kind: "TRAVAIL", startTime: "07:30", endTime: "17:30", breakMinutes: 60 });
    // Stagiaire et alternant présents dans l'équipe (heures par chantier suivies).
    add({ workerId: "wk_leroy", chantierId: "ch_lyon", date, kind: "TRAVAIL", startTime: "08:00", endTime: "16:00", breakMinutes: 60 });
    add({ workerId: "wk_nguyen", chantierId: "ch_lyon", date, kind: "TRAVAIL", startTime: "07:30", endTime: "16:30", breakMinutes: 60 });
  }
  // Koffi : semaine avec une intempérie et une absence
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-27", kind: "TRAVAIL", minutes: 480 });
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-28", kind: "INTEMPERIE", minutes: 300, note: "Pluie forte, coulage béton reporté" });
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-29", kind: "ABSENCE", absenceReason: "MALADIE" });
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-30", kind: "TRAVAIL", minutes: 480 });
  // Moreau : accident bénin
  add({ workerId: "wk_moreau", chantierId: "ch_lyon", date: "2026-07-29", kind: "ACCIDENT", minutes: 180, accidentSeverity: "AVEC_ARRET", note: "Chute de plain-pied, entorse cheville" });
  // Silva : journée fériée travaillée (14 juillet) → heures fériées sur le relevé.
  add({ workerId: "wk_silva", chantierId: "ch_lyon", date: "2026-07-14", kind: "TRAVAIL", startTime: "07:30", endTime: "15:30", breakMinutes: 30, note: "Coulage urgent (jour férié)" });

  console.log(`Seed terminé : ${workers.length} personnes, ${n} pointages.`);
}

// Exécution directe
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  const db = openDb(DB_PATH);
  seed(new Repository(db));
  db.close();
}
