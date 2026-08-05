# Shift-Left Security — Presentation Deck

**Project:** Email Security Pipeline (CYT300 capstone) · **Milestone:** M9 — Security & Compliance
**Format:** 14 slides · speaker notes included · all figures in `Image/presentation/`

> **How to use this file.** Each `## Slide N` heading is one PowerPoint slide. The **On the slide** block is what goes on the slide itself (keep it sparse). **Say this** is the speaker script — do not put it on the slide. **Figure** names the image to drop in; PNGs are 3200px wide, so they stay sharp full-bleed on a 16:9 deck.
>
> Every number and claim in this deck is traceable to `docs/devsecops.md`, `docs/threat-model.md`, `docs/security-decisions.md`, or a specific workflow file. Nothing here is aspirational — where a control is partial or blocked, the deck says so, because a reviewer who finds an overstatement stops trusting the rest.

---

## Slide 1 — Title

**On the slide**

> # Shift-Left Security
> ### Building a phishing-detection system where security runs before the code does
> Email Security Pipeline · CYT300 · Milestone 9
> 13,273 lines of code · 240 commits · 11 CI workflows · 20 security tools

**Figure:** none (title slide)

**Say this**
This project is a phishing email and malicious URL classifier running on AWS. But this talk is not about the machine learning. It is about the security engineering *around* it — how we made it so that a security flaw has to get past seven layers of automated checking before it can reach anything real. The core idea has a name: shift left.

---

## Slide 2 — What "shift left" actually means

**On the slide**

> **Shift left = move every security check as early as it can possibly run.**
>
> Not "add more scanners."
> **Move the same scanner earlier**, where a finding is cheap to fix and has not hurt anyone yet.
>
> | Found at… | Cost to fix | Blast radius |
> |---|---|---|
> | Editor / pre-commit | 1× | Nobody sees it |
> | Pull request | ~5× | The team |
> | Production | ~100× | Users |
> | Breach | Unbounded | Users, disclosure, reputation |

**Figure:** `09_shift_left_concept.png`

**Say this**
The classic finding in software engineering is that defect cost grows roughly an order of magnitude at each stage it survives. Security defects are worse, because past a certain point the cost is not just engineering time — it is disclosure, credential rotation, and reputation. The whole discipline reduces to one question asked repeatedly: *what is the earliest point at which this could have been caught?* Shifting left is not a tool you buy. It is a placement decision you make about tools you already have.

---

## Slide 3 — What we are defending

**On the slide**

> **The attack surface is unusually wide for a student project — it is a mail server.**
>
> - **Postfix on EC2** — accepts SMTP from the entire internet on port 25
> - **FastAPI on ECS Fargate** — public ALB, scores every email
> - **React dashboard on Amplify** — renders **attacker-controlled content**
> - **RDS Postgres** — detection records, sender/recipient metadata
> - **Cognito** — analyst identity
>
> ⚠️ The input to this system is, by definition, **hostile mail written by attackers.**

**Figure:** `01_system_context.png` *(existing)*

**Say this**
Two things make this genuinely security-relevant rather than a checkbox exercise. First, a mail server is one of the few things you deliberately expose to unauthenticated strangers on the open internet — anyone can send us mail. Second, the dashboard renders the subject line and sender of phishing emails. Those strings are written by an attacker. If we render them carelessly, we have built a cross-site scripting delivery mechanism and pointed it at our own security analysts. That specific concern drove several decisions later in this deck.

---

## Slide 4 — Threat model first, tools second

**On the slide**

> **STRIDE — six categories, applied to this system specifically**
>
> Not "what tools exist?" but **"what does an attacker actually try here?"**
>
> Every mitigation names the task that implemented it, so any claim traces to a commit.
>
> **20 controls in the checklist · 14 implemented · 6 open and named**

**Figure:** `14_stride_to_controls.png`

**Say this**
Security work that starts with tool selection tends to produce a pile of scanners and no argument for why those scanners. We started from STRIDE — spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege — applied to *this* system. Spoofing is the headline threat for a phishing filter: a forged sender is the entire attack. That is why inbound SPF, DKIM and DMARC validation exists, and why a nightly test actively asserts that a real delivered message carries those headers.

Notice the last column. Every row says how we *know* the control works, and it is never "we wrote it." It is a test that runs on a schedule. And notice the count: 14 of 20 implemented. The 6 that are not are listed by name with reasons. An unchecked box is a finding, not an embarrassment.

