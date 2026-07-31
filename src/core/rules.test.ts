import { describe, expect, it } from "vitest";
import {
  accidentDeclaredInTime,
  buildTimeEntry,
  isDuplicate,
  validateTimeEntry,
  type TimeEntryInput,
} from "./rules.js";
import type { TimeEntry } from "./types.js";

const base: TimeEntryInput = {
  workerId: "w1",
  chantierId: "c1",
  date: "2026-07-30",
  kind: "TRAVAIL",
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: 60,
  recordedBy: "chef1",
};

describe("validateTimeEntry", () => {
  it("valide un pointage TRAVAIL avec créneau", () => {
    const r = validateTimeEntry(base);
    expect(r.ok).toBe(true);
    expect(r.minutes).toBe(480);
  });
  it("résout les minutes depuis un total direct", () => {
    const r = validateTimeEntry({ ...base, startTime: undefined, endTime: undefined, minutes: 420 });
    expect(r.ok).toBe(true);
    expect(r.minutes).toBe(420);
  });
  it("refuse un TRAVAIL sans heures", () => {
    const r = validateTimeEntry({ ...base, startTime: undefined, endTime: undefined, minutes: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/minutes/);
  });
  it("exige un motif pour une ABSENCE et force minutes à 0", () => {
    const r = validateTimeEntry({
      workerId: "w1",
      chantierId: "c1",
      date: "2026-07-30",
      kind: "ABSENCE",
      recordedBy: "chef1",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/motif/);
    expect(r.minutes).toBe(0);
  });
  it("accepte une ABSENCE justifiée", () => {
    const r = validateTimeEntry({
      workerId: "w1",
      chantierId: "c1",
      date: "2026-07-30",
      kind: "ABSENCE",
      absenceReason: "CONGE_PAYE",
      recordedBy: "chef1",
    });
    expect(r.ok).toBe(true);
  });
  it("exige la gravité pour un ACCIDENT", () => {
    const r = validateTimeEntry({
      workerId: "w1",
      chantierId: "c1",
      date: "2026-07-30",
      kind: "ACCIDENT",
      minutes: 120,
      recordedBy: "chef1",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/gravité/);
  });
  it("exige des heures perdues pour une INTEMPERIE", () => {
    const r = validateTimeEntry({
      workerId: "w1",
      chantierId: "c1",
      date: "2026-07-30",
      kind: "INTEMPERIE",
      minutes: 0,
      recordedBy: "chef1",
    });
    expect(r.ok).toBe(false);
  });
  it("rejette les champs obligatoires manquants", () => {
    const r = validateTimeEntry({ ...base, workerId: "", recordedBy: "" });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("workerId requis");
    expect(r.errors).toContain("recordedBy (chef de chantier) requis");
  });
  it("rejette une durée irréaliste", () => {
    const r = validateTimeEntry({ ...base, startTime: undefined, endTime: undefined, minutes: 14 * 60 });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/irréaliste/);
  });
  it("rejette une date invalide", () => {
    const r = validateTimeEntry({ ...base, date: "2026-02-30" });
    expect(r.ok).toBe(false);
  });
});

describe("buildTimeEntry", () => {
  it("construit un pointage normalisé", () => {
    const e = buildTimeEntry(base, { id: "e1", now: "2026-07-30T18:00:00Z" });
    expect(e.id).toBe("e1");
    expect(e.minutes).toBe(480);
    expect(e.version).toBe(1);
    expect(e.sync).toBe("LOCAL");
    expect(e.createdAt).toBe("2026-07-30T18:00:00Z");
  });
  it("lève sur saisie invalide", () => {
    expect(() => buildTimeEntry({ ...base, workerId: "" }, { id: "e1", now: "x" })).toThrow();
  });
});

describe("isDuplicate", () => {
  const mk = (over: Partial<TimeEntry>): TimeEntry => ({
    id: "e1",
    workerId: "w1",
    chantierId: "c1",
    date: "2026-07-30",
    kind: "TRAVAIL",
    minutes: 480,
    recordedBy: "chef1",
    createdAt: "x",
    updatedAt: "x",
    version: 1,
    sync: "LOCAL",
    ...over,
  });
  it("détecte un doublon même personne/chantier/jour/nature", () => {
    expect(isDuplicate(mk({ id: "a" }), mk({ id: "b" }))).toBe(true);
  });
  it("ignore les tombstones", () => {
    expect(isDuplicate(mk({ id: "a", deleted: true }), mk({ id: "b" }))).toBe(false);
  });
  it("nature différente n'est pas un doublon", () => {
    expect(isDuplicate(mk({ id: "a", kind: "TRAVAIL" }), mk({ id: "b", kind: "ABSENCE" }))).toBe(
      false,
    );
  });
});

describe("accidentDeclaredInTime", () => {
  it("dans les délais (48h)", () => {
    expect(accidentDeclaredInTime("2026-07-30", "2026-07-31T10:00:00Z")).toBe(true);
  });
  it("hors délai", () => {
    expect(accidentDeclaredInTime("2026-07-30", "2026-08-05T10:00:00Z")).toBe(false);
  });
  it("déclaration antérieure impossible", () => {
    expect(accidentDeclaredInTime("2026-07-30", "2026-07-28T10:00:00Z")).toBe(false);
  });
});
