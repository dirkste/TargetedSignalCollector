import type {
  SourceAdapter,
  SecretDict,
  ConnectionStatus,
  Cursor,
  RawRecord,
  UniversalSignal,
} from "../types/index.js";

/**
 * BaseAdapter provides common utilities for all adapters.
 * Concrete adapters must implement the three interface methods.
 */
export abstract class BaseAdapter implements SourceAdapter {
  abstract connect(credentials: SecretDict): Promise<ConnectionStatus>;
  abstract fetchNextBatch(cursor?: Cursor): Promise<[RawRecord[], Cursor]>;
  abstract normalizeToSignal(record: RawRecord): UniversalSignal;

  /**
   * Strip HTML tags and collapse whitespace to produce clean text.
   */
  protected stripHtml(raw: string): string {
    return raw
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}
