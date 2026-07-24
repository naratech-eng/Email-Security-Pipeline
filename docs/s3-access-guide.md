# S3 Bucket Access Guide

## ⚠️ This guide was rewritten — read this before using anything below

Everything under **"Original M2 Setup (superseded)"** near the bottom of this doc describes a bucket (`email-security-pipeline-datasets`) and IAM group (`email-security-team`) that lived in **AWS account `091957636975`**. That was the M2-era baseline. Since the M3 Terraform baseline, the project runs in a **different, dedicated account (`802531654188`)** with its own S3 buckets, already provisioned by `infra/modules/s3_bucket` — **not newly created**, they've existed since M3, this guide just never caught up to that fact. If you have old credentials from the M2 setup, they still work for that old bucket, but that bucket is no longer where this project's real data lives.

## Overview

This guide documents S3 bucket access for the Email Security Pipeline project's **current** infrastructure (account `802531654188`, `us-east-1`), provisioned via Terraform (`infra/modules/s3_bucket`, wired up in `infra/envs/dev/main.tf`).

## AWS Resources (current, Terraform-managed since M3)

| Bucket | Purpose | Lifecycle |
|---|---|---|
| `esp-datasets-us-east-1-802531654188` | Phishing email + malicious URL datasets | Transitions to IA/Glacier enabled |
| `esp-models-us-east-1-802531654188` | Trained model artifacts (M6 registry) | Noncurrent versions expire after 30 days (OBS-T3) |
| `esp-logs-us-east-1-802531654188` | Screenshots, misc project logs | — |

All three: versioning enabled, KMS (`aws:kms`, AWS-managed key) encryption at rest, public access fully blocked. No manually-created bucket policy or IAM group backs these — access is granted per-user via individually attached IAM policies (see below), since this project doesn't provision IAM users through Terraform.

## 🚨 Known gap: the real data isn't in these buckets yet

Checked directly against the live account while writing this update:

- **`esp-datasets-...` is empty.** Zero objects.
- **`esp-models-...` is empty.** Zero objects (also flagged in `docs/m7-t1-fastapi-service.md` — it blocks M7-T1 directly).
- **`esp-logs-...`** has some AWS console screenshots, nothing else.

The actual phishing email / malicious URL datasets referenced throughout M2–M6 docs only exist in the **old M2 bucket, old account** (see superseded section below). Nothing has migrated them to the current bucket. Whoever next needs the datasets (or the M6 model artifacts) should re-download from the source datasets (Kaggle/URLhaus, per `docs/datasets/*.md`) or copy from the old bucket if still reachable, then upload to `esp-datasets-us-east-1-802531654188` — this hasn't been done yet and isn't automatic.

### IAM Policy Pattern (current)

There's no single shared group/policy anymore — each team member gets an individually attached least-privilege policy scoped to what their task needs. For general dataset read/write, that looks like:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::esp-datasets-us-east-1-802531654188",
      "arn:aws:s3:::esp-datasets-us-east-1-802531654188/*"
    ]
  }]
}
```

(A task-specific example — including model-bucket access, Secrets Manager, ECR, and ECS/CloudWatch read for M7-T1 — is in `docs/m7-t1-fastapi-service.md` §7.)

## 🚨 Existing team access is currently broken — same accounts, wrong bucket

Checked directly against the live account while writing this update. The good news: **team IAM users already exist in the current account** — `icampbell8`, `jgkalluri`, `khaxhiaj`, and `mchea3` were all created in `802531654188` (not just the old account) on 2026-05-29, and are members of an `email-security-team` group there too.

The bad news: that group's attached policy — `arn:aws:iam::802531654188:policy/EmailSecurityS3AccessPolicy` — still grants access to `email-security-pipeline-datasets` (the *old* M2 bucket name). Since S3 bucket ARNs don't encode an account ID, this policy is syntactically valid but points at a bucket these users don't actually own or get any real access to. **All four team members currently have zero working S3 access to the buckets that matter right now.** This isn't a documentation problem — it's a live misconfiguration.

### The fix (project owner runs this — modifies IAM, not something to do casually)

Update the policy's own document to point at the current bucket instead of creating new users/groups (everything else about the existing setup — user names, group membership — is already correct and doesn't need touching):

```bash
export AWS_PROFILE=lab-user

cat > fixed-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::esp-datasets-us-east-1-802531654188/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::esp-datasets-us-east-1-802531654188"
    }
  ]
}
EOF

aws iam create-policy-version \
  --policy-arn arn:aws:iam::802531654188:policy/EmailSecurityS3AccessPolicy \
  --policy-document file://fixed-policy.json \
  --set-as-default

# IAM allows max 5 versions per policy — clean up the old one once confirmed working
aws iam list-policy-versions --policy-arn arn:aws:iam::802531654188:policy/EmailSecurityS3AccessPolicy
```

I'm not running this myself since it changes a live IAM policy — same reasoning as every other AWS-mutating step in this project.

## Team Member Quick Start (current)

Once the policy fix above lands, existing credentials for `icampbell8`/`jgkalluri`/`khaxhiaj`/`mchea3` just work — no new keys needed.

```bash
aws configure --profile email-security
# Access Key ID / Secret Access Key: your existing assigned key
# region: us-east-1, output: json

