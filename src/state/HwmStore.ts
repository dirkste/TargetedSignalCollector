import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Cursor } from "../types/index.js";

// ---------------------------------------------------------------------------
// Shape of the persisted JSON file
// ---------------------------------------------------------------------------

interface HwmData {
  lastCursor: Cursor;
  processedIds: string[];
}

// ---------------------------------------------------------------------------
// HwmStore — JSON-backed High Water Mark persistence
// ---------------------------------------------------------------------------

export class HwmStore {
  private filePath: string;
  private data: HwmData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): HwmData {
    if (!existsSync(this.filePath)) {
      return { lastCursor: null, processedIds: [] };
    }
    const raw = readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw) as HwmData;
  }

  getLastCursor(): Cursor {
    return this.data.lastCursor;
  }

  getProcessedIds(): Set<string> {
    return new Set(this.data.processedIds);
  }

  /**
   * Persist a new cursor and the newly processed IDs.
   * MUST only be called after the Brain Bridge confirms successful delivery.
   */
  commit(newCursor: Cursor, newIds: string[]): void {
    this.data = {
      lastCursor: newCursor,
      processedIds: [...this.data.processedIds, ...newIds],
    };
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }
}
