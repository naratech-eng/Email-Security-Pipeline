variable "project" {
  type = string
}

variable "alert_email" {
  type        = string
  default     = ""
  description = "If set, subscribed to the alerts topic (must be confirmed manually via the email SNS sends)."
}
