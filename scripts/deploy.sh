#!/bin/bash

set -e
echo "🚀 Starting deployment process..."

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

print_status "🔍 Getting AWS account information..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.sa-east-1.amazonaws.com/${ECR_REPO_NAME}"

if [ ! -f "terraform/main.tf" ]; then
    print_error "terraform/main.tf not found. Are you in the correct directory?"
    exit 1
fi

print_status "🏗️ Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region sa-east-1 >/dev/null 2>&1; then
    print_warning "ECR repository doesn't exist. Creating with Terraform..."
    terraform -chdir=terraform apply -target=aws_ecr_repository.gb_server \
        -auto-approve
    print_success "ECR repository created"
else
    print_success "ECR repository exists"
fi

print_status "🔍 Checking Lambda function..."
if ! aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region sa-east-1 >/dev/null 2>&1; then
    print_warning "Lambda function doesn't exist. Building and pushing image first..."
    
    print_status "Installing dependencies with Bun..."
    bun install
    print_success "Bun dependencies installed"
    
    print_status "🔐 Authenticating Docker to ECR..."
    aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin $ECR_URI
    print_success "Docker authenticated"
    
    print_status "🐳 Building Docker image..."
    docker build -t $ECR_REPO_NAME:latest .
    print_success "Docker image built"
    
    print_status "🏷️ Tagging image for ECR..."
    docker tag $ECR_REPO_NAME:latest $ECR_URI:latest
    print_success "Image tagged"
    
    print_status "📤 Pushing image to ECR..."
    docker push $ECR_URI:latest
    print_success "Initial image pushed to ECR"
    
    print_warning "Creating infrastructure with Terraform..."
    terraform -chdir=terraform apply \
        -auto-approve
    print_success "Infrastructure created"
    
    SKIP_IMAGE_BUILD=true
else
    print_success "Lambda function exists"
    SKIP_IMAGE_BUILD=false
fi

print_status "🔍 Getting ECR repository URL..."
ECR_URI=$(terraform -chdir=terraform output -raw ecr_repository_url 2>/dev/null || echo "${AWS_ACCOUNT_ID}.dkr.ecr.sa-east-1.amazonaws.com/${ECR_REPO_NAME}")
echo "ECR URI: $ECR_URI"

if [ "$SKIP_IMAGE_BUILD" != true ]; then
    print_status "📦 Installing dependencies with Bun..."
    if [ ! -f "package.json" ]; then
        print_error "package.json not found!"
        exit 1
    fi

    bun install
    print_success "Bun dependencies installed"
fi

TIMESTAMP=$(date +%s)
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
IMAGE_TAG="${TIMESTAMP}-${GIT_HASH}"

print_status "🏷️ Image tag: $IMAGE_TAG"

if [ "$SKIP_IMAGE_BUILD" = true ]; then
    print_success "🎉 Initial deployment completed successfully!"
    print_status "✨ Your Lambda function has been created with your custom image"
    
    echo ""
    print_status "📊 Lambda function info:"
    LAMBDA_INFO=$(aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region sa-east-1 --query 'Configuration.[FunctionName,LastModified,CodeSize,MemorySize,Timeout]' --output table)
    echo "$LAMBDA_INFO"
    
    echo ""
    print_success "🚀 Your GB Server is deployed and ready!"
    print_status "📊 Monitor: CloudWatch logs at /aws/lambda/$LAMBDA_FUNCTION_NAME"
    exit 0
fi

print_status "🔍 Checking if image already exists in ECR..."
if aws ecr describe-images --repository-name $ECR_REPO_NAME --image-ids imageTag=latest --region sa-east-1 >/dev/null 2>&1; then
    print_success "Latest image exists in ECR"
    
    CURRENT_DIGEST=$(aws ecr describe-images --repository-name $ECR_REPO_NAME --image-ids imageTag=latest --region sa-east-1 --query 'imageDetails[0].imageDigest' --output text)
    print_status "Current image digest: $CURRENT_DIGEST"
else
    print_warning "No latest image found in ECR"
    CURRENT_DIGEST=""
fi

print_status "🔐 Authenticating Docker to ECR..."
aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin $ECR_URI
print_success "Docker authenticated"

print_status "🐳 Building Docker image..."
docker build -t $ECR_REPO_NAME:latest -t $ECR_REPO_NAME:$IMAGE_TAG .
print_success "Docker image built"

print_status "🏷️ Tagging images for ECR..."
docker tag $ECR_REPO_NAME:latest $ECR_URI:latest
docker tag $ECR_REPO_NAME:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
print_success "Images tagged"

SHOULD_PUSH=true

if [ -n "$CURRENT_DIGEST" ]; then
    LOCAL_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $ECR_URI:latest 2>/dev/null | cut -d'@' -f2 || echo "")
    
    if [ "$LOCAL_DIGEST" = "$CURRENT_DIGEST" ]; then
        print_success "Image is up to date, skipping push"
        SHOULD_PUSH=false
    else
        print_warning "Image has changed, will push new version"
    fi
fi

if [ "$SHOULD_PUSH" = true ]; then
    print_status "📤 Pushing images to ECR..."
    
    docker push $ECR_URI:latest
    docker push $ECR_URI:$IMAGE_TAG
    
    print_success "Images pushed to ECR"
    

    print_status "🔄 Updating Lambda function..."
    aws lambda update-function-code \
        --function-name $LAMBDA_FUNCTION_NAME \
        --image-uri $ECR_URI:latest \
        --region sa-east-1 > /dev/null
    
    print_status "⏳ Waiting for Lambda function to be updated..."
    aws lambda wait function-updated --function-name $LAMBDA_FUNCTION_NAME --region sa-east-1
    
    print_success "Lambda function updated"
    
    print_status "🔄 Updating Lambda environment variables..."
    export TF_VAR_ENV_FILE_CONTENT=$(cat .env | base64)
  
    terraform -chdir=terraform apply \
        -target=aws_lambda_function.gb_server \
        -auto-approve

    print_success "Lambda environment variables updated"
else
    print_success "Lambda function already up to date"
fi

print_status "🧹 Cleaning up old local Docker images..."
docker system prune -f >/dev/null 2>&1 || true

echo ""
print_success "🎉 Deployment completed successfully!"
echo ""
print_status "📊 Final status:"

LAMBDA_INFO=$(aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region sa-east-1 --query 'Configuration.[FunctionName,LastModified,CodeSize,MemorySize,Timeout]' --output table)
echo "$LAMBDA_INFO"

ECR_IMAGES=$(aws ecr describe-images --repository-name $ECR_REPO_NAME --region sa-east-1 --query 'sort_by(imageDetails,&imagePushedAt)[-3:].{Tag:imageTags[0],Size:imageSizeInBytes,Pushed:imagePushedAt}' --output table 2>/dev/null || echo "No images found")
echo ""
print_status "📦 Recent ECR images:"
echo "$ECR_IMAGES"

echo ""
print_success "🚀 Your GB Server is deployed and ready!"
print_status "📊 Monitor: CloudWatch logs at /aws/lambda/$LAMBDA_FUNCTION_NAME"