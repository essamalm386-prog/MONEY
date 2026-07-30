import { describe, expect, it } from "vitest";
import { easterSunday, frenchHolidays, isFrenchHoliday } from "./holidays.js";

describe("easterSunday", () => {
  it("dates de Pâques connues", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2024)).toBe("2024-03-31");
  });
});

describe("frenchHolidays", () => {
  it("inclut les fériés fixes et mobiles 2026", () => {
    const h = frenchHolidays(2026);
    expect(h.has("2026-01-01")).toBe(true); // Jour de l'an
    expect(h.has("2026-05-01")).toBe(true); // Fête du travail
    expect(h.has("2026-07-14")).toBe(true); // Fête nationale
    expect(h.has("2026-12-25")).toBe(true); // Noël
    expect(h.has("2026-04-06")).toBe(true); // Lundi de Pâques (Pâques + 1)
    expect(h.has("2026-05-14")).toBe(true); // Ascension (Pâques + 39)
    expect(h.has("2026-05-25")).toBe(true); // Lundi de Pentecôte (Pâques + 50)
  });
  it("compte 11 jours fériés", () => {
    expect(frenchHolidays(2026).size).toBe(11);
  });
});

describe("isFrenchHoliday", () => {
  it("reconnaît un férié et un jour ordinaire", () => {
    expect(isFrenchHoliday("2026-05-01")).toBe(true);
    expect(isFrenchHoliday("2026-07-14")).toBe(true);
    expect(isFrenchHoliday("2026-07-30")).toBe(false);
  });
});
