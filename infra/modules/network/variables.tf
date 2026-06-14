variable "project" {
  description = "Short project name used in all resource names"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "ssh_allowed_cidrs" {
  description = "List of CIDRs allowed to SSH into the mail server"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict to your IP in production
}

variable "enable_nat_gateway" {
  description = "Create a NAT gateway (+ Elastic IP) for private-subnet egress. Off by default to avoid the hourly NAT/EIP cost while the project is paused; set true when private workloads need outbound internet."
  type        = bool
  default     = false
}
