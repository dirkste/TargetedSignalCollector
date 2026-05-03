\# Architecture: Targeted Signal Collector (TSC)



\## 1. System Philosophy

The \*\*Targeted Signal Collector (TSC)\*\* is a high-precision acquisition framework designed to bridge raw information streams and the \*\*Open Brain\*\* (the centralized knowledge repository and vector store utilized by downstream AI agents). It is built on the principle of \*\*Source-Agnosticism\*\*: the core engine is decoupled from the specifics of underlying platforms (Email, Filesystem, API, or Database).



\*   \*\*Surgical Precision:\*\* Focuses on high-signal content rather than indiscriminate bulk migration.

\*   \*\*Plug-and-Play Design:\*\* Integration of new data sources requires only a new adapter, leaving the core logic untouched.

\*   \*\*Contract-Driven Ingestion:\*\* All sources must transform native data into a "Universal Signal" before processing.



\## 2. Structural Tiers



\### Tier 1: Source Adapters (The Abstraction Layer)

Adapters manage external connectivity and must implement the following formalized interface:

\*   `connect(credentials: SecretDict) -> ConnectionStatus`

\*   `fetch\_next\_batch(cursor: Optional\[Cursor]) -> Tuple\[List\[RawRecord], NewCursor]`

\*   `normalize\_to\_signal(record: RawRecord) -> UniversalSignal`



\*\*Security Note:\*\* Adapters never store credentials. Secrets are injected at runtime via environment variables or a secure Vault (e.g., Supabase Vault or local `.env`).



\### Tier 2: Signal Processor (The Orchestration Layer)

The Processor acts as the "Blind Controller" of the pipeline.

\*   \*\*Deduplication \& Validation:\*\* Separates signals into "New" vs "Existing" using `signal\_id` and validates that `taxonomy\_path` adheres to the master schema.

\*   \*\*State Management:\*\* Manages the \*\*High Water Mark (HWM)\*\*. To prevent data loss, the HWM is only persisted to local storage (or DB) \*after\* a batch is successfully acknowledged by Tier 3.

\*   \*\*Error Handling:\*\* Implements a retry-with-backoff policy for transient adapter failures. If a batch fails mid-process, the HWM is not advanced, ensuring no signals are missed on the next run.



\### Tier 3: Brain Bridge (The Delivery Layer)

\*   \*\*Responsibility:\*\* Securely formatting the finalized context for the Open Brain.

\*   \*\*Delivery:\*\* Transmits the payload to the backend via a uniform HTTP interface.



\## 3. Universal Signal Contract

The shared "Handshake" between any data source and the TSC Engine.



| Attribute | Type | Definition |

| :--- | :--- | :--- |

| `signal\_id` | String | Unique source ID (e.g., Message-ID). Used for deduplication. |

| `payload` | String | The core content, cleaned and converted to plain-text/Markdown. |

| `origin\_ts` | ISO-8601 | Original creation timestamp from the source. |

| `source\_urn` | String | Identifies origin (e.g., `src://hotmail/inbox`). |

| `taxonomy\_hint`| String | The suggested path. The Processor is the final authority on overrides. |



\## 4. Operational Workflow (Source-Agnostic)

1\.  \*\*Initialize:\*\* The Engine injects secrets and loads the configured Adapter.

2\.  \*\*Handshake:\*\* The Adapter handles authentication and provides a batch of raw data.

3\.  \*\*Transform:\*\* The Adapter converts raw data into \*\*Universal Signal\*\* objects.

4\.  \*\*Deduplication:\*\* The Engine filters out signals that already exist in the local state or Open Brain.

5\.  \*\*Validation:\*\* The Engine confirms the hierarchical path or applies an override if the hint is invalid.

6\.  \*\*Deliver:\*\* The Bridge transmits signals; upon success, the Engine persists the new \*\*High Water Mark\*\*.

