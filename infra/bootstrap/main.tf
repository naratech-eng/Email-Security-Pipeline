###############################################################################
# Bootstrap — Terraform remote state backend
# Run ONCE per AWS account:  cd infra/bootstrap && terraform init && terraform apply
# After apply, do NOT re-run unless you are rebuilding from scratch.
###############################################################################

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

variable "aws_region" {
  default = "us-east-1"
}

variable "aws_profile" {
  default = "lab-user"
}

variable "project" {
  default = "esp" # email-security-pipeline
}

# --------------------------------------------------------------------------- #
# KMS key for state bucket encryption
# --------------------------------------------------------------------------- #
resource "aws_kms_key" "tfstate" {
  description             = "${var.project} Terraform state encryption key"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Project = var.project
    Purpose = "terraform-state"
  }
}

resource "aws_kms_alias" "tfstate" {
  name          = "alias/${var.project}-tfstate"
  target_key_id = aws_kms_key.tfstate.key_id
}

# --------------------------------------------------------------------------- #
# S3 bucket for Terraform state
# --------------------------------------------------------------------------- #
resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project}-tfstate-${var.aws_region}-802531654188"

  tags = {
    Project = var.project
    Purpose = "terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.tfstate.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --------------------------------------------------------------------------- #
# Outputs — copy these into infra/envs/dev/backend.tf
# --------------------------------------------------------------------------- #
output "state_bucket_name" {
  value = aws_s3_bucket.tfstate.id
}

output "kms_key_arn" {
  value = aws_kms_key.tfstate.arn
}
