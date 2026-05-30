###############################################################################
# Module: rds_postgres — single-AZ dev Postgres, encrypted
###############################################################################

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-rds-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = { Project = var.project }
}

resource "aws_db_instance" "this" {
  identifier             = "${var.project}-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.instance_class
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.sg_rds_id]

  multi_az               = false   # single-AZ for dev
  publicly_accessible    = false
  skip_final_snapshot    = true    # set to false before prod demo
  deletion_protection    = false

  backup_retention_period = 1          # free-tier max is 1; set to 7 on paid account
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  tags = { Project = var.project }
}
