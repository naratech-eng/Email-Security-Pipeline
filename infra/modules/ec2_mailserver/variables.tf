variable "project" {
  type = string
}

variable "public_subnet_id" {
  type = string
}

variable "sg_mail_id" {
  type = string
}

variable "key_name" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "mail_domain" {
  type    = string
  default = "naratech.xyz"
}

variable "mail_hostname" {
  type    = string
  default = "mail.naratech.xyz"
}

variable "mail_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for mail.naratech.xyz (Z04118593IZKW7SZN71AP)"
}

variable "jwt_signing_key_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for the JWT signing key — the mail server fetches this once at boot to authenticate content_filter calls to the internal API (M7-T4)"
}

variable "api_internal_url" {
  type        = string
  description = "Internal ALB DNS name for the inference API (M7-T4 content_filter target)"
}

variable "ses_smtp_secret_arn" {
  type        = string
  description = "Secrets Manager ARN holding {username, password} for SES SMTP auth (M7-T6 outbound relay) — fetched at boot to build /etc/postfix/sasl_passwd"
}

variable "ses_relay_host" {
  type        = string
  description = "Postfix relayhost for outbound mail, e.g. [email-smtp.us-east-1.amazonaws.com]:587. Required because AWS blocks outbound TCP/25 from EC2, so mail cannot reach recipient MXs directly."
}

variable "scripts_bucket" {
  type        = string
  description = "S3 bucket holding phishing_filter.py. The script is fetched at boot rather than embedded in user_data, which has a hard 16384-byte limit the script no longer fits inside."
}

variable "certbot_email" {
  type        = string
  description = "Contact address Let's Encrypt uses for expiry warnings (M7-T17)"
}
