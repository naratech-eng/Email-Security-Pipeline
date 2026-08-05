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

variable "db_credentials_secret_arn" {
  type = string
}

variable "jwt_signing_key_secret_arn" {
  type = string
}

variable "cognito_user_pool_id" {
  type        = string
  default     = ""
  description = "Cognito user pool id — API validates dashboard access tokens against its JWKS + assigns groups."
}

variable "cognito_user_pool_arn" {
  type        = string
  default     = ""
  description = "Cognito user pool ARN — scopes the task role's admin (claim-role) permissions."
}

variable "cognito_app_client_id" {
  type        = string
  default     = ""
  description = "Cognito app client id — optional client_id check on incoming access tokens."
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins allowed to call the API from a browser."
  default = [
    "http://localhost:3000",
    "https://esp.naratech.xyz",
    "https://esp-dev.naratech.xyz",
  ]
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

variable "retention_days" {
  type        = number
  default     = 180
  description = "M9-T7 — detections older than this are purged by the scheduled retention task. See docs/data-retention-privacy.md."
}
