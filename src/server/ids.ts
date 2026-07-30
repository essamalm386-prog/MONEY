import { randomUUID } from "node:crypto";

/** Identifiant unique pour une nouvelle entité. */
export function newId(prefix = ""): string {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID();
}

/** Horodatage ISO courant (isolé pour faciliter les tests). */
export function nowISO(): string {
  return new Date().toISOString();
}
