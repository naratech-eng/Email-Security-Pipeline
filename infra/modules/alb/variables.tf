variable "project" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "sg_alb_public_id" {
  type = string
}

variable "sg_alb_internal_id" {
  type = string
}

variable "esp_api_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for esp-api.naratech.xyz (Z04132153JT7YAXT7E8D)"
}
