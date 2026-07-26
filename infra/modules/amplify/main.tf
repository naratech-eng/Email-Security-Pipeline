###############################################################################
# Module: amplify — Amplify Hosting app for the analyst dashboard (frontend/).
#
# Connects the GitHub repo and declares the dev + naratech branches with
# per-branch env vars and auto-build ON — so a merge to either branch triggers a
# build+deploy automatically. Monorepo: only the frontend/ subtree is built
# (see frontend/amplify.yml applications[].appRoot + AMPLIFY_MONOREPO_APP_ROOT).
###############################################################################

resource "aws_amplify_app" "dashboard" {
  name         = "${var.project}-dashboard"
  repository   = var.github_repository
  access_token = var.github_access_token
  platform     = "WEB"

  # App-wide env. Per-branch VITE_* values are set on each branch below.
  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "frontend"
    # Full clean build each time (this SPA is small; avoids stale-diff deploys).
    AMPLIFY_DIFF_DEPLOY = "false"
  }

  # The build spec lives in-repo at frontend/amplify.yml (applications[] form),
  # which Amplify uses automatically for the monorepo appRoot — not inlined here
  # so the two never drift.

  # SPA rewrite: send non-asset paths to index.html so client-side routes
  # (react-router) resolve on refresh / deep link.
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|js|map|json|png|svg|woff2?|ico)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  # We declare branches explicitly; don't let Amplify auto-create them.
  enable_branch_auto_build    = true
  enable_auto_branch_creation = false

  lifecycle {
    # access_token is write-only in the API; ignore drift so re-applies are clean.
    ignore_changes = [access_token]
  }
}

# --------------------------------------------------------------------------- #
# dev branch -> esp-dev.<domain>
# --------------------------------------------------------------------------- #
resource "aws_amplify_branch" "dev" {
  app_id      = aws_amplify_app.dashboard.id
  branch_name = var.dev_branch
  stage       = "DEVELOPMENT"

  enable_auto_build           = true
  enable_pull_request_preview = true # per-PR previews for PRs targeting dev

  environment_variables = {
    VITE_API_BASE_URL         = var.api_base_url
    VITE_COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    VITE_COGNITO_CLIENT_ID    = var.cognito_client_id
    VITE_COGNITO_REGION       = var.aws_region
    VITE_APP_ENV              = "DEV"
  }
}

# --------------------------------------------------------------------------- #
# naratech branch -> esp.<domain> (production)
# --------------------------------------------------------------------------- #
resource "aws_amplify_branch" "prod" {
  app_id      = aws_amplify_app.dashboard.id
  branch_name = var.prod_branch
  stage       = "PRODUCTION"

  enable_auto_build           = true
  enable_pull_request_preview = false

  environment_variables = {
    VITE_API_BASE_URL         = var.api_base_url
    VITE_COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    VITE_COGNITO_CLIENT_ID    = var.cognito_client_id
    VITE_COGNITO_REGION       = var.aws_region
    VITE_APP_ENV              = "PROD"
  }
}

# --------------------------------------------------------------------------- #
# Custom domains: esp-dev.<domain> (dev) + esp.<domain> (prod)
# wait_for_verification=false so apply never blocks on DNS propagation.
# --------------------------------------------------------------------------- #
resource "aws_amplify_domain_association" "this" {
  count                 = var.create_domain_association ? 1 : 0
  app_id                = aws_amplify_app.dashboard.id
  domain_name           = var.domain_name
  wait_for_verification = false

  sub_domain {
    branch_name = aws_amplify_branch.dev.branch_name
    prefix      = "esp-dev"
  }

  sub_domain {
    branch_name = aws_amplify_branch.prod.branch_name
    prefix      = "esp"
  }
}
