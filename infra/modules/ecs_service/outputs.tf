output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "service_name" {
  value = aws_ecs_service.api.name
}

output "task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}
