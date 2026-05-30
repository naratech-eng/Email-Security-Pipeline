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
