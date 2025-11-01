terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "sa-east-1"
}


variable "ENV_FILE_CONTENT" {
  description = "Base64-encoded .env content"
  type        = string
  default     = ""
}

locals {
  env_vars = var.ENV_FILE_CONTENT != "" ? tomap({
    for pair in regexall("([A-Za-z_][A-Za-z0-9_]*)=(.*)", base64decode(var.ENV_FILE_CONTENT)) :
    trim(pair[0], " ") => regex(
      "^(?:[\"']?)(.*?)(?:[\"']?)$",
      trim(pair[1], " ")
    )[0]
  }) : {}
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "gb_server" {
  name          = "gb-server-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token"]
    max_age      = 300
  }
}

resource "aws_s3_bucket_public_access_block" "media_bucket" {
  bucket = aws_s3_bucket.media_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "gb_server" {
  api_id      = aws_apigatewayv2_api.gb_server.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip            = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      integrationLatency = "$context.integrationLatency"
    })
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/gb-server-api"
  retention_in_days = 14
}

# API Gateway Route for POST /posts
resource "aws_apigatewayv2_route" "posts" {
  api_id    = aws_apigatewayv2_api.gb_server.id
  route_key = "POST /posts"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Lambda Integration
resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.gb_server.id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.gb_server.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.gb_server.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.gb_server.execution_arn}/*/*/posts"
}


resource "aws_ecr_repository" "gb_server" {
  name                 = "gb-server"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_lambda_function" "gb_server" {
  function_name = "gb-server"
  role          = aws_iam_role.lambda_exec.arn

  package_type = "Image"
  image_uri    = "${aws_ecr_repository.gb_server.repository_url}:latest"

  timeout     = 900
  memory_size = 1048

  lifecycle { ignore_changes = [image_uri] }

  environment {
    variables = merge(local.env_vars, {
      NODE_ENV = "production"
      TEST_ENV = "true"
    })
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda_logs,
  ]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/gb-server"
  retention_in_days = 14
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "gb-server-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM policy for DynamoDB access
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "gb-server-dynamodb-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = [
          "*"
        ]
      }
    ]
  })
}



output "ecr_repository_url" {
  value = aws_ecr_repository.gb_server.repository_url
}

output "lambda_function_name" {
  value = aws_lambda_function.gb_server.function_name
}

output "api_gateway_url" {
  value = "${aws_apigatewayv2_api.gb_server.api_endpoint}/posts"
}

output "api_gateway_arn" {
  value = aws_apigatewayv2_api.gb_server.arn
}

# S3 bucket for media storage
resource "aws_s3_bucket" "media_bucket" {
  bucket = "gb-media-6pfmll2h"

  tags = {
    Name        = "GB Media Storage"
    Environment = "production"
  }
}

# S3 bucket ACL
resource "aws_s3_bucket_ownership_controls" "media_bucket" {
  bucket = aws_s3_bucket.media_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "media_bucket" {
  depends_on = [aws_s3_bucket_ownership_controls.media_bucket]
  bucket     = aws_s3_bucket.media_bucket.id
  acl        = "private"
}

# S3 bucket CORS configuration
resource "aws_s3_bucket_cors_configuration" "media_bucket" {
  bucket = aws_s3_bucket.media_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"] # In production, restrict to your domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 bucket public access
resource "aws_s3_bucket_policy" "media_bucket_public_read" {
  bucket = aws_s3_bucket.media_bucket.id
  depends_on = [aws_s3_bucket_public_access_block.media_bucket]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowPublicReadAccess",
        Effect   = "Allow",
        Principal = "*",
        Action   = "s3:GetObject",
        Resource = "${aws_s3_bucket.media_bucket.arn}/*"
      }
    ]
  })
}


# IAM policy for Lambda to access S3
resource "aws_iam_role_policy" "lambda_s3" {
  name = "gb-server-s3-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.media_bucket.arn,
          "${aws_s3_bucket.media_bucket.arn}/*"
        ]
      }
    ]
  })
}

# Output the S3 bucket name
output "media_bucket_name" {
  value = aws_s3_bucket.media_bucket.bucket
}

# Output the S3 bucket domain name
output "media_bucket_domain_name" {
  value = aws_s3_bucket.media_bucket.bucket_regional_domain_name
}

