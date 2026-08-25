###############################################################################
# Module: security_baseline — GuardDuty, Security Hub, CloudTrail, Config
# (M9-T4 / OBS-T2)
###############################################################################

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_partition" "current" {}

# --------------------------------------------------------------------------- #
# Shared log bucket for CloudTrail + Config.
#
# Deliberately its OWN bucket, not the general s3_bucket module: that module
# defaults to SSE-KMS with the AWS-managed aws/s3 key, which CloudTrail does
# not support for log delivery (KMS encryption for CloudTrail requires a
# customer-managed CMK with an explicit key-policy grant -- the AWS-managed
# key has no such grant and deliveries fail). SSE-S3 (AES256) sidesteps that
# entirely, at zero extra cost, matching the project's existing avoid-a-CMK
# stance elsewhere (docs/devsecops.md §3.1).
# --------------------------------------------------------------------------- #
resource "aws_s3_bucket" "security_logs" {
  #checkov:skip=CKV2_AWS_62: Event notifications not needed — no SNS/SQS/Lambda consumer for these logs
  #checkov:skip=CKV_AWS_18: Access logging on the log bucket itself is redundant here — CloudTrail is already this account's access-logging story
  #checkov:skip=CKV_AWS_145: SSE-S3, not KMS, is deliberate here — see the SSE config comment below (CloudTrail can't use the AWS-managed aws/s3 key, and a customer CMK is a paid resource deferred for the lab budget, docs/devsecops.md §3.1)
  bucket = "${var.project}-security-logs-${data.aws_region.current.name}-${data.aws_caller_identity.current.account_id}"

  tags = { Project = var.project, Purpose = "security-logs" }
}

resource "aws_s3_bucket_versioning" "security_logs" {
  bucket = aws_s3_bucket.security_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "security_logs" {
  bucket = aws_s3_bucket.security_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # see comment above — CloudTrail can't use the aws/s3 KMS key
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "security_logs" {
  bucket                  = aws_s3_bucket.security_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "security_logs" {
  bucket = aws_s3_bucket.security_logs.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Trail/Config history has real, ongoing evidentiary value but not forever
  # at full price on a small budget — age out to Glacier rather than
  # deleting outright.
  rule {
    id     = "transition-old-logs"
    status = "Enabled"

    filter { prefix = "" }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_policy" "security_logs" {
  bucket = aws_s3_bucket.security_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.security_logs.arn
        Condition = {
          StringEquals = { "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${var.project}-trail" }
        }
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.security_logs.arn}/cloudtrail/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl"  = "bucket-owner-full-control"
            "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${var.project}-trail"
          }
        }
      },
      {
        Sid       = "AWSConfigBucketPermissionsCheck"
        Effect    = "Allow"
        Principal = { Service = "config.amazonaws.com" }
        Action    = ["s3:GetBucketAcl", "s3:ListBucket"]
        Resource  = aws_s3_bucket.security_logs.arn
      },
      {
        Sid       = "AWSConfigBucketDelivery"
        Effect    = "Allow"
        Principal = { Service = "config.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.security_logs.arn}/config/AWSLogs/${data.aws_caller_identity.current.account_id}/Config/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      },
      # Everything above grants access; this denies the insecure way of using
      # it. S3 accepts plain HTTP unless a policy refuses it, and Deny beats
      # Allow, so this closes the gap for every principal at once rather than
      # per-statement. It matters more here than on a normal bucket: this one
      # holds the CloudTrail and Config record, which is exactly the evidence
      # an attacker would want to read or tamper with in transit.
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.security_logs.arn,
          "${aws_s3_bucket.security_logs.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
    ]
  })
}

# --------------------------------------------------------------------------- #
# GuardDuty — threat detection, org-wide, always on
# --------------------------------------------------------------------------- #
resource "aws_guardduty_detector" "this" {
  #checkov:skip=CKV2_AWS_3: This is a single, standalone AWS account (no AWS Organizations) -- org-wide GuardDuty via a delegated admin account doesn't apply here; a standalone detector is the correct/only option for this account structure.
  count = var.enable_guardduty ? 1 : 0

  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"

  tags = { Project = var.project }
}

# Push findings straight to the alerts topic too -- Security Hub aggregates
# them for the dashboard/console view, but this gives an immediate email/SNS
# ping without going through Security Hub at all, matching how the ALB/RDS
# CloudWatch alarms already alert.
resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count = var.enable_guardduty ? 1 : 0

  name        = "${var.project}-guardduty-findings"
  description = "Forward GuardDuty findings to the shared alerts topic"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
  })
}

