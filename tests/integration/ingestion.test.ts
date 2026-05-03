import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { SignalProcessor } from "../../src/engine/SignalProcessor.js";
import { HwmStore } from "../../src/state/HwmStore.js";
import { MockSoftwareTestStrategyAdapter } from "../../src/adapters/MockSoftwareTestStrategyAdapter.js";
import { BridgeDeliveryError } from "../../src/bridge/BrainBridge.js";
import type { BrainBridge } from "../../src/bridge/BrainBridge.js";
import type { UniversalSignal } from "../../src/types/index.js";

const HWM_FILE = "tests/integration/hwm-integration.json";

function cleanup() {
  if (existsSync(HWM_FILE)) unlinkSync(HWM_FILE);
}

function makeSuccessBridge(): BrainBridge {
  return { deliver: vi.fn().mockResolvedValue(undefined) } as unknown as BrainBridge;
}

describe("Integration: full ingestion loop (happy path)", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("delivers all 5 mock signals and advances the HWM", async () => {
    const bridge = makeSuccessBridge();
    const hwm = new HwmStore(HWM_FILE);
    const processor = new SignalProcessor();

    await processor.run(new MockSoftwareTestStrategyAdapter(), {}, hwm, bridge);

    // Bridge was called (at least once — may be batched)
    expect(vi.mocked(bridge.deliver)).toHaveBeenCalled();

    // Collect all delivered signal IDs across all calls
    const allDelivered = vi
      .mocked(bridge.deliver)
      .mock.calls.flatMap(([signals]) =>
        signals.map((s: UniversalSignal) => s.signal_id)
      );

    expect(allDelivered).toHaveLength(5);
    expect(allDelivered).toContain("tsc-mock-001");
    expect(allDelivered).toContain("tsc-mock-005");

    // HWM file should exist and cursor should be null (end of stream)
    const freshHwm = new HwmStore(HWM_FILE);
    expect(freshHwm.getLastCursor()).toBeNull();
    expect(freshHwm.getProcessedIds().size).toBe(5);
  });
});

describe("Integration: idempotency (second run delivers nothing)", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("produces zero deliveries on the second run", async () => {
    const bridge = makeSuccessBridge();
    const processor = new SignalProcessor();

    // First run
    const hwm1 = new HwmStore(HWM_FILE);
    await processor.run(new MockSoftwareTestStrategyAdapter(), {}, hwm1, bridge);
    const firstRunCallCount = vi.mocked(bridge.deliver).mock.calls.length;

    // Second run with fresh HwmStore (but same persisted file)
    const hwm2 = new HwmStore(HWM_FILE);
    await processor.run(new MockSoftwareTestStrategyAdapter(), {}, hwm2, bridge);
    const totalCallCount = vi.mocked(bridge.deliver).mock.calls.length;

    expect(totalCallCount).toBe(firstRunCallCount); // no new calls on second run
  });
});

describe("Integration: error recovery — HWM not advanced on bridge failure", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("leaves the HWM unchanged when bridge.deliver throws BridgeDeliveryError", async () => {
    const failBridge: BrainBridge = {
      deliver: vi.fn().mockRejectedValue(
        new BridgeDeliveryError(503, "Service Unavailable")
      ),
    } as unknown as BrainBridge;

    const hwm = new HwmStore(HWM_FILE);
    const processor = new SignalProcessor();

    await expect(
      processor.run(new MockSoftwareTestStrategyAdapter(), {}, hwm, failBridge)
    ).rejects.toThrow(BridgeDeliveryError);

    // HWM file must NOT have been created / modified
    expect(existsSync(HWM_FILE)).toBe(false);
  });

  it("allows a clean retry after a previous failure (no signals lost)", async () => {
    // First attempt: fails
    const failBridge: BrainBridge = {
      deliver: vi.fn().mockRejectedValue(new Error("Timeout")),
    } as unknown as BrainBridge;

    const hwm1 = new HwmStore(HWM_FILE);
    const processor = new SignalProcessor();
    await expect(
      processor.run(new MockSoftwareTestStrategyAdapter(), {}, hwm1, failBridge)
    ).rejects.toThrow();

    // Second attempt: succeeds — should still deliver all 5 signals
    const successBridge = makeSuccessBridge();
    const hwm2 = new HwmStore(HWM_FILE);
    await processor.run(new MockSoftwareTestStrategyAdapter(), {}, hwm2, successBridge);

    const allDelivered = vi
      .mocked(successBridge.deliver)
      .mock.calls.flatMap(([signals]) =>
        signals.map((s: UniversalSignal) => s.signal_id)
      );
    expect(allDelivered).toHaveLength(5);
  });
});
