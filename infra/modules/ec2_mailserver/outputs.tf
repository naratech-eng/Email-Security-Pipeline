output "instance_id" {
  value = aws_instance.mail.id
}

output "public_ip" {
  value       = aws_eip.mail.public_ip
  description = "Elastic IP — stable across stop/start"
}

output "private_ip" {
  value = aws_instance.mail.private_ip
}

output "ami_used" {
  value = data.aws_ami.rocky9.id
}
