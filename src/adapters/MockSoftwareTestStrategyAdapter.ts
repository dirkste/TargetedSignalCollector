import type {
  SecretDict,
  ConnectionStatus,
  Cursor,
  RawRecord,
  UniversalSignal,
} from "../types/index.js";
import { BaseAdapter } from "./BaseAdapter.js";

const TAXONOMY = "Professional > Computer Science > Software Test Strategy";

// ---------------------------------------------------------------------------
// Static mock records — generic test-strategy content
// ---------------------------------------------------------------------------

const MOCK_RECORDS: RawRecord[] = [
  {
    id: "tsc-mock-001",
    rawContent:
      "<h2>Risk-Based Test Strategy</h2><p>Prioritise test effort using a <strong>risk matrix</strong>: map each feature to " +
      "likelihood &amp; impact scores. High-risk areas receive full regression coverage; low-risk areas receive smoke tests only.</p>",
    timestamp: "2018-03-12T09:00:00.000Z",
  },
  {
    id: "tsc-mock-002",
    rawContent:
      "<p>Test Case Template (standard):</p><ul><li>ID &amp; Title</li><li>Preconditions</li><li>Steps</li>" +
      "<li>Expected Result</li><li>Actual Result</li><li>Pass/Fail</li></ul>",
    timestamp: "2019-07-04T14:30:00.000Z",
  },
  {
    id: "tsc-mock-003",
    rawContent:
      "<p>Defect Triage Process: On each Monday morning the team triages all <em>New</em> defects. " +
      "Priority is set by the product owner. Severity is set by QA. &lt;P1&gt; defects block the release.</p>",
    timestamp: "2020-11-01T08:00:00.000Z",
  },
  {
    id: "tsc-mock-004",
    rawContent:
      "<p>Shift-Left Testing: Involve QA during sprint planning to review acceptance criteria. " +
      "Unit tests are the developer&apos;s responsibility &amp; must pass before merge.</p>",
    timestamp: "2021-05-20T11:00:00.000Z",
  },
  {
    id: "tsc-mock-005",
    rawContent:
      "<p>Test Pyramid: 70% unit, 20% integration, 10% end-to-end. " +
      "Avoid over-reliance on &lt;UI&gt; tests due to brittleness &amp; slow feedback loops.</p>",
    timestamp: "2022-09-15T16:45:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// MockSoftwareTestStrategyAdapter
// ---------------------------------------------------------------------------

export class MockSoftwareTestStrategyAdapter extends BaseAdapter {
  private records: RawRecord[];

  constructor(records: RawRecord[] = MOCK_RECORDS) {
    super();
    this.records = records;
  }

  async connect(_credentials: SecretDict): Promise<ConnectionStatus> {
    return { connected: true, message: "Mock adapter connected." };
  }

  /**
   * Returns records in pages of `pageSize`. Cursor is the numeric string index
   * of the next record to return. Returns empty batch when exhausted.
   */
  async fetchNextBatch(cursor?: Cursor): Promise<[RawRecord[], Cursor]> {
    const pageSize = 3;
    const start = cursor ? parseInt(cursor, 10) : 0;
    const page = this.records.slice(start, start + pageSize);
    const nextCursor: Cursor =
      start + pageSize < this.records.length
        ? String(start + pageSize)
        : null;
    return [page, nextCursor];
  }

  normalizeToSignal(record: RawRecord): UniversalSignal {
    const cleanText = this.stripHtml(record.rawContent);
    return {
      signal_id: record.id,
      payload: cleanText,
      origin_ts: record.timestamp,
      taxonomy_hint: TAXONOMY,
    };
  }
}
