output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "sg_alb_public_id" {
  value = aws_security_group.alb_public.id
}

output "sg_alb_internal_id" {
  value = aws_security_group.alb_internal.id
}

output "sg_ecs_id" {
  value = aws_security_group.ecs.id
}

output "sg_rds_id" {
  value = aws_security_group.rds.id
}

output "sg_mail_id" {
  value = aws_security_group.mail.id
}
