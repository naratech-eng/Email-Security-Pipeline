###############################################################################
# Module: alb — public + internal ALBs
# ACM cert for esp-api.naratech.xyz auto-validated via Route53
###############################################################################

# --------------------------------------------------------------------------- #
# ACM certificate for esp-api.naratech.xyz
# --------------------------------------------------------------------------- #
resource "aws_acm_certificate" "esp_api" {
  domain_name       = "esp-api.naratech.xyz"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project = var.project
  }
}

resource "aws_route53_record" "esp_api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.esp_api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = var.esp_api_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "esp_api" {
  certificate_arn         = aws_acm_certificate.esp_api.arn
  validation_record_fqdns = [for r in aws_route53_record.esp_api_cert_validation : r.fqdn]
}

# --------------------------------------------------------------------------- #
# Public ALB  (esp.naratech.xyz dashboard → esp-api.naratech.xyz inference API)
# --------------------------------------------------------------------------- #
resource "aws_lb" "public" {
  #checkov:skip=CKV_AWS_150: Deletion protection would block the OPS-T1 destroy/rebuild runbook; off in dev
  #checkov:skip=CKV_AWS_91: Access logging needs an S3 bucket + ELB-account bucket policy; deferred for the lab
  #checkov:skip=CKV2_AWS_28: WAF association is scheduled for M9 (Security & Compliance) per the roadmap
  name                       = "${var.project}-alb-public"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [var.sg_alb_public_id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true # CKV_AWS_131

  tags = {
    Project = var.project
    Type    = "public"
  }
}

resource "aws_lb_target_group" "public" {
  name        = "${var.project}-tg-public"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# HTTP → HTTPS redirect
resource "aws_lb_listener" "public_http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener — uses the validated ACM cert
resource "aws_lb_listener" "public_https" {
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.esp_api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.public.arn
  }

  depends_on = [aws_acm_certificate_validation.esp_api]
}

# Route53 alias A record: esp-api.naratech.xyz → public ALB
resource "aws_route53_record" "esp_api_alb" {
  zone_id = var.esp_api_zone_id
  name    = "esp-api.naratech.xyz"
  type    = "A"

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}

# --------------------------------------------------------------------------- #
# Internal ALB  (mail server content_filter → ECS inference API, VPC only)
# --------------------------------------------------------------------------- #
resource "aws_lb" "internal" {
  #checkov:skip=CKV_AWS_150: Deletion protection would block the OPS-T1 destroy/rebuild runbook; off in dev
  #checkov:skip=CKV_AWS_91: Access logging needs an S3 bucket + policy; deferred for the lab
  #checkov:skip=CKV2_AWS_20: Internal ALB intentionally serves plain HTTP on the VPC-private path; no HTTP→HTTPS redirect required
  name                       = "${var.project}-alb-internal"
  internal                   = true
  load_balancer_type         = "application"
  security_groups            = [var.sg_alb_internal_id]
  subnets                    = var.private_subnet_ids
  drop_invalid_header_fields = true # CKV_AWS_131

  tags = {
    Project = var.project
    Type    = "internal"
  }
}

resource "aws_lb_target_group" "internal" {
  #checkov:skip=CKV_AWS_378: HTTP target protocol is intentional on the VPC-internal path; TLS is terminated at the public ALB
  name        = "${var.project}-tg-internal"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path     = "/health"
    interval = 30
  }
}

resource "aws_lb_listener" "internal_http" {
  #checkov:skip=CKV_AWS_2: Internal ALB serves plain HTTP — it is VPC-private (mail content_filter → ECS), never internet-exposed
  #checkov:skip=CKV_AWS_378: HTTP is intentional on the VPC-internal path; TLS terminated at the public ALB only
  #checkov:skip=CKV2_AWS_20: No HTTP→HTTPS redirect needed on the internal listener (private traffic)
  #checkov:skip=CKV_AWS_103: TLS 1.2 policy N/A — internal listener is HTTP by design
  load_balancer_arn = aws_lb.internal.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.internal.arn
  }
}
