###############################################################################
# Module: s3_avatars — private bucket for user profile images.
#
# Uploaded to directly from the browser via aws-amplify/storage using the
# Cognito Identity Pool's authenticated role (scoped per user prefix in the
# cognito module, which also grants the matching KMS permissions -- see
# aws_s3_bucket_server_side_encryption_configuration below). The bucket stays
# private (no public access) and objects are served via signed URLs.
###############################################################################

resource "aws_s3_bucket" "this" {
  #checkov:skip=CKV2_AWS_62: No event-notification consumer needed for avatars.
  #checkov:skip=CKV_AWS_144: Single-region; cross-region replication is overkill for avatars.
  bucket = var.bucket_name
  tags = {
    Project = var.project
    Purpose = "avatars"
  }
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      # AWS-managed aws/s3 key, not a customer CMK -- no extra cost, and the
      # bucket-default setting means the browser PUT never needs to name a key
      # itself. The identity-pool role in modules/cognito grants
      # kms:GenerateDataKey/Decrypt scoped via kms:ViaService=s3, which SSE-KMS
      # requires even for bucket-default encryption (unlike AES256, which needs
      # no key permission at all) -- switching this without that grant would
      # have broken uploads with AccessDenied.
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

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

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
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
