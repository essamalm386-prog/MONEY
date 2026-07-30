/**
 * Jeu de données de démonstration : 2 chantiers, 1 agence, 5 personnes et une
 * semaine de pointages (travail, intempérie, absence, accident).
 */
import { buildTimeEntry, type TimeEntryInput } from "../core/index.js";
import { openDb } from "./db.js";
import { Repository } from "./repository.js";
import { nowISO } from "./ids.js";

const DB_PATH = process.env.DB_PATH ?? "data/pointage.db";

export function seed(repo: Repository): void {
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
    { id: "wk_martin", firstName: "Karim", lastName: "Benali", type: "EMPLOYE" as const, trade: "Chef d'équipe maçonnerie", hourlyRate: 24, active: true },
    { id: "wk_dupont", firstName: "Luc", lastName: "Dupont", type: "EMPLOYE" as const, trade: "Coffreur", hourlyRate: 21, active: true },
    { id: "wk_silva", firstName: "João", lastName: "Silva", type: "INTERIMAIRE" as const, trade: "Maçon", agencyId: "ag_demo", hourlyRate: 20, active: true },
    { id: "wk_koffi", firstName: "Yao", lastName: "Koffi", type: "INTERIMAIRE" as const, trade: "Manœuvre", agencyId: "ag_demo", hourlyRate: 18, active: true },
    { id: "wk_moreau", firstName: "Sophie", lastName: "Moreau", type: "EMPLOYE" as const, trade: "Grutier", hourlyRate: 23, active: true },
  ];
  for (const w of workers) repo.upsertWorker(w);

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
  }
  // Koffi : semaine avec une intempérie et une absence
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-27", kind: "TRAVAIL", minutes: 480 });
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-28", kind: "INTEMPERIE", minutes: 300, note: "Pluie forte, coulage béton reporté" });
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-29", kind: "ABSENCE", absenceReason: "MALADIE" });
  add({ workerId: "wk_koffi", chantierId: "ch_villeurb", date: "2026-07-30", kind: "TRAVAIL", minutes: 480 });
  // Moreau : accident bénin
  add({ workerId: "wk_moreau", chantierId: "ch_lyon", date: "2026-07-29", kind: "ACCIDENT", minutes: 180, accidentSeverity: "AVEC_ARRET", note: "Chute de plain-pied, entorse cheville" });

  console.log(`Seed terminé : ${workers.length} personnes, ${n} pointages.`);
}

// Exécution directe
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  const db = openDb(DB_PATH);
  seed(new Repository(db));
  db.close();
}
