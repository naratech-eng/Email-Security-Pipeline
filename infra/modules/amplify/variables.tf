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
  description = <<-EOT
    GitHub personal access token Amplify uses to connect the repo + install the
    build webhook (this is what makes a merge trigger a build). Classic PAT with
    `repo` + `admin:repo_hook` scope. Pass via TF_VAR_github_access_token or a
    tfvars file that is NOT committed — never hardcode.
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
    Map custom subdomains (esp-dev / esp on domain_name) to the branches. Safe to
    leave on: it never blocks apply (wait_for_verification=false). If naratech.xyz
    is not a Route53 zone in this account, add the CNAME/verification records
    Amplify emits (see the amplify_domain_records output) to wherever DNS lives.
  EOT
  default     = true
}

variable "domain_name" {
  type        = string
  description = "Apex domain for the custom subdomains."
  default     = "naratech.xyz"
}
