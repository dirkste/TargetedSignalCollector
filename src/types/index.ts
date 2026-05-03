import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------

export type SecretDict = Record<string, string>;

export type Cursor = string | null;

export type RawRecord = {
  id: string;
  rawContent: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type ConnectionStatus = {
  connected: boolean;
  message?: string;
};

// ---------------------------------------------------------------------------
// Universal Signal Contract
// ---------------------------------------------------------------------------

export const UniversalSignalSchema = z.object({
  signal_id: z.string().min(1),
  payload: z.string().min(1),
  origin_ts: z.string().datetime({ offset: true }),
  taxonomy_hint: z.string().min(1),
});

export type UniversalSignal = z.infer<typeof UniversalSignalSchema>;

// ---------------------------------------------------------------------------
// Source Adapter Interface
// ---------------------------------------------------------------------------

export interface SourceAdapter {
  connect(credentials: SecretDict): Promise<ConnectionStatus>;
  fetchNextBatch(cursor?: Cursor): Promise<[RawRecord[], Cursor]>;
  normalizeToSignal(record: RawRecord): UniversalSignal;
}
