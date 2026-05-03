import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { SignalProcessor, TaxonomyValidationError } from "../../src/engine/SignalProcessor.js";
import { HwmStore } from "../../src/state/HwmStore.js";
import { MockSoftwareTestStrategyAdapter } from "../../src/adapters/MockSoftwareTestStrategyAdapter.js";
import type { BrainBridge } from "../../src/bridge/BrainBridge.js";
import type { RawRecord, UniversalSignal } from "../../src/types/index.js";

const HWM_FILE = "tests/unit/hwm-processor.json";

function cleanup() {
  if (existsSync(HWM_FILE)) unlinkSync(HWM_FILE);
}

// Minimal mock bridge that always succeeds
function makeSuccessBridge(): BrainBridge {
  return { deliver: vi.fn().mockResolvedValue(undefined) } as unknown as BrainBridge;
}

describe("SignalProcessor — deduplication", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("filters out signals whose signal_id is already in the HWM", async () => {
    const hwm = new HwmStore(HWM_FILE);
    // Pre-populate HWM with the first 3 mock IDs
    hwm.commit("3", ["tsc-mock-001", "tsc-mock-002", "tsc-mock-003"]);

    const bridge = makeSuccessBridge();
    const processor = new SignalProcessor();
    await processor.run(new MockSoftwareTestStrategyAdapter(), hwm, bridge);

    // Only the 2 remaining IDs should have been delivered
    const deliverCalls = vi.mocked(bridge.deliver).mock.calls;
    const deliveredIds = deliverCalls.flatMap(([signals]) =>
      signals.map((s: UniversalSignal) => s.signal_id)
    );
    expect(deliveredIds).not.toContain("tsc-mock-001");
    expect(deliveredIds).not.toContain("tsc-mock-002");
    expect(deliveredIds).not.toContain("tsc-mock-003");
    expect(deliveredIds).toContain("tsc-mock-004");
    expect(deliveredIds).toContain("tsc-mock-005");
  });

  it("delivers nothing on a second run (full idempotency)", async () => {
    const bridge = makeSuccessBridge();
    const processor = new SignalProcessor();

    const hwm1 = new HwmStore(HWM_FILE);
    await processor.run(new MockSoftwareTestStrategyAdapter(), hwm1, bridge);

    const hwm2 = new HwmStore(HWM_FILE);
    await processor.run(new MockSoftwareTestStrategyAdapter(), hwm2, bridge);

    const callCount = vi.mocked(bridge.deliver).mock.calls.length;
    // Second run should produce no deliver calls
    const secondRunCalls = vi.mocked(bridge.deliver).mock.calls.slice(callCount);
    expect(secondRunCalls.length).toBe(0);
  });
});

describe("SignalProcessor — taxonomy validation", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("throws TaxonomyValidationError for an invalid taxonomy_hint", async () => {
    const badRecord: RawRecord = {
      id: "bad-001",
      rawContent: "some content",
      timestamp: "2020-01-01T00:00:00.000Z",
    };

    // Adapter that returns one record with a wrong taxonomy
    const badAdapter = new MockSoftwareTestStrategyAdapter([badRecord]);
    vi.spyOn(badAdapter, "normalizeToSignal").mockReturnValue({
      signal_id: "bad-001",
      payload: "some content",
      origin_ts: "2020-01-01T00:00:00.000Z",
      taxonomy_hint: "Personal > Hobbies > Cooking",
    });

    const hwm = new HwmStore(HWM_FILE);
    const bridge = makeSuccessBridge();
    const processor = new SignalProcessor();

    await expect(processor.run(badAdapter, hwm, bridge)).rejects.toThrow(
      TaxonomyValidationError
    );
  });
});

describe("SignalProcessor — HWM commit guard", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("does NOT advance the HWM when bridge.deliver throws", async () => {
    const failBridge: BrainBridge = {
      deliver: vi.fn().mockRejectedValue(new Error("Network failure")),
    } as unknown as BrainBridge;

    const hwm = new HwmStore(HWM_FILE);
    const processor = new SignalProcessor();

    await expect(
      processor.run(new MockSoftwareTestStrategyAdapter(), hwm, failBridge)
    ).rejects.toThrow("Network failure");

    // HWM file should not exist / cursor should still be null
    const freshHwm = new HwmStore(HWM_FILE);
    expect(freshHwm.getLastCursor()).toBeNull();
    expect(freshHwm.getProcessedIds().size).toBe(0);
  });
});
