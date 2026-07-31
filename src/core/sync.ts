/**
 * Fusion local-first des pointages.
 *
 * Chaque appareil (chef de chantier) saisit hors-ligne puis pousse ses
 * modifications au serveur. La résolution de conflits est déterministe :
 *   1. version la plus élevée gagne ;
 *   2. à version égale, `updatedAt` le plus récent gagne ;
 *   3. à égalité stricte, l'`id` le plus grand tranche (stable et reproductible).
 * Un tombstone (`deleted: true`) l'emporte à version supérieure comme toute
 * autre modification — la suppression se propage donc proprement.
 */
import type { TimeEntry } from "./types.js";

/** Retourne l'enregistrement gagnant entre deux versions d'un même id. */
export function resolve(a: TimeEntry, b: TimeEntry): TimeEntry {
  if (a.id !== b.id) throw new Error("resolve() attend deux versions du même id");
  if (a.version !== b.version) return a.version > b.version ? a : b;
  const ta = Date.parse(a.updatedAt);
  const tb = Date.parse(b.updatedAt);
  if (ta !== tb) return ta > tb ? a : b;
  return a.id >= b.id ? a : b; // départage stable (ici ids égaux → a)
}

export interface MergeResult {
  merged: TimeEntry[];
  /** ids dont la version distante a remplacé la version locale. */
  updatedIds: string[];
  /** ids nouvellement ajoutés depuis le distant. */
  addedIds: string[];
}

/**
 * Fusionne un lot entrant (`incoming`) dans un état courant (`current`).
 * Ne modifie pas les tableaux d'entrée ; renvoie un nouvel état trié par id.
 */
export function mergeBatch(current: TimeEntry[], incoming: TimeEntry[]): MergeResult {
  const map = new Map<string, TimeEntry>();
  for (const e of current) map.set(e.id, e);

  const updatedIds: string[] = [];
  const addedIds: string[] = [];

  for (const inc of incoming) {
    const existing = map.get(inc.id);
    if (!existing) {
      map.set(inc.id, inc);
      addedIds.push(inc.id);
      continue;
    }
    const winner = resolve(existing, inc);
    if (winner !== existing) {
      map.set(inc.id, winner);
      updatedIds.push(inc.id);
    }
  }

  const merged = [...map.values()].sort((x, y) => x.id.localeCompare(y.id));
  return { merged, updatedIds, addedIds };
}

/** Incrémente la version et l'horodatage lors d'une mise à jour locale. */
export function touch(entry: TimeEntry, now: string): TimeEntry {
  return { ...entry, version: entry.version + 1, updatedAt: now, sync: "LOCAL" };
}

/** Marque un pointage comme supprimé (tombstone) tout en versionnant. */
export function tombstone(entry: TimeEntry, now: string): TimeEntry {
  return { ...touch(entry, now), deleted: true };
}
