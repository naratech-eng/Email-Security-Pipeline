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
