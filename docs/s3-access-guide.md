# S3 Bucket Access Guide

## Overview

This guide documents the S3 bucket setup for the Email Security Pipeline project and how team members can access it for dataset storage and retrieval.

## AWS Resources Created

### S3 Bucket
- **Name**: `email-security-pipeline-datasets`
- **Region**: `us-east-1`
- **Purpose**: Store phishing email datasets, malicious URL datasets, and training data

### IAM Group
- **Name**: `email-security-team`
- **Purpose**: Group for all team members who need S3 access

### IAM Policy
- **Name**: `EmailSecurityS3AccessPolicy`
- **ARN**: `arn:aws:iam::091957636975:policy/EmailSecurityS3AccessPolicy`
- **Permissions**: 
  - `s3:GetObject` - Download files from bucket
  - `s3:PutObject` - Upload files to bucket
  - `s3:DeleteObject` - Delete files from bucket
  - `s3:ListBucket` - List contents of bucket
- **Scope**: Limited to `email-security-pipeline-datasets` bucket only

## Adding Team Members

Each team member needs an individual IAM user. **Do not share credentials.**

### Provisioned Team Access (2026-05-23)

The following project access has been provisioned:

| Member | Role | Email | IAM Access |
|---|---|---|---|
| Sanjeewa Narayana | Infrastructure | sknnarayana-mudiyans@myseneca.ca | Uses AWS account owner credentials (no separate IAM user requested) |
| Isaiah | Project Lead | icampbell8@myseneca.ca | `icampbell8` |
| Klara | Research & Data | khaxhiaj@myseneca.ca | `khaxhiaj` |
| John Graham | Frontend & Security | jgkalluri@myseneca.ca | `jgkalluri` |
| Michael Chea | ML Engineer | mchea3@myseneca.ca | `mchea3` |

All IAM users above are members of the `email-security-team` group and inherit S3 access through `EmailSecurityS3AccessPolicy`.

### Private Key Issuance (Owner Only)

Create access keys per user and share them only in a private channel (never in docs/chat/git):

```bash
aws iam create-access-key --user-name icampbell8
aws iam create-access-key --user-name khaxhiaj
aws iam create-access-key --user-name jgkalluri
aws iam create-access-key --user-name mchea3
```

Store the secret access key in a password manager. AWS will only show it once.

### Step 1: Create IAM User

For each team member, run:

```bash
aws iam create-user --user-name <username>
```

Replace `<username>` with the team member's name or preferred identifier (e.g., `sanjeewa.narayana`, `john.doe`).

### Step 2: Add User to Group

```bash
aws iam add-user-to-group --group-name email-security-team --user-name <username>
```

### Step 3: Create Access Keys

```bash
aws iam create-access-key --user-name <username>
```

**IMPORTANT**: This will output an Access Key ID and Secret Access Key. Save these securely and share them privately with the team member. Do not commit them to git or share in public channels.

### Step 4: Configure AWS CLI

Team members should configure their AWS CLI with the credentials:

```bash
aws configure --profile email-security
```

When prompted:
- AWS Access Key ID: [provide from step 3]
- AWS Secret Access Key: [provide from step 3]
- Default region name: `us-east-1`
- Default output format: `json`

Then use the profile for S3 operations:

```bash
aws s3 ls s3://email-security-pipeline-datasets --profile email-security
aws s3 cp local-file.csv s3://email-security-pipeline-datasets/ --profile email-security
```

## Team Member Quick Start

Each team member should follow these steps to access the S3 bucket:

### 1. Configure AWS CLI (one-time setup)

```bash
aws configure --profile email-security
```

When prompted, enter:
- AWS Access Key ID: your assigned key (see Google Doc)
- AWS Secret Access Key: your assigned secret (see Google Doc)
- Default region name: `us-east-1`
- Default output format: `json`

### 2. Verify access

```bash
aws s3 ls s3://email-security-pipeline-datasets --recursive --profile email-security
```

### 3. Download datasets

```bash
# Download phishing dataset
aws s3 cp s3://email-security-pipeline-datasets/datasets/phishing/phishing_email.csv ./phishing_email.csv --profile email-security

# Download malicious URLs (Kaggle)
aws s3 cp s3://email-security-pipeline-datasets/datasets/urls/malicious_phish.csv ./malicious_phish.csv --profile email-security

# Download URLhaus
aws s3 cp s3://email-security-pipeline-datasets/datasets/urls/urlhaus-latest.csv ./urlhaus-latest.csv --profile email-security
```

### 4. Upload data

```bash
# Upload single file
aws s3 cp local-file.csv s3://email-security-pipeline-datasets/datasets/ --profile email-security

# Upload directory
aws s3 sync ./local-datasets s3://email-security-pipeline-datasets/datasets/ --profile email-security
```

