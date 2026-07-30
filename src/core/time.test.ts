import { describe, expect, it } from "vitest";
import {
  formatHHMM,
  hoursToMinutes,
  minutesToHours,
  parseHHMM,
  roundMinutes,
  weatherIndemnityAmount,
  weatherIndemnizableMinutes,
  weeklyOvertime,
  workedMinutes,
} from "./time.js";

describe("parseHHMM / formatHHMM", () => {
  it("parse des horaires valides", () => {
    expect(parseHHMM("08:00")).toBe(480);
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("23:59")).toBe(1439);
  });
  it("rejette les horaires invalides", () => {
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("8:0")).toBeNull();
    expect(parseHHMM("12:60")).toBeNull();
    expect(parseHHMM("abc")).toBeNull();
  });
  it("formate depuis les minutes", () => {
    expect(formatHHMM(480)).toBe("08:00");
    expect(formatHHMM(1439)).toBe("23:59");
    expect(formatHHMM(1500)).toBe("01:00"); // modulo 24h
  });
  it("aller-retour stable", () => {
    for (const t of ["07:30", "12:15", "18:45"]) {
      expect(formatHHMM(parseHHMM(t)!)).toBe(t);
    }
  });
});

describe("workedMinutes", () => {
  it("journée standard avec pause", () => {
    expect(workedMinutes("08:00", "17:00", 60)).toBe(480); // 8h
  });
  it("sans pause", () => {
    expect(workedMinutes("08:00", "12:00")).toBe(240);
  });
  it("passage de minuit", () => {
    expect(workedMinutes("22:00", "06:00", 0)).toBe(480);
  });
  it("erreur si la pause dépasse l'amplitude", () => {
    expect(() => workedMinutes("08:00", "09:00", 120)).toThrow();
  });
  it("erreur sur horaire invalide", () => {
    expect(() => workedMinutes("aa:bb", "17:00")).toThrow();
  });
});

describe("conversions", () => {
  it("minutes ⇄ heures", () => {
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(455)).toBe(7.58);
    expect(hoursToMinutes(7.5)).toBe(450);
  });
});

describe("roundMinutes", () => {
  it("arrondit au quart d'heure", () => {
    expect(roundMinutes(7, 15, "nearest")).toBe(0);
    expect(roundMinutes(8, 15, "nearest")).toBe(15);
    expect(roundMinutes(1, 15, "up")).toBe(15);
    expect(roundMinutes(29, 15, "down")).toBe(15);
  });
});

describe("weeklyOvertime — paliers BTP", () => {
  it("en deçà de 35h : tout normal", () => {
    const r = weeklyOvertime(30 * 60);
    expect(r.normalMinutes).toBe(1800);
    expect(r.tier1Minutes).toBe(0);
    expect(r.tier2Minutes).toBe(0);
    expect(r.paidEquivalentHours).toBe(30);
  });
  it("exactement 35h", () => {
    const r = weeklyOvertime(35 * 60);
    expect(r.normalMinutes).toBe(2100);
    expect(r.tier1Minutes).toBe(0);
    expect(r.paidEquivalentHours).toBe(35);
  });
  it("40h : 5h à +25%", () => {
    const r = weeklyOvertime(40 * 60);
    expect(minutesToHours(r.normalMinutes)).toBe(35);
    expect(minutesToHours(r.tier1Minutes)).toBe(5);
    expect(r.tier2Minutes).toBe(0);
    // 35 + 5*1.25 = 41.25
    expect(r.paidEquivalentHours).toBe(41.25);
  });
  it("48h : palier 2 déclenché", () => {
    const r = weeklyOvertime(48 * 60);
    expect(minutesToHours(r.normalMinutes)).toBe(35);
    expect(minutesToHours(r.tier1Minutes)).toBe(8); // 36→43
    expect(minutesToHours(r.tier2Minutes)).toBe(5); // 44→48
    // 35 + 8*1.25 + 5*1.5 = 35 + 10 + 7.5 = 52.5
    expect(r.paidEquivalentHours).toBe(52.5);
  });
  it("zéro et négatif", () => {
    expect(weeklyOvertime(0).paidEquivalentHours).toBe(0);
    expect(weeklyOvertime(-100).paidEquivalentHours).toBe(0);
  });
});

describe("intempéries — chômage-intempéries", () => {
  it("franchise d'1h non indemnisée", () => {
    expect(weatherIndemnizableMinutes(60)).toBe(0);
    expect(weatherIndemnizableMinutes(240)).toBe(180); // 4h perdues → 3h indemnisées
    expect(weatherIndemnizableMinutes(30)).toBe(0);
  });
  it("montant indemnité à 75%", () => {
    // 4h perdues → 3h indemnisables → 3 * 20 * 0.75 = 45€
    expect(weatherIndemnityAmount(240, 20)).toBe(45);
    expect(weatherIndemnityAmount(60, 20)).toBe(0);
  });
});