---

## Slide 5 — The whole pipeline in one picture

**On the slide**

> **Five stages. Twenty tools. Each one placed as far left as it can run.**
>
> 1. **LOCAL** — before a commit exists → *prevents*
> 2. **PULL REQUEST** — the main gate → *blocks merge*
> 3. **MERGE TO dev** — deploy + passive scan
> 4. **NIGHTLY** — attack the running system → *gates promotion*
> 5. **RUNTIME** — assume something got through → *detects*

**Figure:** `10_security_gates_pipeline.png` ← **the anchor slide of the talk**

**Say this**
This is the whole system on one slide; everything after this is a zoom-in. Read it top to bottom as time passing, and left to right within each band.

The two things worth pointing at. First, the pink band — the pull request — is deliberately the fattest. That is where the most checks live because it is the last point where a fix is still just "push another commit" rather than "revert something already deployed." Second, look at the bottom two lines: some things are reported but *not* blocking, on purpose. CodeQL's first run against a codebase produces a large untriaged baseline. If we had gated on it immediately, every pull request would have gone red for findings nobody had looked at yet — and a gate that always fails is a gate people learn to bypass. That judgement call matters more than the tool count.

---

## Slide 6 — Stage 1: before the code exists

**On the slide**

> **Pre-commit hooks — the only layer that *prevents* rather than *reports***
>
> ```bash
> pip install pre-commit && pre-commit install
> ```
>
> | Hook | Stops |
> |---|---|
> | **gitleaks** | A credential entering git history |
> | **detect-private-key** | PEM blocks entropy rules miss |
> | **large-file guard** | Model blobs stuck in history forever |
> | **terraform fmt** | A red CI run you could have avoided |
>
> Shares `.gitleaks.toml` with CI — local and CI cannot disagree.

**Figure:** `12_secret_prevention.png`

**Say this**
This is the most important slide in the deck, and it is about a distinction that is easy to miss: detecting a leak is not preventing one.

Look at the two timelines. Same tool — gitleaks — run one stage apart. On top, it runs in CI: the developer commits, pushes, and the secret is now on a public GitHub repository. Then gitleaks tells you. But that credential is already compromised. Scrapers index public commits within seconds. Rewriting history does not un-publish it; the only correct response is to rotate the credential. The scan told you, it did not save you.

On the bottom, the same scanner runs at commit time. The commit is blocked, HEAD never moves, and the secret never enters git. Nothing to rotate, nothing to disclose.

I verified this rather than assuming it: I staged a file containing a fake AWS key and attempted a real commit. It was blocked — two leaks found, HEAD unchanged. That test also caught a bug in my own hook config, which is a good argument for testing your controls instead of trusting them.

One honest caveat, and I would rather say it than have someone find it: pre-commit hooks are opt-in per clone and bypassable with `--no-verify`. A repository cannot force them on you. That is exactly why the CI gitleaks job stays. This is defence in depth, not a replacement.

---

## Slide 7 — Stage 2a: SAST — reading our own code

**On the slide**

> **Static analysis — find the bug without running the program**
>
> | Tool | What it is good at |
> |---|---|
> | **Bandit** | Python-specific patterns: `eval`, `subprocess`, hardcoded secrets |
> | **Semgrep** | OWASP Top Ten rulesets, Python **and** React/TS |
> | **CodeQL** | Taint tracking — follows attacker data *across functions* |
> | **ESLint-security** | DOM-XSS sinks in the dashboard |
>
> **Gate:** HIGH/CRITICAL blocks the merge. CodeQL reports only (first-baseline).

**Figure:** *(none — or a screenshot of a failing PR check)*

**Say this**
SAST means analysing source code without executing it. Four tools, because they genuinely see different things and stack rather than overlap.

Bandit is Python-only and pattern-based — fast, cheap, catches the obvious. Semgrep adds curated OWASP Top Ten rules and covers the frontend too. CodeQL is the qualitatively different one: it builds a dataflow graph and does taint tracking, so it can follow attacker-controlled input from where it enters, through three function calls, to where it does damage — a chain no pattern matcher will spot.

The one I want to highlight is ESLint-security, because of a decision inside it. The dashboard renders email subject lines, which attackers write. So `dangerouslySetInnerHTML` — React's escape hatch for injecting raw HTML — is a hard error in our config. Not a warning. That one API is the difference between rendering a phishing subject as text and executing it as script in an analyst's browser. Meanwhile I set the noisier rules to warning level, with the reasoning written in the config file. Tuning a gate is a security decision and it should be documented like one.