## S3 Operations

## Dataset Links (Milestone 2)

The following datasets are uploaded and available in the bucket:

- `s3://email-security-pipeline-datasets/datasets/phishing/phishing_email.csv`
- `s3://email-security-pipeline-datasets/datasets/urls/malicious_phish.csv`
- `s3://email-security-pipeline-datasets/datasets/urls/urlhaus-latest.csv`

### Sharing Outside AWS Accounts

This bucket normally uses **S3 Block Public Access fully enabled** (recommended). For temporary team sharing, public settings were explicitly relaxed on 2026-05-23.

For sharing that lasts 20+ weeks, use one of these options:

1. **Recommended:** keep IAM-based access (current setup) for the team.
2. **Long-lived external links:** use CloudFront signed URLs/cookies with long expiry.
3. **Public links (not recommended):** requires explicit bucket public-access-block changes by account owner.

> Security warning: Do not disable S3 Block Public Access unless approved by the project owner and documented in the threat model.

### Temporary Direct Public URLs (Enabled 2026-05-23)

The following links are currently public for short-term team sharing:

- https://email-security-pipeline-datasets.s3.amazonaws.com/datasets/phishing/phishing_email.csv
- https://email-security-pipeline-datasets.s3.amazonaws.com/datasets/urls/malicious_phish.csv
- https://email-security-pipeline-datasets.s3.amazonaws.com/datasets/urls/urlhaus-latest.csv

⚠️ **Temporary exposure notice:** After the team downloads and saves local copies, remove public bucket policy access and re-enable S3 Block Public Access.

### Upload Files

```bash
# Upload single file
aws s3 cp phishing_emails.csv s3://email-security-pipeline-datasets/datasets/phishing/ --profile email-security

# Upload directory
aws s3 sync ./local-datasets s3://email-security-pipeline-datasets/datasets/ --profile email-security
```

### Download Files

```bash
# Download single file
aws s3 cp s3://email-security-pipeline-datasets/datasets/phishing/phishing_emails.csv ./local-file.csv --profile email-security

# Download directory
aws s3 sync s3://email-security-pipeline-datasets/datasets/ ./local-datasets --profile email-security
```

### List Contents

```bash
# List all files
aws s3 ls s3://email-security-pipeline-datasets --recursive --profile email-security

# List specific directory
aws s3 ls s3://email-security-pipeline-datasets/datasets/phishing/ --profile email-security
```

### Delete Files

```bash
# Delete single file
aws s3 rm s3://email-security-pipeline-datasets/datasets/phishing/old-file.csv --profile email-security

# Delete directory
aws s3 rm s3://email-security-pipeline-datasets/datasets/phishing/ --recursive --profile email-security
```

## Security Best Practices

1. **Never commit credentials to git**: Access keys should never be in code or documentation
2. **Use AWS profiles**: Configure profiles instead of hardcoding credentials
3. **Rotate keys regularly**: Change access keys periodically (every 90 days recommended)
4. **Enable MFA**: Consider enabling MFA for IAM users for additional security
5. **Least privilege**: The IAM policy only grants access to the specific bucket needed
6. **Audit access**: Use CloudTrail to monitor who accesses the bucket and when

## Bucket Structure

Recommended folder structure for the bucket:

```
email-security-pipeline-datasets/
├── datasets/
│   ├── phishing/
│   │   ├── phishing_emails.csv
│   │   └── phishing_emails_cleaned.csv
│   ├── urls/
│   │   ├── malicious_urls.csv
│   │   └── legitimate_urls.csv
│   └── combined/
│       └── training_data.csv
├── processed/
│   ├── features/
│   └── models/
└── temp/
    └── downloads/
```

## Troubleshooting

### Access Denied Error

If you get "Access Denied" errors:
1. Verify you're using the correct AWS profile
2. Check that your user is in the `email-security-team` group
3. Verify the bucket name is correct: `email-security-pipeline-datasets`

### Invalid Credentials

If credentials don't work:
1. Run `aws configure --profile email-security` to re-enter credentials
2. Contact the project lead to verify your user exists in the group
3. Generate new access keys if old ones expired

### Region Mismatch

Ensure you're using `us-east-1` region:
```bash
aws configure set region us-east-1 --profile email-security
```

## Current Team Members

Team members added to the `email-security-team` group:

| Username | Added By | Date |
|----------|----------|------|
| `icampbell8` | Infrastructure lead | 2026-05-23 |
| `khaxhiaj` | Infrastructure lead | 2026-05-23 |
| `jgkalluri` | Infrastructure lead | 2026-05-23 |
| `mchea3` | Infrastructure lead | 2026-05-23 |

## References

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS IAM Documentation](https://docs.aws.amazon.com/iam/)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
