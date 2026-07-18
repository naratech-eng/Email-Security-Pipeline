###############################################################################
# Module: s3_bucket — reusable secure S3 bucket
# Used for: datasets, model artifacts, logs
###############################################################################

resource "aws_s3_bucket" "this" {
  #checkov:skip=CKV2_AWS_62: Event notifications not needed — no SNS/SQS/Lambda consumer for these buckets
  bucket = var.bucket_name

  tags = {
    Project = var.project
    Purpose = var.purpose
  }
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

# KMS encryption with the AWS-managed aws/s3 key (no extra cost) (CKV_AWS_145)
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle is always created so every bucket satisfies CKV2_AWS_61 and
# aborts incomplete multipart uploads (CKV_AWS_300). Storage-class transitions
# are only added when enable_lifecycle = true.
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  dynamic "rule" {
    for_each = var.enable_lifecycle ? [1] : []
    content {
      id     = "transition-old-objects"
      status = "Enabled"

      filter { prefix = "" }

      abort_incomplete_multipart_upload {
        days_after_initiation = 7
      }

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

  # OBS-T3 — bound storage cost for versioned buckets (e.g. model artifacts)
  # by expiring superseded versions after N days. Current version is never
  # touched by this rule, so it's a pure rollback-window cap, not a retention
  # cliff on the live artifact.
  dynamic "rule" {
    for_each = var.noncurrent_version_expiration_days > 0 ? [1] : []
    content {
      id     = "expire-noncurrent-versions"
      status = "Enabled"

      filter {}

      noncurrent_version_expiration {
        noncurrent_days = var.noncurrent_version_expiration_days
      }
    }
  }
}
