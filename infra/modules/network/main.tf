###############################################################################
# Module: network
# Creates VPC, public + private subnets across 2 AZs, NAT gateway, route tables,
# and baseline security groups.
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# --------------------------------------------------------------------------- #
# VPC
# --------------------------------------------------------------------------- #
resource "aws_vpc" "main" {
  #checkov:skip=CKV2_AWS_11: VPC flow logs add CloudWatch ingestion cost; deferred for the budget lab account (enable in prod)
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name    = "${var.project}-vpc"
    Project = var.project
  }
}

# Lock down the VPC's default security group — deny all traffic (CKV2_AWS_12)
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # no ingress, no egress rules = deny all
  tags = {
    Name    = "${var.project}-sg-default-locked"
    Project = var.project
  }
}

# --------------------------------------------------------------------------- #
# Subnets — 2 AZs
# --------------------------------------------------------------------------- #
resource "aws_subnet" "public" {
  #checkov:skip=CKV_AWS_130: Public subnets must auto-assign public IPs for the internet-facing ALB and mail server
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.project}-public-${count.index + 1}"
    Project = var.project
    Tier    = "public"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name    = "${var.project}-private-${count.index + 1}"
    Project = var.project
    Tier    = "private"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# --------------------------------------------------------------------------- #
# Internet Gateway
# --------------------------------------------------------------------------- #
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name    = "${var.project}-igw"
    Project = var.project
  }
}

# --------------------------------------------------------------------------- #
# NAT Gateway (single, in first public subnet — dev cost saving)
# Disabled by default (var.enable_nat_gateway = false) so the hourly NAT + EIP
# charge can't silently return on a re-apply while the project is paused.
# Private subnets have no internet egress when this is off; re-enable (or add
# VPC endpoints) when private workloads need outbound access.
# --------------------------------------------------------------------------- #
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"
  tags = {
    Name    = "${var.project}-nat-eip"
    Project = var.project
  }
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name    = "${var.project}-nat"
    Project = var.project
  }
}

# --------------------------------------------------------------------------- #
# Route Tables
# --------------------------------------------------------------------------- #
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name    = "${var.project}-rt-public"
    Project = var.project
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # Default route only exists when the NAT gateway is enabled. With NAT off the
  # private subnets stay fully private (no 0.0.0.0/0 egress) and cost nothing.
  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[0].id
    }
  }

  tags = {
    Name    = "${var.project}-rt-private"
    Project = var.project
  }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# --------------------------------------------------------------------------- #
# VPC Endpoints — private-subnet access to AWS services without a NAT gateway.
# Fargate tasks in the private subnets need Secrets Manager (env var secrets),
# ECR (image pull), and CloudWatch Logs (awslogs driver); S3 gateway endpoint
# covers model artifact downloads. Single-AZ interface endpoints (first
# private subnet only) mirrors the existing single-AZ NAT gateway's dev-cost
# tradeoff above — not HA, fine for a lab environment.
# --------------------------------------------------------------------------- #
resource "aws_security_group" "vpc_endpoints" {
  #checkov:skip=CKV_AWS_382: No egress needed — endpoint ENIs only receive from in-VPC clients, they don't initiate outbound traffic
  name        = "${var.project}-sg-vpc-endpoints"
  description = "Interface VPC endpoints: allow HTTPS from within the VPC"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC (ECS tasks, etc.)"
  }

  tags = { Name = "${var.project}-sg-vpc-endpoints", Project = var.project }
}

locals {
  interface_endpoint_services = var.enable_vpc_endpoints ? toset([
    "secretsmanager",
    "ecr.api",
    "ecr.dkr",
    "logs",
  ]) : toset([])
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = local.interface_endpoint_services
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private[0].id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = { Name = "${var.project}-vpce-${each.value}", Project = var.project }
}

resource "aws_vpc_endpoint" "s3" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = { Name = "${var.project}-vpce-s3", Project = var.project }
}

data "aws_region" "current" {}

# --------------------------------------------------------------------------- #
# Security Groups
# --------------------------------------------------------------------------- #

# ALB — public-facing HTTPS only
resource "aws_security_group" "alb_public" {
  #checkov:skip=CKV_AWS_382: Open egress needed for ALB→ECS health checks and AWS API calls in lab
  #checkov:skip=CKV2_AWS_5: SG is attached to the public ALB via var ref in the alb module; Checkov cannot trace the cross-module reference
  #checkov:skip=CKV_AWS_260: Port 80 from 0.0.0.0/0 is intentional — it only serves the HTTP→HTTPS 301 redirect
  name        = "${var.project}-sg-alb-public"
  description = "Public ALB: allow HTTPS in, all out"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP redirect"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (package updates, AWS API calls)"
  }

  tags = { Name = "${var.project}-sg-alb-public", Project = var.project }
}

# ALB — internal (milter → inference)
resource "aws_security_group" "alb_internal" {
  #checkov:skip=CKV_AWS_382: Open egress needed for internal ALB→ECS in lab
  #checkov:skip=CKV2_AWS_5: SG attached to the internal ALB via var ref in the alb module (cross-module, untraceable by Checkov)
  name        = "${var.project}-sg-alb-internal"
  description = "Internal ALB: allow HTTPS from VPC"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (package updates, AWS API calls)"
  }

  tags = { Name = "${var.project}-sg-alb-internal", Project = var.project }
}

# ECS Fargate tasks
resource "aws_security_group" "ecs" {
  #checkov:skip=CKV_AWS_382: Fargate tasks need open egress to pull images (ECR) and reach Secrets Manager/S3
  #checkov:skip=CKV2_AWS_5: SG attached to the ECS service via var ref in the ecs_service module
  name        = "${var.project}-sg-ecs"
  description = "ECS Fargate: allow from ALBs only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_public.id, aws_security_group.alb_internal.id]
    description     = "FastAPI port from ALBs"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (package updates, AWS API calls)"
  }

  tags = { Name = "${var.project}-sg-ecs", Project = var.project }
}

# RDS — only from ECS
resource "aws_security_group" "rds" {
  #checkov:skip=CKV_AWS_382: RDS egress is unused in practice but left open to avoid blocking maintenance traffic in lab
  #checkov:skip=CKV2_AWS_5: SG attached to the RDS instance via var ref in the rds_postgres module
  name        = "${var.project}-sg-rds"
  description = "RDS: allow Postgres only from ECS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "Postgres from ECS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (package updates, AWS API calls)"
  }

  tags = { Name = "${var.project}-sg-rds", Project = var.project }
}

# EC2 Mail Server
resource "aws_security_group" "mail" {
  #checkov:skip=CKV_AWS_382: Mail server needs open egress to deliver SMTP and pull OS packages
  #checkov:skip=CKV2_AWS_5: SG attached to the EC2 mail instance via var ref in the ec2_mailserver module
  #checkov:skip=CKV_AWS_24: Port 22 ingress is scoped by var.ssh_allowed_cidrs; tighten that var in tfvars for prod
  name        = "${var.project}-sg-mail"
  description = "Rocky Linux mail server: SMTP + SSH"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 25
    to_port     = 25
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SMTP inbound"
  }

  # M7-T6 — IMAP/IMAPS so an email client (not just swaks) can connect and
  # read mail delivered by Dovecot.
  ingress {
    from_port   = 143
    to_port     = 143
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "IMAP inbound"
  }

  ingress {
    from_port   = 993
    to_port     = 993
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "IMAPS inbound"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
    description = "SSH management"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (package updates, AWS API calls)"
  }

  tags = { Name = "${var.project}-sg-mail", Project = var.project }
}
