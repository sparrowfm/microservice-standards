# Deployment

## Quick Commands
```bash
npm run deploy:dev      # Development
npm run deploy:staging  # Staging
npm run deploy:prod     # Production
```

## Build Process
```bash
./scripts/build-lambdas.sh  # Packages Lambdas with dependencies
npm run build               # TypeScript compilation
```

## Environment Configs
- **Dev**: Minimal resources, 7-day logs, Google TTS only
- **Staging**: Medium resources, 30-day logs, Google + ElevenLabs
- **Prod**: High resources, 90-day logs, all providers

## Rollback
```bash
# Lambda only (fast)
aws lambda update-alias \
  --function-name CondorStack-prod-WorkerLambda \
  --name prod \
  --function-version $PREVIOUS_VERSION

# Full infrastructure
git checkout $PREVIOUS_COMMIT && npm run deploy:prod
```

## Validation
```bash
./scripts/health-check.sh prod  # End-to-end test
npm run validate:openapi        # API schema check
```

## Common Issues
- **Bootstrap missing**: `npm run cdk:prod bootstrap`
- **Package too large**: Optimize dependencies in build script
- **Permission denied**: Check IAM policies for CDK deployment