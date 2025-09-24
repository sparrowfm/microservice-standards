#!/bin/bash

# Set up LocalStack environment for local development
set -e

echo "🐳 Setting up LocalStack for local development..."

# Start LocalStack
docker compose up -d localstack

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to start..."
sleep 30

# Check if LocalStack is running
if ! curl -s http://localhost:4566/health > /dev/null; then
    echo "❌ LocalStack is not responding"
    exit 1
fi

echo "✅ LocalStack is running"

# Create AWS resources for local development
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

echo "📦 Creating local AWS resources..."

# Create S3 bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://your-service-dev

# Create DynamoDB table
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name your-service-dev \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

# Create SQS queue
aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name your-service-queue-dev

# Create secrets
aws --endpoint-url=http://localhost:4566 secretsmanager create-secret \
    --name "your-service/dev/example-key" \
    --secret-string "fake-api-key-for-local"

aws --endpoint-url=http://localhost:4566 secretsmanager create-secret \
    --name "your-service/dev/webhook-secret" \
    --secret-string "local-webhook-secret"

echo "🎉 LocalStack setup complete!"
echo "💡 You can now run: npm run deploy:dev"