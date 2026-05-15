# ADR-0003: Model strategy

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

We need to pick an ML approach that meets the PRD targets (recall ≥ 0.90 on phishing emails, F1 ≥ 0.85 on URLs) without overrunning the 8–10 week schedule. The team has stronger classical ML experience than deep learning operations experience.

## Decision

1. **Baseline first.** Build hand-crafted email and URL features, then train a Random Forest classifier as the baseline.
2. **Compare classical models.** Train Logistic Regression and SVM on the same features. Pick the best performer for the demo path.
3. **Stretch with neural model.** Only if classical models do not meet PRD targets, fine-tune DistilBERT on the email body, then ensemble or replace.
4. **Single artifact at runtime.** The inference service loads exactly one final model. Comparison results stay in the report, not in the runtime path.

## Consequences

- Lower risk: a strong baseline is achievable in the early weeks.
- Clear gate: we only spend time on neural models if we need to.
- Preprocessing logic must be shared between training and inference to avoid skew. We will keep it in a single Python module imported by both training scripts and the FastAPI service.
