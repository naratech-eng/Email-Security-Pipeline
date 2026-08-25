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
    scripts_bucket             = var.scripts_bucket
    certbot_email              = var.certbot_email
  }))
}

# Uploaded by Terraform so the instance can fetch these at boot. Both grew too
# large to embed in user_data (phishing_filter.py first, then the M7-T17
# certbot logic on top of it) -- source_hash ties each object to its file's
# content, so editing either re-uploads it without forcing an instance replacement.
locals {
  scripts = {
    "phishing_filter.py"  = { path = "files/phishing_filter.py", content_type = "text/x-python" }
    "setup-certbot.sh"    = { path = "files/setup-certbot.sh", content_type = "text/x-shellscript" }
    "setup-mail-auth.sh"  = { path = "files/setup-mail-auth.sh", content_type = "text/x-shellscript" }
    "esp-filter-write.te" = { path = "files/esp-filter-write.te", content_type = "text/plain" }
  }
}

resource "aws_s3_object" "scripts" {
  for_each = local.scripts

  bucket = var.scripts_bucket
  key    = each.key
  source = "${path.module}/${each.value.path}"
  # source_hash, not etag: this bucket's default encryption is SSE-KMS, and for
  # a KMS-encrypted object S3's ETag is not the MD5 of the plaintext. Comparing
  # it against filemd5() therefore never matches, so every plan reported these
  # objects as changed and every apply re-uploaded them -- "no changes" was
  # unreachable, which quietly devalues drift detection as a signal.
  # source_hash is the provider's supported way to track content under KMS.
  source_hash  = filemd5("${path.module}/${each.value.path}")
  content_type = each.value.content_type
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

# Read-only on the specific script objects the instance fetches at boot, not
# the whole bucket. KMS decrypt is required because the bucket is SSE-KMS with
# the AWS-managed aws/s3 key -- s3:GetObject alone returns AccessDenied there.
resource "aws_iam_role_policy" "scripts_read" {
  name = "mail-server-scripts-read"
  role = aws_iam_role.ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = [for k in keys(local.scripts) : "arn:aws:s3:::${var.scripts_bucket}/${k}"]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "s3.us-east-1.amazonaws.com"
          }
        }
      },
    ]
  })
}

# M7-T17 — certbot's DNS-01 challenge writes a _acme-challenge TXT record into
# the mail zone and polls for propagation. Scoped to that one hosted zone;
# ListHostedZones and GetChange are account-level calls the plugin needs to
# resolve the zone and wait for the change to land, and cannot be narrowed.
resource "aws_iam_role_policy" "certbot_dns" {
  name = "mail-server-certbot-dns01"
  role = aws_iam_role.ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = ["arn:aws:route53:::hostedzone/${var.mail_zone_id}"]
      },
      {
        Effect   = "Allow"
        Action   = ["route53:GetChange"]
        Resource = ["arn:aws:route53:::change/*"]
      },
      {
        # ListHostedZones is an account-level call with no resource ARN at all,
        # so "*" is the only valid value -- it is also read-only and returns
        # zone names, which the plugin needs to map the domain to a zone.
        #checkov:skip=CKV_AWS_355: route53:ListHostedZones does not support resource-level permissions
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.project}-mail-ssm-profile"
  role = aws_iam_role.ssm.name
}

# EC2 instance — public IP comes from the Elastic IP below, not the
# auto-assigned one (which changes on every stop/start).
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

  # cloud-init fetches the filter script from S3 and certbot calls Route53
  # during boot. Terraform infers no ordering from user_data being a string,
  # so without these it may create the instance in parallel with the object
  # and the policies -- the instance would then boot into a failed fetch or an
  # AccessDenied on the ACME challenge.
  depends_on = [
    aws_s3_object.scripts,
    aws_iam_role_policy.scripts_read,
    aws_iam_role_policy.secrets_read,
    aws_iam_role_policy.certbot_dns,
  ]

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

# Elastic IP so the address survives stop/start. Without this the instance got
# a fresh auto-assigned IP on every restart, which silently broke inbound mail:
# the MX points at mail.naratech.xyz, whose A record still held the old address,
# and it also left the SPF "a mx" mechanisms authorising an IP AWS had already
# handed to someone else.
resource "aws_eip" "mail" {
  instance = aws_instance.mail.id
  domain   = "vpc"

  tags = {
    Name = "${var.project}-mail-server"
  }
}

# Route53 A record: mail.naratech.xyz → the Elastic IP (stable across restarts).
resource "aws_route53_record" "mail_a" {
  zone_id = var.mail_zone_id
  name    = var.mail_hostname
  type    = "A"
  ttl     = 300
  records = [aws_eip.mail.public_ip]
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
