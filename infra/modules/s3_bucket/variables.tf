variable "bucket_name" {
  type = string
}

variable "project" {
  type = string
}

variable "purpose" {
  type    = string
  default = "general"
}

variable "enable_lifecycle" {
  type    = bool
  default = false
}

variable "noncurrent_version_expiration_days" {
  description = "Expire noncurrent (superseded) object versions after this many days. 0 disables the rule."
  type        = number
  default     = 0
}
