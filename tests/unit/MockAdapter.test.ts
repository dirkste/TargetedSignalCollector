import { describe, it, expect } from "vitest";
import { MockSoftwareTestStrategyAdapter } from "../../src/adapters/MockSoftwareTestStrategyAdapter.js";
import type { RawRecord } from "../../src/types/index.js";

describe("MockSoftwareTestStrategyAdapter — normalizeToSignal", () => {
  const adapter = new MockSoftwareTestStrategyAdapter();

  it("strips HTML tags from rawContent", () => {
    const record: RawRecord = {
      id: "test-001",
      rawContent: "<h2>Title</h2><p>Body text here.</p>",
      timestamp: "2020-01-01T00:00:00.000Z",
    };
    const signal = adapter.normalizeToSignal(record);
    expect(signal.payload).not.toContain("<h2>");
    expect(signal.payload).not.toContain("<p>");
    expect(signal.payload).toContain("Title");
    expect(signal.payload).toContain("Body text here.");
  });

  it("decodes HTML entities", () => {
    const record: RawRecord = {
      id: "test-002",
      rawContent: "<p>Risk &amp; Impact &lt;matrix&gt;</p>",
      timestamp: "2020-01-01T00:00:00.000Z",
    };
    const signal = adapter.normalizeToSignal(record);
    expect(signal.payload).toContain("&");
    expect(signal.payload).toContain("<matrix>");
    expect(signal.payload).not.toContain("&amp;");
    expect(signal.payload).not.toContain("&lt;");
  });

  it("populates all required Universal Signal fields", () => {
    const record: RawRecord = {
      id: "test-003",
      rawContent: "<p>Content</p>",
      timestamp: "2021-06-15T12:00:00.000Z",
    };
    const signal = adapter.normalizeToSignal(record);
    expect(signal.signal_id).toBe("test-003");
    expect(signal.origin_ts).toBe("2021-06-15T12:00:00.000Z");
    expect(signal.taxonomy_hint).toBe(
      "Professional > Computer Science > Software Test Strategy"
    );
  });

  it("sets taxonomy_hint to the correct domain", () => {
    const record: RawRecord = {
      id: "test-004",
      rawContent: "plain text",
      timestamp: "2020-01-01T00:00:00.000Z",
    };
    const signal = adapter.normalizeToSignal(record);
    expect(signal.taxonomy_hint).toMatch(
      /^Professional > Computer Science > Software Test Strategy/
    );
  });
});

describe("MockSoftwareTestStrategyAdapter — fetchNextBatch", () => {
  it("returns first page of records with a cursor", async () => {
    const adapter = new MockSoftwareTestStrategyAdapter();
    const [batch, cursor] = await adapter.fetchNextBatch();
    expect(batch.length).toBe(3);
    expect(cursor).toBe("3");
  });

  it("returns subsequent pages using the cursor", async () => {
    const adapter = new MockSoftwareTestStrategyAdapter();
    const [, cursor1] = await adapter.fetchNextBatch();
    const [batch2, cursor2] = await adapter.fetchNextBatch(cursor1 ?? undefined);
    expect(batch2.length).toBe(2); // 5 records total, 3 + 2
    expect(cursor2).toBeNull();
  });

  it("returns empty batch when cursor is exhausted", async () => {
    const adapter = new MockSoftwareTestStrategyAdapter();
    const [batch, cursor] = await adapter.fetchNextBatch("99");
    expect(batch.length).toBe(0);
    expect(cursor).toBeNull();
  });
});
