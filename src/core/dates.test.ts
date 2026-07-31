import { describe, expect, it } from "vitest";
import {
  addDays,
  eachDay,
  hoursBetween,
  isValidISODate,
  isoWeek,
  isoWeekKey,
  isoWeekday,
  isWeekend,
  monthKey,
  parseISODate,
  startOfISOWeek,
} from "./dates.js";

describe("parseISODate", () => {
  it("accepte une date valide", () => {
    expect(parseISODate("2026-07-30")).toEqual({ y: 2026, m: 7, d: 30 });
  });
  it("rejette les formats invalides", () => {
    expect(() => parseISODate("2026-7-30")).toThrow();
    expect(() => parseISODate("30/07/2026")).toThrow();
  });
  it("rejette les dates inexistantes", () => {
    expect(() => parseISODate("2026-02-30")).toThrow();
    expect(() => parseISODate("2026-13-01")).toThrow();
  });
  it("isValidISODate", () => {
    expect(isValidISODate("2024-02-29")).toBe(true); // bissextile
    expect(isValidISODate("2026-02-29")).toBe(false);
  });
});

describe("jours de semaine", () => {
  it("isoWeekday : lundi=1 … dimanche=7", () => {
    expect(isoWeekday("2026-07-27")).toBe(1); // lundi
    expect(isoWeekday("2026-07-30")).toBe(4); // jeudi
    expect(isoWeekday("2026-08-02")).toBe(7); // dimanche
  });
  it("isWeekend", () => {
    expect(isWeekend("2026-08-01")).toBe(true); // samedi
    expect(isWeekend("2026-08-02")).toBe(true); // dimanche
    expect(isWeekend("2026-07-30")).toBe(false);
  });
});

describe("semaines ISO", () => {
  it("startOfISOWeek renvoie le lundi", () => {
    expect(startOfISOWeek("2026-07-30")).toBe("2026-07-27");
    expect(startOfISOWeek("2026-07-27")).toBe("2026-07-27");
  });
  it("isoWeek / isoWeekKey", () => {
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    // 2026-07-30 est en semaine 31
    expect(isoWeek("2026-07-30").week).toBe(31);
  });
  it("cas limite fin d'année (1er janv. appartient à S52/53 de l'an passé)", () => {
    // 2022-01-01 est un samedi → semaine 52 de 2021 en ISO-8601
    expect(isoWeekKey("2022-01-01")).toBe("2021-W52");
  });
});

describe("mois et intervalles", () => {
  it("monthKey", () => {
    expect(monthKey("2026-07-30")).toBe("2026-07");
  });
  it("addDays gère les fins de mois et années", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("eachDay inclusif", () => {
    expect(eachDay("2026-07-30", "2026-08-01")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
    expect(eachDay("2026-08-01", "2026-07-30")).toEqual([]);
  });
});

describe("hoursBetween", () => {
  it("calcule un délai en heures", () => {
    expect(hoursBetween("2026-07-30T08:00:00Z", "2026-07-30T20:00:00Z")).toBe(12);
  });
  it("erreur sur datetime invalide", () => {
    expect(() => hoursBetween("nope", "2026-07-30T20:00:00Z")).toThrow();
  });
});
