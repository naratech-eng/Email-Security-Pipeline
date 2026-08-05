<!--
docs/devsecops.md §7 has listed a PR template (change summary, threat-model
impact, rollback plan) as part of code hygiene since M9, but no template file
existed. This is it.

Keep it short. If a section genuinely doesn't apply, write "n/a" and why --
deleting it makes it look like it was never considered.
-->

## Summary

<!-- What changed and why. Link the task ID (M9-T4, SEC-SAST, ...) if there is one. -->

## Threat-model impact

<!--
Does this change the attack surface, trust boundaries, or any control in
docs/threat-model.md? New endpoint, new IAM permission, new inbound port, new
stored field, new dependency with network access, a loosened check?

If yes: say what, and update docs/threat-model.md in this PR.
If no: "No new attack surface" is a complete answer.
-->

## Rollback plan

<!--
How do we undo this if it misbehaves in dev?
- App code: revert + redeploy (backend-deploy.yml runs on merge to dev)
- Terraform: `terraform apply` the reverted config -- BUT call out explicitly
  if this replaces a resource rather than updating it (mail server cloud-init
  edits replace the EC2 instance and its mailboxes; RDS changes may snapshot)
- Data/migrations: is the migration reversible? Is there a downgrade path?
-->

## Verification

<!--
What did you actually run, and what did it output? Not "should work" --
"ran X, got Y". CI green is necessary but rarely sufficient on its own.
-->

- [ ] Tests pass locally
- [ ] Relevant docs updated (`threat-model.md`, `devsecops.md`, `security-decisions.md`)
- [ ] No new secrets, credentials, or PII in code, logs, or fixtures
