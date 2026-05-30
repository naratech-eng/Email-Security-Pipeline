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
