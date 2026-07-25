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
  description = "Hosted zone ID for esp.naratech.xyz (Amplify frontend)"
  default     = "Z08382621P3TE6ILDEBXO"
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

# --------------------------------------------------------------------------- #
# SES outbound relay (M7-T6)
# --------------------------------------------------------------------------- #
# While the SES account is in the sandbox, outbound mail is delivered only to
# verified addresses. Each entry here triggers a confirmation email from AWS
# that the address owner must click before mail to it will be delivered. Empty
# this list once SES production access is granted.
variable "ses_sandbox_verified_recipients" {
  type    = list(string)
  default = ["snsknarayana@gmail.com"]
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
