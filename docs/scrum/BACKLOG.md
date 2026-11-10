# Product Backlog — Icebox

Ideas and improvements not yet scheduled in ROADMAP.md. Reviewed at each Sprint
Planning; anything promoted gets a ticket ID in the target sprint.

| Idea | Epic | Why it matters | Trigger to schedule |
|---|---|---|---|
| Avro + Schema Registry for events | EP-1 | safe schema evolution across consumers (RF-15) | 3+ consumers of one topic |
| Debezium CDC instead of outbox poller | EP-5 | lower latency, no polling load | poller lag becomes visible in metrics |
| Stripe test-mode adapter | EP-5 | real PSP integration story | after M2 |
| Venue model: layout once per venue (RF-12) | EP-3 | removes per-match layout duplication; good refactoring story | after M2, if time allows (Q2: per-Match chosen for now) |
| Hold extension (once, uncontended) | EP-3 | UX for slow payers | after M2 |
| Extract `riskgraph` into a 6th service | EP-7 | independent scaling of graph work | graph jobs slow identity |
| Redis Cluster for inventory | EP-11 | horizontal arbiter scaling (keys already slot-safe) | load test shows one Redis saturated |
| CDN for seat-map snapshots | EP-9 | offload read path | k6 shows read path hot |
| GitHub Actions nightly 1000× race test | EP-1 | catches rare races; CI already exists (TKT-106) | after TKT-202 |
| Archunit tests enforcing pure domain packages | EP-1 | stops Spring creeping into `domain/` | after Sprint 2 |
