import { describe, expect, it } from "vitest";
import {
  assignedWorkerIds,
  assignmentsForDate,
  buildWeekAssignment,
  chefAssignment,
  coversDate,
  endAssignment,
  findConflict,
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

describe("findConflict — une personne, un seul chantier à la fois", () => {
  const existing = [asg({ id: "a1", workerId: "w1", chantierId: "c1" })]; // 27/07 → 02/08

  it("refuse la même personne sur un autre chantier les mêmes jours", () => {
    const c = findConflict(existing, "w1", "c2", "2026-07-29", "2026-08-04");
    expect(c?.id).toBe("a1");
  });

  it("accepte sur des semaines disjointes", () => {
    expect(findConflict(existing, "w1", "c2", "2026-08-03", "2026-08-09")).toBeUndefined();
  });

  it("accepte le même chantier (prolongation)", () => {
    expect(findConflict(existing, "w1", "c1", "2026-07-27", "2026-08-02")).toBeUndefined();
  });

  it("ignore l'affectation en cours de modification et les supprimées", () => {
    expect(findConflict(existing, "w1", "c2", "2026-07-29", "2026-08-04", "a1")).toBeUndefined();
    const removed = [asg({ id: "a1", chantierId: "c1", deleted: true })];
    expect(findConflict(removed, "w1", "c2", "2026-07-29", "2026-08-04")).toBeUndefined();
  });

  it("une affectation sans fin bloque tout le futur", () => {
    const openEnded = [asg({ id: "a9", workerId: "w1", chantierId: "c1", endDate: undefined })];
    expect(findConflict(openEnded, "w1", "c2", "2027-03-01", "2027-03-07")?.id).toBe("a9");
  });
});

describe("chef de chantier désigné", () => {
  it("buildWeekAssignment porte le rôle de chef", () => {
    const a = buildWeekAssignment(
      { workerId: "w1", chantierId: "c1", anyDate: "2026-07-30", assignedBy: "cond1", isChef: true },
      { id: "a1", now: "2026-07-24T10:00:00Z" },
    );
    expect(a.isChef).toBe(true);
  });

  it("chefAssignment retrouve le chef du chantier à une date", () => {
    const data = [
      asg({ id: "a1", workerId: "w1", chantierId: "c1" }),
      asg({ id: "a2", workerId: "w2", chantierId: "c1", isChef: true }),
      asg({ id: "a3", workerId: "w3", chantierId: "c2", isChef: true }),
    ];
    expect(chefAssignment(data, "c1", "2026-07-30")?.workerId).toBe("w2");
    expect(chefAssignment(data, "c2", "2026-07-30")?.workerId).toBe("w3");
    expect(chefAssignment(data, "c1", "2026-09-01")).toBeUndefined();
  });

  it("le remplaçant d'un chef reprend l'encadrement", () => {
    const original = asg({ id: "a1", workerId: "chef_A", isChef: true });
    const { replacement } = replaceWorker(original, "chef_B", "2026-07-30", {
      id: "a2",
      now: "2026-07-29T18:00:00Z",
      assignedBy: "cond1",
    });
    expect(replacement.isChef).toBe(true);
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
