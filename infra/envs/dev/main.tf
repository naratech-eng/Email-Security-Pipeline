###############################################################################
# Dev environment — wires all modules together
###############################################################################

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
  # No profile argument: the provider uses the standard AWS credential chain.
  #   Local: `export AWS_PROFILE=lab-user` before running terraform.
  #   CI:    OIDC temporary credentials injected as env vars by configure-aws-credentials.
}

# --------------------------------------------------------------------------- #
# Network
# --------------------------------------------------------------------------- #
module "network" {
  source  = "../../modules/network"
  project = var.project
}

# --------------------------------------------------------------------------- #
# S3 Buckets
# --------------------------------------------------------------------------- #
module "s3_datasets" {
  source           = "../../modules/s3_bucket"
  project          = var.project
  purpose          = "datasets"
  bucket_name      = "${var.project}-datasets-${var.aws_region}-802531654188"
  enable_lifecycle = true
}

module "s3_models" {
  source                             = "../../modules/s3_bucket"
  project                            = var.project
  purpose                            = "models"
  bucket_name                        = "${var.project}-models-${var.aws_region}-802531654188"
  enable_lifecycle                   = false
  noncurrent_version_expiration_days = 30 # OBS-T3
}

module "s3_logs" {
  source           = "../../modules/s3_bucket"
  project          = var.project
  purpose          = "logs"
  bucket_name      = "${var.project}-logs-${var.aws_region}-802531654188"
  enable_lifecycle = false
}

# Holds phishing_filter.py, which the mail server fetches at boot. Kept out of
# user_data because that has a hard 16384-byte limit the script outgrew.
module "s3_scripts" {
  source           = "../../modules/s3_bucket"
  project          = var.project
  purpose          = "scripts"
  bucket_name      = "${var.project}-scripts-${var.aws_region}-802531654188"
  enable_lifecycle = false
}

# --------------------------------------------------------------------------- #
# ECR
# --------------------------------------------------------------------------- #
module "ecr" {
  source    = "../../modules/ecr"
  project   = var.project
  repo_name = "${var.project}-api"
}

# --------------------------------------------------------------------------- #
# RDS Postgres
# --------------------------------------------------------------------------- #
module "rds" {
  source             = "../../modules/rds_postgres"
  project            = var.project
  private_subnet_ids = module.network.private_subnet_ids
  sg_rds_id          = module.network.sg_rds_id
  db_password        = var.db_password
}

# --------------------------------------------------------------------------- #
# Secrets Manager — app secrets for the FastAPI service (SEC-T3)
# --------------------------------------------------------------------------- #
module "secrets" {
  source      = "../../modules/secrets_manager"
  project     = var.project
  environment = var.environment
  db_username = module.rds.username
  db_password = var.db_password
  db_host     = module.rds.address
  db_name     = module.rds.db_name
}

# --------------------------------------------------------------------------- #
# ALBs + ACM cert for esp-api.naratech.xyz (fully automated via Route53)
# --------------------------------------------------------------------------- #
module "alb" {
  source             = "../../modules/alb"
  project            = var.project
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids
  sg_alb_public_id   = module.network.sg_alb_public_id
  sg_alb_internal_id = module.network.sg_alb_internal_id
  esp_api_zone_id    = var.esp_api_zone_id
}

# --------------------------------------------------------------------------- #
# ACM cert for esp.naratech.xyz (used by Amplify custom domain)
# --------------------------------------------------------------------------- #
resource "aws_acm_certificate" "esp" {
  domain_name       = "esp.naratech.xyz"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project = var.project
    Purpose = "amplify-frontend"
  }
}

resource "aws_route53_record" "esp_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.esp.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = var.esp_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "esp" {
  certificate_arn         = aws_acm_certificate.esp.arn
  validation_record_fqdns = [for r in aws_route53_record.esp_cert_validation : r.fqdn]
}

# --------------------------------------------------------------------------- #
# ECS Fargate
# --------------------------------------------------------------------------- #
module "ecs" {
  source                     = "../../modules/ecs_service"
  project                    = var.project
  aws_region                 = var.aws_region
  environment                = var.environment
  private_subnet_ids         = module.network.private_subnet_ids
  sg_ecs_id                  = module.network.sg_ecs_id
  public_tg_arn              = module.alb.public_tg_arn
  internal_tg_arn            = module.alb.internal_tg_arn
  model_bucket_name          = module.s3_models.bucket_id
  db_credentials_secret_arn  = module.secrets.db_credentials_arn
  jwt_signing_key_secret_arn = module.secrets.jwt_signing_key_arn

  # Target groups aren't usable by an ECS service until a listener has
  # attached them to a load balancer. The TG ARN alone (public_tg_arn /
  # internal_tg_arn above) doesn't carry that dependency, so without this,
  # Terraform can create the ECS service in parallel with — or before — the
  # ALB listeners finish, and AWS rejects it with "target group ... does not
  # have an associated load balancer."
  depends_on = [module.alb]
}

# --------------------------------------------------------------------------- #
# EC2 Mail Server (Rocky Linux 9) + Route53 A record for mail.naratech.xyz
# --------------------------------------------------------------------------- #
module "mail_server" {
  source                     = "../../modules/ec2_mailserver"
  project                    = var.project
  public_subnet_id           = module.network.public_subnet_ids[0]
  sg_mail_id                 = module.network.sg_mail_id
  key_name                   = var.key_name
  mail_domain                = var.mail_domain
  mail_hostname              = var.mail_hostname
  mail_zone_id               = var.mail_zone_id
  jwt_signing_key_secret_arn = module.secrets.jwt_signing_key_arn
  api_internal_url           = module.alb.internal_alb_dns
  ses_smtp_secret_arn        = module.ses_relay.smtp_credentials_secret_arn
  ses_relay_host             = module.ses_relay.relay_host
  scripts_bucket             = module.s3_scripts.bucket_id
  certbot_email              = var.certbot_email
}

