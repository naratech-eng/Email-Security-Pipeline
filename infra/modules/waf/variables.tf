variable "project" {
  type = string
}

variable "alb_arn" {
  type        = string
  description = "ARN of the public ALB to associate the Web ACL with."
}

variable "alerts_topic_arn" {
  type = string
}

variable "block_mode" {
  type        = bool
  default     = false
  description = "false = COUNT only (observe without rejecting real traffic); true = actually block. Flip once a baseline run shows no false positives."
}
