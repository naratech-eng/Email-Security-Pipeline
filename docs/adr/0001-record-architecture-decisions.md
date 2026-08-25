# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

This project spans many small but important decisions (stack choices, model strategy, deployment shape). Without a record, these decisions are lost in chat and become hard to revisit or justify later.

## Decision

We will keep lightweight Architecture Decision Records (ADRs) in `docs/adr/`. Each ADR follows this template:

```
# ADR-XXXX: Title
- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```

## Consequences

- New decisions are captured close to the code.
- Reviewers can trace why we chose specific tools.
- Adds minor overhead per decision.
