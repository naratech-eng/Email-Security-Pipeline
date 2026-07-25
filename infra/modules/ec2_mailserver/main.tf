###############################################################################
# Module: ec2_mailserver
# Rocky Linux 9 on EC2 — Postfix + Dovecot via cloud-init
# Route53 A record for mail.naratech.xyz managed here
###############################################################################

# Rendered once here so the size guard below and the instance both use exactly
# the same bytes. EC2 caps user_data at 16384; because the value handed to
# aws_instance.user_data is already base64, that cap applies to the *encoded*
# string, leaving roughly 12.3 KB of actual YAML. Exceeding it aborts the whole
# apply with a message that names no resource, so the precondition below turns
# it into a clear plan-time failure instead.
locals {
  mail_user_data = base64encode(templatefile("${path.module}/cloud-init.yml", {
    mail_domain                = var.mail_domain
    mail_hostname              = var.mail_hostname
    jwt_signing_key_secret_arn = var.jwt_signing_key_secret_arn
    api_internal_url           = var.api_internal_url
    ses_smtp_secret_arn        = var.ses_smtp_secret_arn
    ses_relay_host             = var.ses_relay_host
  }))
}

data "aws_ami" "rocky9" {
  most_recent = true
  owners      = ["679593333241"] # Rocky Linux official AWS account

  filter {
    name   = "name"
    values = ["Rocky-9-EC2-Base-9.*x86_64*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM instance profile for SSM Session Manager (no SSH key needed for remote commands)
resource "aws_iam_role" "ssm" {
  name = "${var.project}-mail-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Read-only access to exactly the two secrets this instance needs and no
# others: the JWT signing key, for authenticating content_filter calls to the
# internal inference API (M7-T4), and the SES SMTP credentials for the outbound
# relay (M7-T6). Both are fetched once at boot.
resource "aws_iam_role_policy" "secrets_read" {
  name = "mail-server-secrets-read"
  role = aws_iam_role.ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        var.jwt_signing_key_secret_arn,
        var.ses_smtp_secret_arn,
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.project}-mail-ssm-profile"
  role = aws_iam_role.ssm.name
}

# EC2 instance — auto-assigned public IP (no EIP)
resource "aws_instance" "mail" {
  #checkov:skip=CKV_AWS_88: Mail server requires a public IP to receive SMTP and present an MX endpoint
  #checkov:skip=CKV_AWS_126: Detailed (1-min) monitoring adds CloudWatch cost; default 5-min metrics suffice for the lab
  ami                         = data.aws_ami.rocky9.id
  instance_type               = var.instance_type
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [var.sg_mail_id]
  key_name                    = var.key_name
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ssm.name
  ebs_optimized               = true # CKV_AWS_135

  # Require IMDSv2 (token-based metadata access) — CKV_AWS_79
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = local.mail_user_data
  # Cloud-init only runs on first boot — without this, editing cloud-init.yml
  # later would silently update the stored user_data but never actually run
  # on the live instance. Force a clean replace when the rendered content
  # actually changes (i.e. only on real cloud-init edits, not on unrelated
  # applies elsewhere in the stack).
  user_data_replace_on_change = true

  lifecycle {
    precondition {
      condition     = length(local.mail_user_data) <= 16384
      error_message = "Rendered cloud-init user_data is ${length(local.mail_user_data)} bytes base64-encoded, over EC2's 16384 limit. Trim cloud-init.yml, or move large embedded files (phishing_filter.py) to S3 and fetch them at boot."
    }
  }

  tags = {
    Name    = "${var.project}-mail-server"
    Project = var.project
    OS      = "Rocky Linux 9"
    Role    = "mail-server"
  }
}

# Route53 A record: mail.naratech.xyz → EC2 public IP
# Note: IP changes on stop/start — run terraform apply again to update
resource "aws_route53_record" "mail_a" {
  zone_id = var.mail_zone_id
  name    = var.mail_hostname
  type    = "A"
  ttl     = 300
  records = [aws_instance.mail.public_ip]
}

# M7-T6 — self-referencing MX so external mail (Gmail, etc.) can actually
# route to this server for addresses like testuser1@mail.naratech.xyz.
# Deliberately scoped to the mail. subdomain, not the naratech.xyz apex —
# that domain's MX already points at real email forwarding and isn't touched.
resource "aws_route53_record" "mail_mx" {
  zone_id = var.mail_zone_id
  name    = var.mail_hostname
  type    = "MX"
  ttl     = 300
  records = ["10 ${var.mail_hostname}"]
}
