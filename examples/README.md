# Example Implementations

This directory contains working examples of common microservice patterns using the standard templates.

## Available Examples

### Simple REST API
Basic HTTP API with single Lambda function
- GET /health endpoint
- Basic authentication
- CloudWatch logging

### Queue Worker
Asynchronous processing with SQS
- API receives requests
- Worker processes from queue
- DLQ for failed messages

### Event-Driven Service
React to AWS events
- S3 object creation triggers
- DynamoDB stream processing
- SNS/SQS integration

## Using Examples

1. Copy the example folder to your project
2. Update configuration files with your service details
3. Deploy using standard commands

```bash
# Copy example
cp -r examples/simple-api my-new-service/
cd my-new-service/

# Customize
# Edit cdk/config/* files
# Update package.json name

# Deploy
npm install
npm run deploy:dev
```

## Contributing Examples

When adding new examples:
- Include complete working code
- Add README with setup instructions
- Test with fresh AWS account
- Document any special requirements