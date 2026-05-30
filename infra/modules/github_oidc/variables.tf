variable "project" {
  type        = string
  description = "Short project slug used in resource names"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod)"
}

variable "github_repo" {
  type        = string
  description = "GitHub repo in owner/repo format, e.g. naratech-eng/Email-Security-Pipeline"
}
