#!/bin/bash

set -e
echo "🔍 Starting Terraform plan process..."

# Load environment variables
load_env_safely() {
    local env_file="${1:-.env}"
    local temp_file=".env.tmp"
    
    if [ ! -f "$env_file" ]; then
        echo "⚠️ $env_file file not found!"
        return 1
    fi
    
    echo "📋 Loading environment variables from $env_file..."
    
    sed 's/\$/\\$/g' "$env_file" > "$temp_file"
    
    while IFS= read -r line || [ -n "$line" ]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        
        if [[ "$line" == *"="* ]]; then
            key="${line%%=*}"
            full_value="${line#*=}"
            
            key="${key// /}"
            
            if [[ "$full_value" =~ ^[[:space:]]*\"(.*)\"[[:space:]]*$ ]]; then
                value="${BASH_REMATCH[1]}"
                value="${value//\\$/\$}"
                
            elif [[ "$full_value" =~ ^[[:space:]]*\'(.*)\'[[:space:]]*$ ]]; then
                value="${BASH_REMATCH[1]}"
                value="${value//\\$/\$}"
                
            else
                value="${full_value}"
                value="${value#"${value%%[![:space:]]*}"}"
                value="${value%"${value##*[![:space:]]}"}"
                value="${value//\\$/\$}"
            fi
            
            export "$key"="$value"
        fi
    done < "$temp_file"
    
    rm -f "$temp_file"
    echo "✅ Environment variables loaded safely"
    
    return 0
}

if ! load_env_safely ".env"; then
    echo "❌ Failed to load environment variables"
    exit 1
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Setup log file
LOG_FILE="terraform-plan-$(date +%Y%m%d-%H%M%S).log"
ERROR_LOG="terraform-errors-$(date +%Y%m%d-%H%M%S).log"

print_status "📝 Logging to: $LOG_FILE"
print_status "❗ Errors will be logged to: $ERROR_LOG"

exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$ERROR_LOG" >&2)

print_status "🔍 Getting AWS account information..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

print_status "AWS Account ID: $AWS_ACCOUNT_ID"
print_status "AWS Region: $AWS_REGION"
print_status "ECR Repository: $ECR_REPO_NAME"
print_status "Lambda Function: $LAMBDA_FUNCTION_NAME"

if [ ! -f "terraform/main.tf" ]; then
    print_error "terraform/main.tf not found. Are you in the correct directory?"
    exit 1
fi

print_status "🔍 Validating Terraform configuration..."
if ! terraform -chdir=terraform validate 2>&1; then
    print_error "Terraform validation failed!"
    exit 1
fi
print_success "Terraform configuration is valid"

print_status "🔍 Initializing Terraform..."
if ! terraform -chdir=terraform init 2>&1; then
    print_error "Terraform initialization failed!"
    exit 1
fi
print_success "Terraform initialized"

print_status "🏗️ Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION >/dev/null 2>&1; then
    print_warning "ECR repository doesn't exist. It will be created on apply."
else
    print_success "ECR repository exists"
fi

print_status "🔍 Checking Lambda function..."
if ! aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION >/dev/null 2>&1; then
    print_warning "Lambda function doesn't exist. It will be created on apply."
else
    print_success "Lambda function exists"
fi

print_status "📦 Installing dependencies with Bun..."
if [ ! -f "package.json" ]; then
    print_error "package.json not found!"
    exit 1
fi

bun install
print_success "Bun dependencies installed"

TIMESTAMP=$(date +%s)
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
IMAGE_TAG="${TIMESTAMP}-${GIT_HASH}"

print_status "🏷️ Image tag: $IMAGE_TAG"

print_status "🐳 Building Docker image..."
if ! docker build -t $ECR_REPO_NAME:latest -t $ECR_REPO_NAME:$IMAGE_TAG . 2>&1; then
    print_error "Docker build failed!"
    exit 1
fi
print_success "Docker image built successfully"

print_status "🏷️ Tagging images for ECR..."
docker tag $ECR_REPO_NAME:latest $ECR_URI:latest
docker tag $ECR_REPO_NAME:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
print_success "Images tagged"

echo ""
print_status "========================================"
print_status "🔍 Running Terraform Plan..."
print_status "========================================"
echo ""

if ! terraform -chdir=terraform plan -out=tfplan 2>&1; then
    print_error "Terraform plan failed! Check $ERROR_LOG for details."
    exit 1
fi

echo ""
print_success "✅ Terraform plan completed successfully!"
echo ""
print_status "📋 Summary:"
print_status "  - Docker image built: $ECR_REPO_NAME:$IMAGE_TAG"
print_status "  - Plan file saved: terraform/tfplan"
print_status "  - Full log: $LOG_FILE"
print_status "  - Error log: $ERROR_LOG"
echo ""
print_status "To apply these changes, run:"
print_status "  cd terraform && terraform apply tfplan"
echo ""
print_warning "Note: This plan only validates infrastructure changes."
print_warning "To deploy the Docker image, run: ./scripts/deploy.sh"
