import type { UniversalSignal } from "../types/index.js";

export class BridgeDeliveryError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(`BrainBridge delivery failed (HTTP ${statusCode}): ${message}`);
    this.name = "BridgeDeliveryError";
  }
}

// ---------------------------------------------------------------------------
// BrainBridge — Tier 3 Delivery Layer
// ---------------------------------------------------------------------------

export class BrainBridge {
  private readonly endpointUrl: string;
  private readonly apiKey: string;

  /**
   * Reads OPEN_BRAIN_URL and OPEN_BRAIN_API_KEY from environment.
   * Never accept credentials as constructor arguments to avoid accidental leakage.
   */
  constructor() {
    const url = process.env["OPEN_BRAIN_URL"];
    const key = process.env["OPEN_BRAIN_API_KEY"];

    if (!url || !key) {
      throw new Error(
        "Missing required environment variables: OPEN_BRAIN_URL and/or OPEN_BRAIN_API_KEY"
      );
    }

    this.endpointUrl = url;
    this.apiKey = key;
  }

  async deliver(signals: UniversalSignal[]): Promise<void> {
    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ signals }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(no body)");
      throw new BridgeDeliveryError(response.status, body);
    }
  }
}
