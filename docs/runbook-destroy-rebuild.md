# Runbook: Terraform Destroy + Rebuild (Dev Environment)

**Target time:** < 30 minutes end-to-end  
**Environment:** `infra/envs/dev` — AWS account `802531654188`, region `us-east-1`  
**When to use:** cost reset between demo sessions, broken state recovery, or full environment refresh.

---

## Prerequisites

| Requirement | Check |
|---|---|
| AWS CLI configured (`lab-user` profile or OIDC session) | `aws sts get-caller-identity` |
| Terraform ≥ 1.8 | `terraform version` |
| `TF_VAR_db_password` set in shell | `echo $TF_VAR_db_password` |
| `TF_VAR_key_name` set in shell | `echo $TF_VAR_key_name` |
| S3 state bucket + DynamoDB lock table exist | Step 1 below verifies |

---

## Step 1 — Verify state backend is reachable

```bash
cd infra/envs/dev
terraform init
```

Expected: `Terraform has been successfully initialized`. If the state bucket was also destroyed, re-run bootstrap first (see [Appendix A](#appendix-a-re-bootstrap-state-backend)).

---

## Step 2 — (Optional) Snapshot RDS before destroy

Skip this step if the database has no data worth keeping.

```bash
aws rds create-db-snapshot \
  --db-instance-identifier esp-postgres \
  --db-snapshot-identifier esp-postgres-pre-destroy-$(date +%Y%m%d%H%M) \
  --profile lab-user
```

Wait for snapshot status `available` before proceeding:

```bash
aws rds describe-db-snapshots \
  --db-instance-identifier esp-postgres \
  --query 'DBSnapshots[-1].[DBSnapshotIdentifier,Status]' \
  --output text \
  --profile lab-user
```

---

## Step 3 — Destroy the environment

```bash
cd infra/envs/dev
terraform destroy \
  -var="key_name=$TF_VAR_key_name" \
  -var="db_password=$TF_VAR_db_password"
```

Type `yes` when prompted. Typical duration: **10–15 minutes** (RDS deletion is the slowest step).

> **Note:** The S3 state bucket (`esp-tfstate-us-east-1-802531654188`) and DynamoDB lock table (`esp-tflock`) are **not** managed by this environment's Terraform state — they will not be destroyed.

---

## Step 4 — Rebuild the environment

```bash
terraform apply \
  -var="key_name=$TF_VAR_key_name" \
  -var="db_password=$TF_VAR_db_password"
```

Type `yes` when prompted. Typical duration: **12–18 minutes**.

---

## Step 5 — Verify key resources

```bash
# Print outputs
terraform output

# Check EC2 mail server is running
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=esp-mail-server" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress]' \
  --output table \
  --profile lab-user

# Check ECS service is stable
aws ecs describe-services \
  --cluster esp-cluster \
  --services esp-api \
  --query 'services[0].[serviceName,runningCount,desiredCount]' \
  --output table \
  --profile lab-user

# Check RDS is available
aws rds describe-db-instances \
  --db-instance-identifier esp-postgres \
  --query 'DBInstances[0].[DBInstanceIdentifier,DBInstanceStatus]' \
  --output table \
  --profile lab-user
```

---

## Step 6 — Update Route53 if EC2 IP changed

The mail server gets a new public IP on each rebuild. Terraform manages the Route53 A record automatically — confirm it was updated:

```bash
terraform output mail_server_ip
# compare with:
aws route53 list-resource-record-sets \
  --hosted-zone-id Z04118593IZKW7SZN71AP \
  --query "ResourceRecordSets[?Name=='mail.naratech.xyz.'].ResourceRecords[0].Value" \
  --output text \
  --profile lab-user
```

If they differ, run `terraform apply` again — the IP change will propagate automatically.

---

## Step 7 — Update infrastructure-terraform.md

After a rebuild the deployed resource IDs change. Update the **Deployed Resources** table in [`docs/infrastructure-terraform.md`](infrastructure-terraform.md) with the new values from `terraform output`.

```bash
terraform output -json | jq '.'
```

---

## Timing Summary

| Phase | Typical Duration |
|---|---|
| Prerequisites + init | 2 min |
| RDS snapshot (optional) | 5–10 min |
| `terraform destroy` | 10–15 min |
| `terraform apply` | 12–18 min |
| Verification | 3 min |
| **Total (no snapshot)** | **≈ 27 min** |

---

## Appendix A — Re-bootstrap State Backend

Only needed if the state bucket and/or DynamoDB table were accidentally deleted.

```bash
cd infra/bootstrap
terraform init
terraform apply
```

Then return to [Step 1](#step-1--verify-state-backend-is-reachable).

---

## Appendix B — Partial Destroy (single module)

To destroy and rebuild just one resource without a full teardown:

```bash
# example: rebuild ECS service only
terraform destroy -target=module.ecs \
  -var="key_name=$TF_VAR_key_name" \
  -var="db_password=$TF_VAR_db_password"

terraform apply -target=module.ecs \
  -var="key_name=$TF_VAR_key_name" \
  -var="db_password=$TF_VAR_db_password"
```

Available targets: `module.network`, `module.s3_datasets`, `module.s3_models`, `module.s3_logs`, `module.ecr`, `module.rds`, `module.alb`, `module.ecs`, `module.mail_server`, `module.cognito`.
