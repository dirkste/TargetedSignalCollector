import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { HwmStore } from "../../src/state/HwmStore.js";

const TEST_FILE = "tests/unit/hwm-test.json";

function cleanup() {
  if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
}

describe("HwmStore", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("returns null cursor and empty set when no file exists", () => {
    const store = new HwmStore(TEST_FILE);
    expect(store.getLastCursor()).toBeNull();
    expect(store.getProcessedIds().size).toBe(0);
  });

  it("commit() writes cursor and IDs to disk", () => {
    const store = new HwmStore(TEST_FILE);
    store.commit("5", ["id-a", "id-b"]);

    const fresh = new HwmStore(TEST_FILE);
    expect(fresh.getLastCursor()).toBe("5");
    expect(fresh.getProcessedIds().has("id-a")).toBe(true);
    expect(fresh.getProcessedIds().has("id-b")).toBe(true);
  });

  it("commit() accumulates IDs across multiple calls", () => {
    const store = new HwmStore(TEST_FILE);
    store.commit("3", ["id-1", "id-2"]);
    store.commit("6", ["id-3"]);

    const fresh = new HwmStore(TEST_FILE);
    expect(fresh.getProcessedIds().size).toBe(3);
    expect(fresh.getLastCursor()).toBe("6");
  });

  it("loads existing state correctly from a pre-existing file", () => {
    writeFileSync(
      TEST_FILE,
      JSON.stringify({ lastCursor: "10", processedIds: ["existing-id"] }),
      "utf-8"
    );
    const store = new HwmStore(TEST_FILE);
    expect(store.getLastCursor()).toBe("10");
    expect(store.getProcessedIds().has("existing-id")).toBe(true);
  });
});
