# Architecture Decision Records

The decisions that shape the platform, each with the code, script or suite
that ENFORCES it. An ADR here is a record, not a proposal — reopening one
means writing a new ADR that supersedes it.

| #                                   | Title                                                                           | Status   |
| ----------------------------------- | ------------------------------------------------------------------------------- | -------- |
| [0001](0001-audit-chain.md)         | The audit log is an append-only, hash-chained ledger (+ daily WORM snapshots)   | Accepted |
| [0002](0002-api-conventions.md)     | API conventions: envelope, guards, audited mutations, error model               | Accepted |
| [0003](0003-scan-isolation.md)      | Scan isolation: unprivileged pods, no exec, default-deny, target guard          | Accepted |
| [0004](0004-workers-and-queues.md)  | Background work: five BullMQ workers, at-least-once, idempotent by construction | Accepted |
| [0005](0005-realtime-transports.md) | Real-time: SSE for observation, WebSocket only for the scan terminal            | Accepted |
| [0006](0006-deployment-topology.md) | Topology: two clusters sharing nothing, one edge, one Vault                     | Accepted |
