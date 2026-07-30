import { describe, expect, it } from "vitest";
import {
  assignedWorkerIds,
  assignmentsForDate,
  buildWeekAssignment,
  coversDate,
  endAssignment,
  overlaps,
  replaceWorker,
} from "./assignments.js";
import type { Assignment } from "./types.js";

function asg(over: Partial<Assignment> & { id: string }): Assignment {
  return {
    workerId: "w1",
    chantierId: "c1",
    startDate: "2026-07-27",
    endDate: "2026-08-02",
    assignedBy: "cond1",
    status: "ACTIVE",
    createdAt: "x",
    updatedAt: "x",
    version: 1,
    sync: "LOCAL",
    ...over,
  };
}

describe("coversDate", () => {
  it("dans la période", () => {
    expect(coversDate(asg({ id: "a" }), "2026-07-30")).toBe(true);
    expect(coversDate(asg({ id: "a" }), "2026-07-27")).toBe(true);
    expect(coversDate(asg({ id: "a" }), "2026-08-02")).toBe(true);
  });
  it("hors période", () => {
    expect(coversDate(asg({ id: "a" }), "2026-07-26")).toBe(false);
    expect(coversDate(asg({ id: "a" }), "2026-08-03")).toBe(false);
  });
  it("endDate ouverte couvre le futur", () => {
    expect(coversDate(asg({ id: "a", endDate: undefined }), "2027-01-01")).toBe(true);
  });
  it("ignore les supprimées", () => {
    expect(coversDate(asg({ id: "a", deleted: true }), "2026-07-30")).toBe(false);
  });
});

describe("assignmentsForDate / assignedWorkerIds", () => {
  const data = [
    asg({ id: "a1", workerId: "w1", chantierId: "c1" }),
    asg({ id: "a2", workerId: "w2", chantierId: "c1" }),
    asg({ id: "a3", workerId: "w3", chantierId: "c2" }),
    // Affectation clôturée le 28 (remplacée) : ne couvre plus le 30.
    asg({ id: "a4", workerId: "w4", chantierId: "c1", status: "ENDED", endDate: "2026-07-28" }),
  ];
  it("filtre par chantier, date et couverture", () => {
    const ids = assignedWorkerIds(data, "c1", "2026-07-30");
    expect(ids.sort()).toEqual(["w1", "w2"]); // w4 clôturé le 28 → exclu
  });
  it("autre chantier", () => {
    expect(assignedWorkerIds(data, "c2", "2026-07-30")).toEqual(["w3"]);
  });
});

describe("buildWeekAssignment", () => {
  it("cale la période sur lundi→dimanche", () => {
    const a = buildWeekAssignment(
      { workerId: "w1", chantierId: "c1", anyDate: "2026-07-30", assignedBy: "cond1" },
      { id: "a1", now: "2026-07-24T10:00:00Z" },
    );
    expect(a.startDate).toBe("2026-07-27"); // lundi
    expect(a.endDate).toBe("2026-08-02"); // dimanche
    expect(a.status).toBe("ACTIVE");
  });
});

describe("remplacement en cours de semaine", () => {
  it("endAssignment clôt la veille du remplacement", () => {
    const original = asg({ id: "a1" });
    const ended = endAssignment(original, "2026-07-30", "2026-07-29T18:00:00Z");
    expect(ended.endDate).toBe("2026-07-29");
    expect(ended.status).toBe("ENDED");
    expect(ended.version).toBe(2);
  });

  it("replaceWorker clôt l'original et crée le remplaçant", () => {
    const original = asg({ id: "a1", workerId: "interim_A" });
    const { ended, replacement } = replaceWorker(original, "interim_B", "2026-07-30", {
      id: "a2",
      now: "2026-07-29T18:00:00Z",
      assignedBy: "cond1",
    });
    expect(ended.endDate).toBe("2026-07-29");
    expect(ended.status).toBe("ENDED");
    expect(replacement.workerId).toBe("interim_B");
    expect(replacement.startDate).toBe("2026-07-30");
    expect(replacement.endDate).toBe("2026-08-02"); // reprend la fin initiale
    expect(replacement.replacesWorkerId).toBe("interim_A");

    // Continuité : avant le 30 c'est A, à partir du 30 c'est B.
    const all = [ended, replacement];
    expect(assignedWorkerIds(all, "c1", "2026-07-29")).toEqual(["interim_A"]);
    expect(assignedWorkerIds(all, "c1", "2026-07-30")).toEqual(["interim_B"]);
  });
});

describe("overlaps", () => {
  it("détecte un chevauchement même personne/chantier", () => {
    const a = asg({ id: "a1", startDate: "2026-07-27", endDate: "2026-07-31" });
    const b = asg({ id: "a2", startDate: "2026-07-30", endDate: "2026-08-05" });
    expect(overlaps(a, b)).toBe(true);
  });
  it("pas de chevauchement si périodes disjointes", () => {
    const a = asg({ id: "a1", startDate: "2026-07-27", endDate: "2026-07-29" });
    const b = asg({ id: "a2", startDate: "2026-07-30", endDate: "2026-08-02" });
    expect(overlaps(a, b)).toBe(false);
  });
});
