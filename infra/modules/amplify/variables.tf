variable "project" {
  type        = string
  description = "Project prefix for resource names (e.g. esp)."
}

variable "github_repository" {
  type        = string
  description = "Full HTTPS URL of the GitHub repo Amplify builds from."
  default     = "https://github.com/naratech-eng/Email-Security-Pipeline"
}

variable "github_access_token" {
  type        = string
  default     = ""
  description = <<-EOT
    GitHub personal access token Amplify uses to connect the repo + install the
    build webhook (this is what makes a merge trigger a build). Classic PAT with
    `repo` + `admin:repo_hook` scope. Pass via TF_VAR_github_access_token or a
    tfvars file that is NOT committed — never hardcode.

    Only required for the FIRST apply, which creates the app. "" is mapped to
    null in main.tf (the provider rejects an empty string) so later applies —
    including CI, which has no PAT — plan clean against the existing app.
  EOT
  sensitive   = true
}

variable "aws_region" {
  type        = string
  description = "AWS region (fed to VITE_COGNITO_REGION)."
}

variable "api_base_url" {
  type        = string
  description = "FastAPI base URL the SPA calls (VITE_API_BASE_URL)."
  default     = "https://esp-api.naratech.xyz"
}

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito user pool id (VITE_COGNITO_USER_POOL_ID)."
}

variable "cognito_client_id" {
  type        = string
  description = "Cognito app client id (VITE_COGNITO_CLIENT_ID)."
}

variable "cognito_identity_pool_id" {
  type        = string
  default     = ""
  description = "Cognito identity pool id (VITE_COGNITO_IDENTITY_POOL_ID) — enables browser S3 avatar uploads."
}

variable "avatars_bucket" {
  type        = string
  default     = ""
  description = "S3 avatars bucket name (VITE_AVATARS_BUCKET)."
}

variable "dev_branch" {
  type        = string
  description = "Git branch that deploys to the dev domain."
  default     = "dev"
}

variable "prod_branch" {
  type        = string
  description = "Git branch that deploys to the prod domain."
  default     = "naratech"
}

variable "create_domain_association" {
  type        = bool
  description = <<-EOT
    Map the custom domains to the branches. Safe to leave on: it never blocks
    apply (wait_for_verification=false). Each domain below must be a Route53
    hosted zone in THIS account, so Amplify can create its own DNS records —
    otherwise the records have to be added by hand wherever DNS is managed.
  EOT
  default     = true
}

variable "prod_domain_name" {
  type        = string
  description = "Domain serving the prod branch. Must be a delegated Route53 zone in this account."
  default     = "esp.naratech.xyz"
}

variable "dev_domain_name" {
  type        = string
  description = "Domain serving the dev branch. Must be a delegated Route53 zone in this account."
  default     = "esp-dev.naratech.xyz"
}
