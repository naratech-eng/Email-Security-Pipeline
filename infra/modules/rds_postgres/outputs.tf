output "endpoint" {
  value = aws_db_instance.this.endpoint
}

# Bare hostname, no ":5432" suffix — aws_db_instance.this.endpoint returns
# "host:port" combined, which broke DB_CREDENTIALS_JSON's "host" field when
# a separate "port" field was appended on top (host ended up "host:5432",
# then the app's connection string became "host:5432:5432"). Use this for
# anything that also needs the port separately, like the secret.
output "address" {
  value = aws_db_instance.this.address
}

output "db_name" {
  value = aws_db_instance.this.db_name
}

output "username" {
  value = aws_db_instance.this.username
}
