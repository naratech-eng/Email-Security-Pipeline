variable "project" {
  type = string
}

variable "mail_hostname" {
  type        = string
  description = "Sending domain, which is also the mail host. Must be a domain this account can publish DNS for — the apex naratech.xyz is hosted at the registrar, not Route53, so only mail.naratech.xyz is usable here."
  default     = "mail.naratech.xyz"
}

variable "mail_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for mail.naratech.xyz — holds the DKIM CNAMEs, SPF and DMARC records"
}

variable "ses_region" {
  type        = string
  description = "Region whose SES SMTP endpoint the relay targets. Must match the region the domain identity is verified in."
  default     = "us-east-1"
}

variable "dmarc_report_address" {
  type        = string
  description = "Address that receives DMARC aggregate reports"
  default     = "postmaster@mail.naratech.xyz"
}

variable "sandbox_verified_recipients" {
  type        = list(string)
  description = "Addresses to verify as SES identities so they can receive mail while the account is in the SES sandbox. AWS emails each one a confirmation link that its owner must click. Empty once production access is granted."
  default     = []
}
