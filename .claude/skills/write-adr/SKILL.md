---
name: write-adr
description: Write an Architecture Decision Record for specialist-be in docs/decisions following the existing ADR format, and link it from docs/README.md and related architecture docs. Use when a change introduces or alters an architectural rule (persistence pattern, context boundary, integration, abstraction).
---

# write-adr

Next number: check `ls docs/decisions` (001, 002 x2, 003, 004 exist; use 005 unless taken).
File: `docs/decisions/ADR-00N-<KEBAB-TOPIC-IN-CAPS>.md`. Language: English.

```markdown
# ADR-00N: <Title>

**Status:** Proposed | Accepted | Superseded by ADR-XXX
**Date:** <Month YYYY>
**Decision Makers:** Development Team

## Context
<problem, forces, what drifted; reference code paths and previous ADRs>

## Decision
<numbered rules, with ✅/❌ code snippets showing before/after>

## Consequences
### Positive
### Negative / Tradeoffs
(+ mitigations)

## Architectural Fitness Function
<how the rule is enforced: which check in src/__tests__/architecture.spec.ts, or "manual review" + what a reviewer looks for>

## Affected Modules / Implementation Notes
<table or list of files/services touched>

## References
```

Then:
1. Add the ADR to `docs/README.md` under "Architecture Decision Records".
2. Link it from the architecture doc it refines (e.g. `ARCHITECTURE.md`, `PERSISTENCE_BOUNDARIES.md`).
3. If the decision adds an enforceable rule, add a check to `src/__tests__/architecture.spec.ts`
   and a bullet to the relevant `.claude/rules/*.md` file so Claude follows it.
4. If it supersedes an older ADR, set that ADR's status to "Superseded by ADR-00N".
