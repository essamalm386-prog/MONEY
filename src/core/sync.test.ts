import { describe, expect, it } from "vitest";
import { mergeBatch, resolve, tombstone, touch } from "./sync.js";
import type { TimeEntry } from "./types.js";

function entry(over: Partial<TimeEntry> & { id: string }): TimeEntry {
  return {
    workerId: "w1",
    chantierId: "c1",
    date: "2026-07-30",
    kind: "TRAVAIL",
    minutes: 480,
    recordedBy: "chef1",
    createdAt: "2026-07-30T18:00:00Z",
    updatedAt: "2026-07-30T18:00:00Z",
    version: 1,
    sync: "SYNCED",
    ...over,
  };
}

describe("resolve", () => {
  it("la version la plus élevée gagne", () => {
    const a = entry({ id: "e1", version: 2, minutes: 500 });
    const b = entry({ id: "e1", version: 1, minutes: 480 });
    expect(resolve(a, b).minutes).toBe(500);
    expect(resolve(b, a).minutes).toBe(500);
  });
  it("à version égale, updatedAt le plus récent gagne", () => {
    const a = entry({ id: "e1", version: 1, updatedAt: "2026-07-30T10:00:00Z", minutes: 400 });
    const b = entry({ id: "e1", version: 1, updatedAt: "2026-07-30T12:00:00Z", minutes: 480 });
    expect(resolve(a, b).minutes).toBe(480);
  });
  it("refuse deux ids différents", () => {
    expect(() => resolve(entry({ id: "a" }), entry({ id: "b" }))).toThrow();
  });
});

describe("mergeBatch", () => {
  it("ajoute les nouveaux et met à jour les versionnés", () => {
    const current = [entry({ id: "e1", version: 1 }), entry({ id: "e2", version: 3 })];
    const incoming = [
      entry({ id: "e1", version: 2, minutes: 500 }), // update
      entry({ id: "e2", version: 1, minutes: 999 }), // ignoré (version < )
      entry({ id: "e3", version: 1 }), // add
    ];
    const res = mergeBatch(current, incoming);
    expect(res.addedIds).toEqual(["e3"]);
    expect(res.updatedIds).toEqual(["e1"]);
    const e1 = res.merged.find((e) => e.id === "e1")!;
    const e2 = res.merged.find((e) => e.id === "e2")!;
    expect(e1.minutes).toBe(500);
    expect(e2.minutes).toBe(480); // inchangé
    expect(res.merged).toHaveLength(3);
  });
  it("ne mute pas les entrées d'origine", () => {
    const current = [entry({ id: "e1", version: 1 })];
    const snapshot = JSON.stringify(current);
    mergeBatch(current, [entry({ id: "e1", version: 2 })]);
    expect(JSON.stringify(current)).toBe(snapshot);
  });
  it("propage une suppression (tombstone) via version supérieure", () => {
    const current = [entry({ id: "e1", version: 1 })];
    const del = tombstone(current[0]!, "2026-07-31T09:00:00Z");
    const res = mergeBatch(current, [del]);
    expect(res.merged[0]!.deleted).toBe(true);
    expect(res.merged[0]!.version).toBe(2);
  });
  it("est idempotent (rejouer le même lot ne change rien)", () => {
    const current = [entry({ id: "e1", version: 1 })];
    const incoming = [entry({ id: "e1", version: 2, minutes: 500 })];
    const once = mergeBatch(current, incoming);
    const twice = mergeBatch(once.merged, incoming);
    expect(twice.updatedIds).toEqual([]);
    expect(twice.addedIds).toEqual([]);
    expect(twice.merged).toEqual(once.merged);
  });
});

describe("touch / tombstone", () => {
  it("touch incrémente version + horodate + repasse en LOCAL", () => {
    const e = entry({ id: "e1", version: 1, sync: "SYNCED" });
    const t = touch(e, "2026-07-31T09:00:00Z");
    expect(t.version).toBe(2);
    expect(t.updatedAt).toBe("2026-07-31T09:00:00Z");
    expect(t.sync).toBe("LOCAL");
  });
  it("tombstone marque deleted", () => {
    const t = tombstone(entry({ id: "e1", version: 1 }), "2026-07-31T09:00:00Z");
    expect(t.deleted).toBe(true);
    expect(t.version).toBe(2);
  });
});
