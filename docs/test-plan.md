# Test Plan

Mapped to **Milestone 8** (Test Scenarios) and supporting evidence for Milestones 6, 7, 9, and 10.

## 1. Test Strategy

We use four layers of testing:

| Layer | Purpose | Tooling |
|---|---|---|
| Unit | Validate individual functions (feature extraction, parsing) | `pytest` |
| Component | Validate the inference service in isolation | `pytest` + `httpx` |
| Integration | Validate Postfix → milter → inference → Dovecot path | `swaks`, scripted email send |
| End-to-end | Validate full demo scenario including dashboard | Manual + scripted |

## 2. Environments

- **Dev:** Local laptop, mock Postfix, in-memory DB
- **Staging:** Rocky Linux 9 EC2 instance with full pipeline, isolated from real mail
- **Demo:** Same Rocky Linux 9 EC2 instance, but with a controlled set of test mailboxes

## 3. Functional Test Scenarios

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| T-01 | Clean email is delivered | Send a known-good plain text email via `swaks` | Delivered to inbox; `X-Phish-Score` header low or absent |
| T-02 | Obvious phishing is flagged | Send a sample phishing email from dataset | Delivered with high `X-Phish-Score` header or moved to Quarantine |
| T-03 | Email with malicious URL is flagged | Send a clean-looking email containing a known-bad URL | Flagged with high score; URL listed in detection record |
| T-04 | Inference service down — fail open | Stop inference service, send any email | Email is delivered with header `X-Phish-Score: unavailable` |
| T-05 | Large email body | Send 5 MB email | Either rejected with 552 or processed within timeout, never blocks queue |
| T-06 | Multiple emails concurrently | Send 50 emails in parallel | All scored, no errors, average latency < 2s |
| T-07 | Dashboard shows flagged email | Send phishing email, refresh dashboard | New record visible with score, sender, subject |
| T-08 | Detection record retention | Run cleanup job after configured TTL | Old records removed or scrubbed |
| T-09 | Model swap | Replace model artifact, restart service | New model loaded; logs show artifact hash |
| T-10 | URL-only scoring | Hit `/score-url` with known-bad URL | Returns high score and verdict `phish` |

## 4. Non-Functional Test Scenarios

| ID | Scenario | Target |
|---|---|---|
| NFR-01 | Inference latency p95 | < 2s for emails ≤ 1 MB |
| NFR-02 | Memory footprint of inference service | < 1 GB resident |
| NFR-03 | Mail flow availability with classifier on | ≥ 99% during demo window |
| NFR-04 | False positive rate on Enron-like clean corpus | < 2% |
| NFR-05 | Recall on phishing test set | ≥ 0.90 |

## 5. Security Test Scenarios (links to Milestone 9)

| ID | Scenario | Expected Result |
|---|---|---|
| SEC-01 | Attempt open relay (`swaks` from external IP) | Rejected with 554 |
| SEC-02 | Send email with spoofed `From` header | SPF/DKIM/DMARC failure raises score |
| SEC-03 | Fuzz `/score` with malformed JSON | Service returns 4xx, does not crash |
| SEC-04 | Path traversal on dashboard | Returns 404, no file disclosed |
| SEC-05 | Secrets check on repo | `pip-audit` and secret scanner pass |
| SEC-06 | Dependency CVE scan | No high CVEs unaddressed before demo |

## 6. Test Data

| Source | Usage |
|---|---|
| Kaggle phishing dataset | Train + holdout for phishing class |
| PhishTank / OpenPhish | URL classifier training |
| Enron corpus (or similar) | Legitimate email class |
| Hand-crafted test emails | Edge cases and demo scenarios |

## 7. Tooling

- `pytest` for unit and component tests
- `swaks` for SMTP test traffic
- `mailutils` / `mutt` for end-user verification
- `locust` (optional) for load tests
- GitHub Actions (optional) for CI

## 8. Reporting

Each test run during demo prep produces a row in a tracking table:

| Date | Build / Commit | Scenarios passed | Failed | Notes |
|---|---|---|---|---|
| | | | | |

## 9. Exit Criteria for Final Demo

- All **Must Have** scenarios in Section 3 pass
- All Section 5 (Security) scenarios pass at least once
- NFR-01, NFR-04, NFR-05 meet target
- Threat model controls checklist fully ticked
- Documentation updated with the latest results
