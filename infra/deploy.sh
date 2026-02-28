#!/bin/bash
# Deploy CivicLemma AWS Infrastructure
# Usage: ./deploy.sh [environment]

set -e

ENV=${1:-dev}
STACK_NAME="civiclemma-infra-${ENV}"
REGION=${AWS_REGION:-ap-south-1}

echo "================================================"
echo "Deploying CivicLemma Infrastructure"
echo "  Environment: ${ENV}"
echo "  Region: ${REGION}"
echo "  Stack: ${STACK_NAME}"
echo "================================================"

# Step 1: Deploy CloudFormation stack (S3, CloudFront, Cognito)
echo ""
echo "[1/3] Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file cloudformation.json \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides \
    ProjectName=civiclemma \
    Environment="${ENV}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  --no-fail-on-empty-changeset

# Step 2: Create DynamoDB tables
echo ""
echo "[2/3] Creating DynamoDB tables..."
aws cloudformation deploy \
  --template-file ../dynamodb-tables.json \
  --stack-name "civiclemma-dynamodb-${ENV}" \
  --region "${REGION}" \
  --no-fail-on-empty-changeset

# Step 3: Print outputs
echo ""
echo "[3/3] Getting stack outputs..."
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs" \
  --output table

echo ""
echo "================================================"
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Copy the outputs above to your .env files"
echo "  2. Build and push Docker images"
echo "  3. Deploy services to ECS or EC2"
echo "================================================"
