# Architecture: Targeted Signal Collector (TSC)

## 1. System Philosophy

The **Targeted Signal Collector (TSC)** is a high-precision acquisition framework designed to bridge raw information streams and the **Open Brain** (the centralized knowledge repository and vector store utilized by downstream AI agents). It is built on the principle of **Source-Agnosticism**: the core engine is decoupled from the specifics of underlying platforms (Email, Filesystem, API, or Database).

*   **Surgical Precision:** Focuses on high-signal content rather than indiscriminate bulk migration.
*   **Plug-and-Play Design:** Integration of new data sources requires only a new adapter, leaving the core logic untouched.
*   **Contract-Driven Ingestion:** All sources must transform native data into a "Universal Signal" before processing.

## 2. Structural Tiers

### Tier 1: Source Adapters (The Abstraction Layer)

Adapters manage external connectivity and must implement the following formalized interface:
*   `connect(credentials: SecretDict): Promise<ConnectionStatus>`
*   `fetchNextBatch(cursor?: Cursor): Promise<[RawRecord[], Cursor]>`
*   `normalizeToSignal(record: RawRecord): UniversalSignal`

**Security Note:** Adapters never store credentials. Secrets are injected at runtime via environment variables or a secure Vault (e.g., Supabase Vault or local `.env`).

### Tier 2: Signal Processor (The Orchestration Layer)

The Processor acts as the "Blind Controller" of the pipeline.
*   **Deduplication:** Separates signals into "New" vs "Existing" using `signal_id`.
*   **Validation:** Confirms the `taxonomy_hint` adheres to the allowed domain prefix.
*   **State Management:** Manages the **High Water Mark (HWM)**. The HWM is only persisted after a batch is successfully acknowledged by Tier 3. The cursor is also advanced for fully-deduplicated batches to prevent redundant re-fetching.
*   **Error Handling:** If a batch fails mid-process (Tier 3 error), the HWM is not advanced, ensuring no signals are missed on the next run.

### Tier 3: Brain Bridge (The Delivery Layer)

*   **Responsibility:** Securely formatting the finalized context for the Open Brain.
*   **Delivery:** Transmits the payload to the Supabase backend via a uniform HTTP interface. Credentials are read from environment variables only.

## 3. Universal Signal Contract

The shared "Handshake" between any data source and the TSC Engine.

| Attribute | Type | Definition |
| :--- | :--- | :--- |
| `signal_id` | String | Unique source ID (e.g., Message-ID). Used for deduplication. |
| `payload` | String | The core content, cleaned and converted to plain-text/Markdown. |
| `origin_ts` | ISO-8601 | Original creation timestamp from the source. |
| `taxonomy_hint` | String | Suggested classification path (e.g., `Professional > Computer Science > Software Test Strategy`). The Processor is the final authority on validation. |

## 4. Operational Workflow (Source-Agnostic)

1.  **Initialize:** The Engine injects secrets and loads the configured Adapter.
2.  **Handshake:** The Adapter handles authentication and provides a batch of raw data.
3.  **Transform:** The Adapter converts raw data into **Universal Signal** objects.
4.  **Deduplication:** The Engine filters out signals that already exist in the local HWM state.
5.  **Validation:** The Engine confirms the `taxonomy_hint` matches the allowed domain prefix.
6.  **Deliver:** The Bridge transmits signals; upon success, the Engine persists the new **High Water Mark**.
