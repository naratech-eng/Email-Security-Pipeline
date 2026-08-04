variable "project" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "sg_rds_id" {
  type = string
}

variable "db_name" {
  type    = string
  default = "espdb"
}

variable "db_username" {
  type    = string
  default = "espuser"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "alerts_topic_arn" {
  type        = string
  description = "SNS topic ARN for the OBS-T1 CPU/connections alarms."
}
