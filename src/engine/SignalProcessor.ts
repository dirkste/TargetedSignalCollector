import type { SourceAdapter, SecretDict, UniversalSignal } from "../types/index.js";
import type { HwmStore } from "../state/HwmStore.js";
import type { BrainBridge } from "../bridge/BrainBridge.js";

const ALLOWED_TAXONOMY_PREFIX = "Professional > Computer Science > Software Test Strategy";

export class TaxonomyValidationError extends Error {
  constructor(signalId: string, hint: string) {
    super(
      `Signal "${signalId}" has invalid taxonomy_hint: "${hint}". ` +
        `Expected prefix: "${ALLOWED_TAXONOMY_PREFIX}"`
    );
    this.name = "TaxonomyValidationError";
  }
}

// ---------------------------------------------------------------------------
// SignalProcessor — Tier 2 Orchestration Layer
// ---------------------------------------------------------------------------

export class SignalProcessor {
  async run(
    adapter: SourceAdapter,
    credentials: SecretDict,
    hwmStore: HwmStore,
    bridge: BrainBridge
  ): Promise<void> {
    await adapter.connect(credentials);

    const processedIds = hwmStore.getProcessedIds();
    let cursor = hwmStore.getLastCursor();

    do {
      const [rawBatch, nextCursor] = await adapter.fetchNextBatch(cursor);

      if (rawBatch.length === 0) {
        break;
      }

      // Normalize all records to Universal Signals
      const signals: UniversalSignal[] = rawBatch.map((record) =>
        adapter.normalizeToSignal(record)
      );

      // Deduplication — filter out signals already in the HWM state
      const newSignals = signals.filter(
        (s) => !processedIds.has(s.signal_id)
      );

      // Taxonomy validation — all signals must match the allowed prefix
      for (const signal of newSignals) {
        if (!signal.taxonomy_hint.startsWith(ALLOWED_TAXONOMY_PREFIX)) {
          throw new TaxonomyValidationError(
            signal.signal_id,
            signal.taxonomy_hint
          );
        }
      }

      if (newSignals.length > 0) {
        // Deliver first — only commit HWM on success
        await bridge.deliver(newSignals);

        const deliveredIds = newSignals.map((s) => s.signal_id);
        hwmStore.commit(nextCursor, deliveredIds);

        // Track in-memory for subsequent batches in the same run
        for (const id of deliveredIds) {
          processedIds.add(id);
        }
      } else {
        // All signals in this batch were already processed — advance cursor
        // without recording new IDs so we don't re-fetch on the next run.
        hwmStore.commit(nextCursor, []);
      }

      cursor = nextCursor;
    } while (cursor !== null);
  }
}
