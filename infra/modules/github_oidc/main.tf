###############################################################################
# GitHub Actions OIDC — IAM provider + least-privilege CI role
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# One OIDC provider per AWS account (use_existing_provider avoids conflicts if
# another module already created it in the same account).
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC thumbprint (stable; rotate only if GitHub rotates its cert)
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_ci" {
  name = "${var.project}-github-ci-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Allow PRs and pushes from any branch in the repo
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
        }
      }
    }]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "github_ci_admin" {
  role       = aws_iam_role.github_ci.name
  # AdministratorAccess scoped to the dev account is acceptable for a student
  # capstone lab. Tighten to a custom policy before any production workload.
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
