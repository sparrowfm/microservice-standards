# Microservice Standards

Reusable templates and patterns for consistent service development across teams.

## 🚀 Quick Start

1. **Copy this entire folder** to your new project location
2. **Choose your service type** and follow the template
3. **Customize** the configs for your specific needs

## 📁 What's Included

### Templates
Ready-to-use configuration files:
- `package.json` - Standard npm scripts and dependencies
- `tsconfig.json` - TypeScript config optimized for AWS Lambda
- `jest.config.js` - Testing setup with 80% coverage threshold
- `docker-compose.yml` - LocalStack for local AWS development

### CDK Patterns
Infrastructure-as-code templates:
- Environment-based configurations (dev/staging/prod)
- Lambda deployment patterns
- Secrets management setup

### GitHub Workflows
CI/CD pipeline templates:
- Testing and linting
- Environment-specific deployments
- Documentation validation

### Scripts
Reusable build and deployment helpers:
- Lambda packaging with dependencies
- Health check scripts
- Environment setup utilities

## 📋 Service Types

Choose the pattern that matches your service:

### REST API with Queue Processing
**Use case**: HTTP API that processes requests asynchronously
```bash
# Start with these templates:
cp templates/* your-project/
cp cdk-patterns/* your-project/cdk/
cp github-workflows/* your-project/.github/workflows/
```

### Event-Driven Service
**Use case**: React to SQS/SNS events
```bash
# Minimal setup:
cp templates/package.json your-project/
cp cdk-patterns/config/* your-project/cdk/config/
```

## 🔧 Customization Checklist

- [ ] Update `package.json` name and dependencies
- [ ] Configure environment-specific settings in `cdk/config/`
- [ ] Set up secrets in AWS Secrets Manager
- [ ] Update GitHub Actions environment variables
- [ ] Customize monitoring and alerting thresholds

## 📚 Documentation

- **[Environment Strategy](docs/environments.md)** - Dev/staging/prod patterns
- **[Secrets Management](docs/secrets.md)** - AWS Secrets Manager setup
- **[Deployment Guide](docs/deployment.md)** - CDK deployment workflows
- **[Monitoring](docs/monitoring.md)** - CloudWatch and debugging

## 💡 Reference Implementation

See the [Condor TTS project](https://github.com/yourorg/condor) for a complete working example of these patterns in action.

## 🤝 Contributing

Found a better pattern? Submit a PR with:
- Updated template files
- Documentation changes
- Real-world usage examples