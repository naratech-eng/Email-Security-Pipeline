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