---

## Slide 8 — Stage 2b: the code we did *not* write

**On the slide**

> **15 direct Python dependencies pull in ~75 packages. The frontend lockfile has 524.**
>
> Almost none of that code was written by us — and all of it ships.
>
> | Tool | Reads | Catches |
> |---|---|---|
> | **pip-audit / npm audit** | Dependency manifests | Published CVEs |
> | **Dependabot** | Same, weekly | Opens the upgrade PR |
> | **Trivy** | The built container image | CVEs in the base OS + libs |
> | **Checkov / tfsec** | Terraform | Public buckets, open SGs, unencrypted DB |
>
> **All dependencies now pinned to exact versions** — `>=` means two builds of the same commit can differ.

**Figure:** `11_tool_coverage_map.png`

**Say this**
This is the supply chain, and it is the attack path that needs no flaw in our code at all. Someone compromises a package we depend on, and we ship it. Fifteen direct Python dependencies pull in roughly seventy-five packages transitively; the frontend lockfile records over five hundred. That is the real trust boundary, and almost none of it was written by us.

Three layers. `pip-audit` and `npm audit` read the manifests and flag known CVEs. Dependabot then opens the pull request that actually upgrades them — scanning without a remediation path just produces a permanently red build. Trivy scans the built container image, which matters specifically because we deploy to ECS Fargate: there is no host machine to run a scanning agent on, so the image is the only place to catch a vulnerable base OS.

Checkov and tfsec are the interesting pair. They read *Terraform* — our cloud configuration. The class of breach they prevent is not a code bug at all; it is a misconfiguration. A publicly readable S3 bucket, a security group open to the world, an unencrypted database. Historically that is one of the most common causes of real-world cloud data exposure, and it is invisible to every tool on the previous slide.

We also pinned every dependency to an exact version. `>=` means two builds of the same commit can install different code, which undercuts reproducibility and means a compromised upstream release lands with no code change to review.

---

## Slide 9 — Stage 2c: quality as a security property

**On the slide**

> **SonarCloud (hosted SonarQube)** — 13,273 lines analysed
>
> Overlaps the other scanners on vulnerabilities. That is **not** why it is here.
>
> **What it uniquely adds:** a **coverage gate on new code**, plus maintainability and duplication signal.
>
> ⚠️ Coverage is genuinely low: backend ~41%, frontend 2.6%.
> The gate measures **new/changed code only** — it ratchets upward instead of failing on day one.

**Figure:** *(optional — SonarCloud dashboard screenshot)*

**Say this**
SonarCloud is the last tool we added, and I want to be precise about why, because "we added another scanner" is not a reason.

It does find vulnerabilities, but so do the four tools two slides ago. Its distinct contribution is measuring test coverage on new code and gating on it. Nothing else in the pipeline does that.

And here is where I have to be honest about a number. Our overall test coverage is low — the frontend is 2.6%, because only one module has tests. If I had configured an *overall* coverage gate, it would have failed on the first run and someone would have switched it off within a week. Instead the gate measures only new and changed code. That means quality ratchets upward as the codebase evolves without blocking on pre-existing debt. The low absolute number is recorded as an open gap in our documentation rather than hidden. A metric you have quietly disabled is worse than one you never had.

---

## Slide 10 — Stage 4: DAST — attacking the running system

**On the slide**

> **SAST reasons about code it never runs. DAST runs code it cannot read.**
>
> Nightly, against the live deployment:
>
> | Tool | Attack simulated |
> |---|---|
> | **OWASP ZAP** | Full active scan — injection, auth bypass, headers |
> | **Schemathesis** | Property-based fuzzing of every API endpoint |
> | **testssl.sh** | Weak ciphers, downgrade — ALB + mail listeners |
> | **swaks** | **Open relay and sender spoofing** |
>
> A HIGH finding fails the nightly, which **blocks promotion to production.**

**Figure:** `04_workflow_mail_flow.png` *(existing)* or a ZAP report screenshot

**Say this**
Everything so far analysed artifacts at rest. DAST attacks the deployed, running system — no source code, just HTTP and SMTP, the same view an attacker has.

