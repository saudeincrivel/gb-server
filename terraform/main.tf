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
    variables = {
      NODE_ENV = "production"
      TEST_ENV = "true"

      ECR_REPO_NAME        = "gb-server"
      LAMBDA_FUNCTION_NAME = "gb-server"
    }
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

