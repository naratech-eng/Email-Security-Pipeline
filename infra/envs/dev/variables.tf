variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "esp"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "key_name" {
  type        = string
  description = "EC2 key pair name for mail server SSH (create in AWS Console → EC2 → Key Pairs)"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password — set via: export TF_VAR_db_password=yourpassword"
}

# --------------------------------------------------------------------------- #
# Route53 zone IDs (all 3 zones in lab account 802531654188)
# --------------------------------------------------------------------------- #
variable "esp_api_zone_id" {
  type        = string
  description = "Hosted zone ID for esp-api.naratech.xyz"
  default     = "Z04132153JT7YAXT7E8D"
}

variable "esp_zone_id" {
  type        = string
  description = "Hosted zone ID for esp.naratech.xyz (Amplify frontend, prod branch)"
  default     = "Z08382621P3TE6ILDEBXO"
}

variable "esp_dev_zone_id" {
  type        = string
  description = "Hosted zone ID for esp-dev.naratech.xyz (Amplify frontend, dev branch). Delegated subdomain zone — the naratech.xyz apex is in another AWS account, so never attach records there."
  default     = "Z03718845RKDT8O4W6QR"
}

variable "mail_zone_id" {
  type        = string
  description = "Hosted zone ID for mail.naratech.xyz"
  default     = "Z04118593IZKW7SZN71AP"
}

# --------------------------------------------------------------------------- #
# Mail server
# --------------------------------------------------------------------------- #
variable "mail_domain" {
  type    = string
  default = "naratech.xyz"
}

variable "mail_hostname" {
  type    = string
  default = "mail.naratech.xyz"
}

# Contact address Let's Encrypt uses for certificate-expiry warnings (M7-T17).
variable "certbot_email" {
  type    = string
  default = "snsknarayana@gmail.com"
}

# --------------------------------------------------------------------------- #
# SES outbound relay (M7-T6)
# --------------------------------------------------------------------------- #
# While the SES account is in the sandbox, outbound mail is delivered only to
# verified addresses. Each entry here triggers a confirmation email from AWS
# that the address owner must click before mail to it will be delivered. Empty
# this list once SES production access is granted.
variable "ses_sandbox_verified_recipients" {
  type = list(string)
  default = [
    "snsknarayana@gmail.com",
    "icampbell8@myseneca.ca",           # Isaiah — Project Lead
    "khaxhiaj@myseneca.ca",             # Klara — Research & Data
    "sknnarayana-mudiyans@myseneca.ca", # Sanjeewa — Infrastructure
    "jgkalluri@myseneca.ca",            # John Graham — Frontend & Security
    "mchea3@myseneca.ca",               # Michael Chea — ML Engineer
  ]
}

# --------------------------------------------------------------------------- #
# Cognito — Amplify frontend at esp.naratech.xyz
# --------------------------------------------------------------------------- #
variable "cognito_callback_urls" {
  type    = list(string)
  default = ["https://esp.naratech.xyz/callback", "http://localhost:3000/callback"]
}

variable "cognito_logout_urls" {
  type    = list(string)
  default = ["https://esp.naratech.xyz", "http://localhost:3000"]
}

# --------------------------------------------------------------------------- #
# Amplify Hosting — dashboard frontend
# --------------------------------------------------------------------------- #
variable "amplify_github_access_token" {
  type        = string
  sensitive   = true
  default     = ""
  description = <<-EOT
    GitHub PAT (classic; `repo` + `admin:repo_hook`) Amplify uses to connect the
    repo and install the build webhook. Provide at apply time — do NOT commit:
      export TF_VAR_amplify_github_access_token=ghp_xxx

    Defaults to "" deliberately: the token is only consumed when the Amplify app
    is first created. aws_amplify_app.access_token is write-only in the AWS API,
    so the module sets lifecycle.ignore_changes on it and later applies never
    send it. Without this default the variable would be required, and the
    terraform-apply workflow (which passes only key_name and db_password) would
    fail every auto-apply with "No value for required variable".
  EOT
}

variable "dashboard_api_base_url" {
  type        = string
  default     = "https://esp-api.naratech.xyz"
  description = "FastAPI base URL the dashboard SPA calls (VITE_API_BASE_URL)."
}

# --------------------------------------------------------------------------- #
# M9-T4 — security baseline / alerting
# --------------------------------------------------------------------------- #
variable "alert_email" {
  type        = string
  default     = ""
  description = "Optional email subscribed to the OBS-T1/M9-T4 SNS alerts topic. SNS sends a confirmation link on first apply; must be clicked manually."
}

variable "waf_block_mode" {
  type        = bool
  default     = false
  description = "false = WAF managed rules run in COUNT mode (observe only); true = actually block. Flip once a baseline run shows no false positives against real traffic."
}

variable "enable_guardduty" {
  type        = bool
  default     = false
  description = <<-EOT
    Off by default after CreateDetector 403'd with SubscriptionRequiredException
    on the first apply -- an account-level block, not an IAM/code bug. Verify
    independently (AWS Console > GuardDuty > Enable, or `aws guardduty
    create-detector --enable` with your own credentials) before flipping this
    to true, since a repeat failure here blocks every dev apply again.
  EOT
}

variable "enable_security_hub" {
  type        = bool
  default     = false
  description = <<-EOT
    Off by default after EnableSecurityHub 403'd with SubscriptionRequiredException
    on the first apply -- an account-level block, not an IAM/code bug. Verify
    independently (AWS Console > Security Hub > Enable, or `aws securityhub
    enable-security-hub` with your own credentials) before flipping this to
    true, since a repeat failure here blocks every dev apply again.
  EOT
}