ZAP does a full active scan: it spiders the API and throws real attack payloads at it. Schemathesis is subtler — it reads our OpenAPI schema and generates property-based test cases, so it finds inputs no human would think to write. The property it is checking is not "does this return the right answer" but "does this ever crash, leak a stack trace, or skip authentication."

The swaks tests are my favourite because they test a threat specific to mail. They *actively attempt to relay mail through our server as an unauthenticated stranger* and assert that we refuse with `554 5.7.1`. An open mail relay is how a legitimate server becomes spam infrastructure. Previously this was a manual checklist item someone would have to remember. Now it runs every night, and if it ever stops refusing, the build goes red.

There is a subtlety worth naming: the mail filter is designed to **fail open**. If the scoring API is down, mail is delivered unscored rather than blocked. That is a deliberate availability-over-security trade for a mail system — losing legitimate mail is worse than passing one unscored phish. So "the fuzzer must never block mail flow" is itself one of the properties DAST verifies.

---

## Slide 11 — Stage 5: runtime — assume something got through

**On the slide**

> **Defence in depth: plan for the gates failing.**
>
> - **AWS WAF** — managed rules on the public ALB (Common, Known-Bad-Inputs incl. Log4Shell, IP reputation)
> - **CloudTrail** — multi-region, log-file validated: who did what, when
> - **AWS Config** — configuration drift baseline
> - **CloudWatch alarms** — 5xx rate, p95 latency, RDS CPU/connections → one SNS topic
>
> ⚠️ **WAF is in COUNT mode** — it observes and logs, it does **not** block yet.
> ⚠️ **GuardDuty + Security Hub: blocked at the AWS account tier.** Terraform written, would apply on a commercial account.

**Figure:** `08_aws_implemented.png` *(existing)*

**Say this**
Every gate so far can fail. Runtime controls assume one did.

WAF sits in front of the public API with AWS-managed rule sets. But I want to flag its status honestly: it is in COUNT mode, meaning it logs what it *would* have blocked without actually blocking. That is the standard "observe before enforce" pattern — you watch real traffic first so you do not break legitimate users on day one. But until someone reviews that baseline and flips it, it is an advisory control, not a protective one. It is listed as an open item in our documentation for exactly that reason.

Second admission: GuardDuty and Security Hub — AWS's threat detection and findings aggregation — are not enabled. Not because we forgot. Both return `SubscriptionRequiredException` when called directly against this account with administrator credentials. It is an account-tier restriction on the education/credit AWS account this runs on. I verified that outside of CI to rule out an IAM or code problem. The Terraform is written and would apply immediately on a commercial account. That gap is documented as permanent rather than pending, because saying "we'll do it later" about something you cannot do is just a lie with a deadline.

---

## Slide 12 — Evidence: what it actually caught

**On the slide**

> **A gate that never finds anything is decoration.**
>
> - 🔴 Our **own security scanner** shipped a known CVE (`sonarqube-scan-action@v5`)
> - 🔴 **`curl | bash`** in CI — running an unverified script from the internet
> - 🟠 **~20 GitHub Actions pinned to mutable tags** → now pinned to commit SHA
> - 🔴 **SPF/DKIM/DMARC never actually ran** — live mail always scored `has_spf = 0`
> - 🟠 **TLS key permissions silently broke outbound mail** on port 587
>
> Clean results matter too: **ZAP 145/145 passed, 0 High** · **Checkov + tfsec: 0 failures**

**Figure:** `13_what_it_caught.png`

**Say this**
Here is where I stop describing the pipeline and show you that it works.

Two of these are worth dwelling on. The first: our own security scanner was the vulnerable component. The SonarQube scan action was on a version carrying a published CVE. We found that from the scan job's own output annotation. There is a lesson in that — security tooling is software, it has supply chain risk, and it needs the same scrutiny as application code.

The one I find most instructive is the fourth. Our documentation said SPF, DKIM and DMARC validation was implemented. Our ML model had `has_spf` and `has_dkim` features. But nothing on the mail server actually computed those values — so every live email scored `has_spf = 0` regardless of whether the sender was genuinely authenticated. The feature was silently dead, and the spoofing mitigation in our threat model was not real. No scanner found that. It came from reading our own documented claims against our own code, line by line.

That is the pattern across all of these: automated gates catch the known classes very well, and they caught real things here. But the most serious finding came from auditing what we *said* we had built against what we had actually built.

---

## Slide 13 — What is still open

**On the slide**