aws s3 ls s3://esp-datasets-us-east-1-802531654188 --recursive --profile email-security
aws s3 cp local-file.csv s3://esp-datasets-us-east-1-802531654188/ --profile email-security
aws s3 sync ./local-datasets s3://esp-datasets-us-east-1-802531654188/ --profile email-security
```

Adding a brand-new team member (not one of the four above) still follows the original per-user process — create user, add to `email-security-team` group in account `802531654188`, generate access keys, share privately (password manager, never git/chat):

```bash
aws iam create-user --user-name <username>
aws iam add-user-to-group --group-name email-security-team --user-name <username>
aws iam create-access-key --user-name <username>
```

## Dataset Links

**Currently none — the bucket is empty.** There is no dataset uploaded to `esp-datasets-us-east-1-802531654188` right now (verified directly). The original M2 dataset files (`phishing_email.csv`, `malicious_phish.csv`, `urlhaus-latest.csv`) only exist in the old bucket/account and were never migrated. To restore them here:

```bash
# Option A — re-download from the original sources (see docs/datasets/*.md for exact URLs/citations)
# Option B — if the old bucket is still reachable, copy directly:
aws s3 cp s3://email-security-pipeline-datasets/datasets/ s3://esp-datasets-us-east-1-802531654188/datasets/ --recursive --profile <old-account-profile>
```

Once uploaded, this section should be updated with the real `s3://esp-datasets-us-east-1-802531654188/...` paths.

## Security Best Practices

1. **Never commit credentials to git**: Access keys should never be in code or documentation
2. **Use AWS profiles**: Configure profiles instead of hardcoding credentials
3. **Rotate keys regularly**: Change access keys periodically (every 90 days recommended)
4. **Enable MFA**: Consider enabling MFA for IAM users for additional security
5. **Least privilege**: Scope each policy to only the bucket(s)/resources a task actually needs
6. **Audit access**: Use CloudTrail to monitor who accesses the bucket and when
7. **No public bucket exposure**: all three current buckets have S3 Block Public Access fully enabled and encryption at rest — don't relax this without project-owner approval and a threat-model update (the M2 setup temporarily did this; don't repeat it here)

## Bucket Structure

Recommended folder structure (mirrors what M6's artifact registry already expects for the models bucket):

```
esp-datasets-us-east-1-802531654188/
├── datasets/
│   ├── phishing/
│   │   └── phishing_email.csv
│   └── urls/
│       ├── malicious_phish.csv
│       └── urlhaus-latest.csv
└── processed/
    └── features/

esp-models-us-east-1-802531654188/
└── models/
    └── artifacts/
        ├── registry.json
        ├── email/email_linearsvc.joblib
        └── url/{url_charcnn.keras, url_char_vocab.json, url_rf.joblib}
```

## Troubleshooting

### Access Denied Error

1. Verify you're using the correct AWS profile
2. Check that your user is in the `email-security-team` group **in account `802531654188`** (not the old account)
3. Verify the bucket name is correct: `esp-datasets-us-east-1-802531654188`
4. Confirm the group's policy has actually been fixed (see the fix above) — if it still says `email-security-pipeline-datasets`, that's why access fails

### Invalid Credentials

1. Run `aws configure --profile email-security` to re-enter credentials
2. Contact the project lead to verify your user exists in the group
3. Generate new access keys if old ones expired

### Region Mismatch

```bash
aws configure set region us-east-1 --profile email-security
```

## Current Team Members (account `802531654188`)

| Username | Group | Created |
|---|---|---|
| `icampbell8` | `email-security-team` | 2026-05-29 |
| `khaxhiaj` | `email-security-team` | 2026-05-29 |
| `jgkalluri` | `email-security-team` | 2026-05-29 |
| `mchea3` | `email-security-team` | 2026-05-29 |
| `lab-user` | — (Terraform/infra access) | 2026-05-29 |

---

## Original M2 Setup (superseded)

Kept for institutional memory — if you have credentials from this era, they still authenticate, but this bucket/account is no longer where the project's real data or infrastructure lives.

- **Bucket:** `email-security-pipeline-datasets`, account `091957636975`, region `us-east-1`
- **IAM group:** `email-security-team` (same name, different account/policy than the current one above)
- **IAM Policy:** `EmailSecurityS3AccessPolicy`, ARN `arn:aws:iam::091957636975:policy/EmailSecurityS3AccessPolicy`
- Team members were provisioned 2026-05-23 with the same usernames (`icampbell8`, `khaxhiaj`, `jgkalluri`, `mchea3`) in this old account
- Public read access to the three dataset CSVs was **temporarily** enabled on 2026-05-23 for short-term sharing and was meant to be reverted after the team pulled local copies — if this bucket is still reachable, confirm that revert actually happened

## References

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS IAM Documentation](https://docs.aws.amazon.com/iam/)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [M7-T1 task draft](m7-t1-fastapi-service.md) — task-specific IAM policy example (models bucket, Secrets Manager, ECR, ECS)