# --------------------------------------------------------------------------- #
# SES outbound relay + SPF/DKIM/DMARC (M7-T6)
# --------------------------------------------------------------------------- #
module "ses_relay" {
  source                      = "../../modules/ses_relay"
  project                     = var.project
  mail_hostname               = var.mail_hostname
  mail_zone_id                = var.mail_zone_id
  sandbox_verified_recipients = var.ses_sandbox_verified_recipients
}

# --------------------------------------------------------------------------- #
# S3 — profile avatars (browser upload via Cognito Identity Pool)
# --------------------------------------------------------------------------- #
module "s3_avatars" {
  source      = "../../modules/s3_avatars"
  project     = var.project
  bucket_name = "${var.project}-avatars-${var.aws_region}-802531654188"
}

# --------------------------------------------------------------------------- #
# Cognito
# --------------------------------------------------------------------------- #
module "cognito" {
  source             = "../../modules/cognito"
  project            = var.project
  callback_urls      = var.cognito_callback_urls
  logout_urls        = var.cognito_logout_urls
  avatars_bucket_arn = module.s3_avatars.bucket_arn

  # Send verification/reset emails from the verified mail.naratech.xyz SES
  # identity instead of the throttled COGNITO_DEFAULT sender.
  ses_source_arn = module.ses_relay.identity_arn
  ses_from_email = "no-reply@mail.naratech.xyz"
}

# --------------------------------------------------------------------------- #
# Amplify Hosting — analyst dashboard (frontend/). Auto-builds on merge to
# `dev` (-> esp-dev) and `naratech` (-> esp). Cognito ids flow in from above.
# --------------------------------------------------------------------------- #
module "amplify" {
  source               = "../../modules/amplify"
  project              = var.project
  aws_region           = var.aws_region
  github_access_token  = var.amplify_github_access_token
  api_base_url         = var.dashboard_api_base_url
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id

  # Enables authenticated browser->S3 avatar uploads in the deployed app.
  cognito_identity_pool_id = module.cognito.identity_pool_id
  avatars_bucket           = module.s3_avatars.bucket_id

  # Domains are the delegated subdomain zones, never the naratech.xyz apex —
  # the apex is managed in a different AWS account, which is why esp / esp-api /
  # mail / esp-dev each exist as their own hosted zone here. Amplify resolves
  # each domain to its zone in this account and writes its own DNS records.
  # Those zones are created outside Terraform (see terraform.tfvars).
}

# --------------------------------------------------------------------------- #
# GitHub Actions OIDC
# --------------------------------------------------------------------------- #
module "github_oidc" {
  source      = "../../modules/github_oidc"
  project     = var.project
  environment = var.environment
  github_repo = "naratech-eng/Email-Security-Pipeline"
}

# --------------------------------------------------------------------------- #
# Outputs
# --------------------------------------------------------------------------- #
output "github_ci_role_arn" {
  description = "Set this as the AWS_OIDC_ROLE_ARN secret in GitHub Actions"
  value       = module.github_oidc.role_arn
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "public_alb_dns" {
  value       = module.alb.public_alb_dns
  description = "Aliased to esp-api.naratech.xyz via Route53"
}

output "mail_server_ip" {
  value       = module.mail_server.public_ip
  description = "Auto-assigned — Route53 A record updated on each apply"
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "ecr_repo_url" {
  value = module.ecr.repo_url
}

output "cognito_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "cognito_identity_pool_id" {
  value       = module.cognito.identity_pool_id
  description = "VITE_COGNITO_IDENTITY_POOL_ID for the dashboard."
}

output "avatars_bucket" {
  value       = module.s3_avatars.bucket_id
  description = "VITE_AVATARS_BUCKET for the dashboard."
}

output "amplify_app_id" {
  value       = module.amplify.app_id
  description = "Amplify app id for the dashboard."
}

output "amplify_dev_url" {
  value       = module.amplify.dev_branch_url
  description = "Default Amplify URL for the dev branch (before the custom domain resolves)."
}

output "amplify_prod_url" {
  value       = module.amplify.prod_branch_url
  description = "Default Amplify URL for the naratech (prod) branch."
}

output "amplify_domain_records" {
  value       = module.amplify.amplify_domain_records
  description = "Amplify's cert-verification records. Normally empty/unneeded now that each domain is a Route53 zone in this account — Amplify writes its own records."
}


output "datasets_bucket" {
  value = module.s3_datasets.bucket_id
}

output "models_bucket" {
  value = module.s3_models.bucket_id
}

output "esp_acm_cert_arn" {
  value       = aws_acm_certificate_validation.esp.certificate_arn
  description = "Paste this ARN into Amplify console when setting esp.naratech.xyz custom domain"
}

output "db_credentials_secret_arn" {
  value       = module.secrets.db_credentials_arn
  description = "SEC-T3 — DB credentials, injected into the ECS task at runtime"
}

output "jwt_signing_key_secret_arn" {
  value       = module.secrets.jwt_signing_key_arn
  description = "SEC-T3 — JWT signing key, injected into the ECS task at runtime"
}
