variable "project" {
  type = string
}

variable "callback_urls" {
  type    = list(string)
  default = ["https://esp.naratech.xyz/callback", "http://localhost:3000/callback"]
}

variable "logout_urls" {
  type    = list(string)
  default = ["https://esp.naratech.xyz", "http://localhost:3000"]
}

variable "avatars_bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket that stores profile avatars (scopes the authenticated identity-pool role)."
}

variable "ses_source_arn" {
  type        = string
  default     = ""
  description = <<-EOT
    ARN of a verified SES identity to send Cognito verification/reset emails
    from (email_sending_account = DEVELOPER). Empty ("") keeps the default
    COGNITO_DEFAULT sender (unbranded, ~50/day, spam-prone). Same-account
    identity, so no SES sending-authorization policy is required.
  EOT
}

variable "ses_from_email" {
  type        = string
  default     = "no-reply@mail.naratech.xyz"
  description = "From address for Cognito emails; must be on the verified SES identity's domain. Only used when ses_source_arn is set."
}