> **Honest gaps — documented, not hidden**
>
> | Gap | Why |
> |---|---|
> | WAF in COUNT mode | Needs a false-positive baseline before enforcing |
> | GuardDuty / Security Hub | Blocked at the AWS account tier — permanent here |
> | No rate limiting | Bounded only by a 2 MB body cap |
> | No SBOM | "Are we affected by CVE-X?" needs a re-scan, not a query |
> | Coverage: 41% / 2.6% | Gate is scoped to new code so it ratchets up |
> | Pre-commit is opt-in | A repo cannot force hooks; CI stays the backstop |
>
> Every one of these is in `docs/security-decisions.md` §6, with reasoning.

**Figure:** none

**Say this**
I want to spend a slide on what we did *not* finish, because a security report with no open items is not a confident report — it is an incomplete one.

These are all real. No rate limiting means a volumetric attack against the public API is bounded only by a body-size cap and normal AWS infrastructure limits. No SBOM means when the next Log4Shell-style CVE lands, we answer "are we affected?" by re-scanning rather than querying an inventory we already have.

They are all in one consolidated table in our security decisions document, each with the reasoning, so that a reviewer — or whoever picks this up next — does not have to rediscover them. The distinction I care about is between an accepted risk and an unknown one. Everything on this slide is accepted and written down. That is a different thing from a gap nobody noticed.

---

## Slide 14 — What I would take to a real job

**On the slide**

> ### Shift left is a placement decision, not a shopping list
>
> 1. **Threat model first.** Tools are downstream of knowing what you defend against.
> 2. **Prevention beats detection.** The same scanner, one stage earlier, changes the outcome — not just the reporting.
> 3. **A gate that always fails gets bypassed.** Tune thresholds deliberately and write down why.
> 4. **Verify your controls, don't trust them.** Every gate here was tested by making it fail on purpose.
> 5. **Document the gaps.** Overstating one control makes a reviewer doubt all of them.
>
> **Security tooling is software too — ours had a CVE.**

**Figure:** `06_devsecops_pipeline.png` *(existing)* or reuse `10_security_gates_pipeline.png`

**Say this**
Five things I would carry into a real security engineering role.

Threat model first — otherwise you are collecting tools and calling it a strategy. Prevention beats detection, and the pre-commit example is the cleanest illustration I have: identical tool, one stage earlier, and the difference is whether a credential gets compromised. A gate that always fails gets bypassed, so tuning thresholds is a real security decision that deserves written justification, not a quiet edit. Verify your controls rather than trusting them — every gate in this pipeline I tested by deliberately breaking something and confirming it went red, and that process found bugs in my own configurations more than once.

And last: document the gaps. It is tempting to present a clean slide. But the moment a reviewer finds one overstated claim, they reasonably start doubting everything else you told them. Being straight about the six open items is what makes the fourteen closed ones credible.

The line I would leave you with is the one that surprised me most: our own security scanner shipped with a known vulnerability. Security tooling is software. It has a supply chain. It gets the same scrutiny as everything else — or it becomes the way in.

---

## Appendix — figure index

| Figure | File | Slide |
|---|---|---|
| Shift-left cost curve | `Image/presentation/09_shift_left_concept.png` | 2 |
| System context | `Image/presentation/01_system_context.png` | 3 |
| STRIDE → controls | `Image/presentation/14_stride_to_controls.png` | 4 |
| **Full gate pipeline** | `Image/presentation/10_security_gates_pipeline.png` | **5** |
| Prevention vs detection | `Image/presentation/12_secret_prevention.png` | 6 |
| Tool coverage map | `Image/presentation/11_tool_coverage_map.png` | 8 |
| Mail flow | `Image/presentation/04_workflow_mail_flow.png` | 10 |
| AWS implemented | `Image/presentation/08_aws_implemented.png` | 11 |
| What it caught | `Image/presentation/13_what_it_caught.png` | 12 |
| DevSecOps pipeline | `Image/presentation/06_devsecops_pipeline.png` | 14 |

SVG sources are in `Image/presentation/src/`. Re-render after editing:

```bash
rsvg-convert -w 3200 Image/presentation/src/NAME.svg -o Image/presentation/NAME.png
```

**Source documents:** `docs/devsecops.md` (§3.2 SAST, §3.3 DAST, §3.5 shift-left assessment) · `docs/threat-model.md` (STRIDE + controls checklist) · `docs/security-decisions.md` (§6 consolidated open gaps) · `docs/data-retention-privacy.md`