resource "aws_cloudwatch_event_target" "guardduty_to_sns" {
  count = var.enable_guardduty ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "guardduty-to-alerts-topic"
  arn       = var.alerts_topic_arn
}

# --------------------------------------------------------------------------- #
# Security Hub — findings aggregation across GuardDuty, Config, Inspector,
# and its own managed checks (the AWS-native SIEM layer, per M9-T4's notes).
# --------------------------------------------------------------------------- #
resource "aws_securityhub_account" "this" {
  count = var.enable_security_hub ? 1 : 0

  enable_default_standards = false # explicit subscriptions below instead
}

resource "aws_securityhub_standards_subscription" "cis" {
  count = var.enable_security_hub ? 1 : 0

  standards_arn = "arn:${data.aws_partition.current.partition}:securityhub:${data.aws_region.current.name}::standards/cis-aws-foundations-benchmark/v/1.2.0"
  depends_on    = [aws_securityhub_account.this]
}

resource "aws_securityhub_standards_subscription" "fsbp" {
  count = var.enable_security_hub ? 1 : 0

  standards_arn = "arn:${data.aws_partition.current.partition}:securityhub:${data.aws_region.current.name}::standards/aws-foundational-security-best-practices/v/1.0.0"
  depends_on    = [aws_securityhub_account.this]
}

# --------------------------------------------------------------------------- #
# CloudTrail — multi-region, log-file-validated, all management events.
# S3 is the durable/evidentiary copy; CloudWatch Logs is the near-real-time
# one (queryable via Logs Insights, alarmable) -- the two aren't redundant.
# --------------------------------------------------------------------------- #
resource "aws_cloudwatch_log_group" "cloudtrail" {
  #checkov:skip=CKV_AWS_158: CloudWatch Logs' default encryption-at-rest is AWS-owned (always on); a customer-managed KMS key is a paid CMK, deferred for the lab budget like the other KMS CMK skips in this repo (docs/devsecops.md §3.1)
  name              = "/aws/cloudtrail/${var.project}"
  retention_in_days = 365
}

resource "aws_iam_role" "cloudtrail_to_cloudwatch" {
  name = "${var.project}-cloudtrail-cwl-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudtrail.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "cloudtrail_to_cloudwatch" {
  name = "cloudtrail-cwl-delivery"
  role = aws_iam_role.cloudtrail_to_cloudwatch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
    }]
  })
}

resource "aws_cloudtrail" "this" {
  #checkov:skip=CKV_AWS_252: SNS notification for log delivery is a second alerting path on top of the CloudWatch/GuardDuty ones already wired; deferred for the lab
  #checkov:skip=CKV_AWS_35: Encrypted at rest via the bucket's SSE-S3 default (see security_logs bucket above) -- KMS specifically requires a customer-managed CMK for CloudTrail (the AWS-managed aws/s3 key has no grant for the CloudTrail service), a paid CMK deferred for the lab budget like other KMS CMK skips in this repo (docs/devsecops.md §3.1)
  name                          = "${var.project}-trail"
  s3_bucket_name                = aws_s3_bucket.security_logs.id
  s3_key_prefix                 = "cloudtrail"
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true # CKV_AWS_36
  enable_logging                = true

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*" # CKV2_AWS_10
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_to_cloudwatch.arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  depends_on = [aws_s3_bucket_policy.security_logs, aws_iam_role_policy.cloudtrail_to_cloudwatch]
  tags       = { Project = var.project }
}

# --------------------------------------------------------------------------- #
# AWS Config — configuration recorder + delivery channel
#
# Real, ongoing per-configuration-item cost (unlike the checkov suppressions
# elsewhere in this repo, which avoid cost for near-zero risk items, Config
# is an explicit M9-T4 acceptance criterion, so it's on deliberately).
# --------------------------------------------------------------------------- #
resource "aws_iam_role" "config" {
  name = "${var.project}-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "config" {
  role       = aws_iam_role.config.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWS_ConfigRole"
}

resource "aws_config_configuration_recorder" "this" {
  name     = "${var.project}-config-recorder"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "this" {
  name           = "${var.project}-config-delivery"
  s3_bucket_name = aws_s3_bucket.security_logs.id
  s3_key_prefix  = "config"

  depends_on = [aws_s3_bucket_policy.security_logs]
}

resource "aws_config_configuration_recorder_status" "this" {
  name       = aws_config_configuration_recorder.this.name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.this]
}
