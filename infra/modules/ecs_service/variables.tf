variable "project" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "sg_ecs_id" {
  type = string
}

variable "public_tg_arn" {
  type = string
}

variable "internal_tg_arn" {
  type = string
}

variable "model_bucket_name" {
  type = string
}

variable "container_image" {
  type    = string
  default = "public.ecr.aws/nginx/nginx:latest"
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 1
}
