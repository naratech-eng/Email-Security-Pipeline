variable "project" {
  type = string
}

variable "alerts_topic_arn" {
  type = string
}

variable "enable_guardduty" {
  type        = bool
  default     = true
  description = "Set false if this AWS account rejects CreateDetector with SubscriptionRequiredException (seen on some training/sandbox account types) -- CloudTrail/Config/WAF/alarms don't depend on this and apply independently either way."
}

variable "enable_security_hub" {
  type        = bool
  default     = true
  description = "Set false if this AWS account rejects EnableSecurityHub with SubscriptionRequiredException (seen on some training/sandbox account types) -- CloudTrail/Config/WAF/alarms don't depend on this and apply independently either way."
}
