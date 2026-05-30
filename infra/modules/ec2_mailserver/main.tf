###############################################################################
# Module: ec2_mailserver
# Rocky Linux 9 on EC2 — Postfix + Dovecot via cloud-init
# Route53 A record for mail.naratech.xyz managed here
###############################################################################

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

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.project}-mail-ssm-profile"
  role = aws_iam_role.ssm.name
}

# EC2 instance — auto-assigned public IP (no EIP)
resource "aws_instance" "mail" {
  ami                         = data.aws_ami.rocky9.id
  instance_type               = var.instance_type
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [var.sg_mail_id]
  key_name                    = var.key_name
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ssm.name

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = base64encode(templatefile("${path.module}/cloud-init.yml", {
    mail_domain   = var.mail_domain
    mail_hostname = var.mail_hostname
  }))

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
