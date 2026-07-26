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
