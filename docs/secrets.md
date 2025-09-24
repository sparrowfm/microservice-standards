# Secrets Management

## Naming Pattern
```
condor/{environment}/{service}-key
```

Examples:
- `condor/dev/google-tts-key`
- `condor/prod/webhook-secret`

## Local Development
```bash
# Use .env for local (never commit)
cp .env.example .env
npm run localstack:start
```

## Create Secret
```bash
aws secretsmanager create-secret \
  --name "condor/prod/google-tts-key" \
  --secret-string "your-api-key"
```

## Lambda Access
```typescript
const secretsManager = new SecretsManager({ region: process.env.AWS_REGION });

const result = await secretsManager.getSecretValue({
  SecretId: 'condor/prod/google-tts-key',
});
const apiKey = result.SecretString;
```

## Troubleshooting
- **Not found**: Check secret name and region
- **Access denied**: Verify Lambda IAM role has `secretsmanager:GetSecretValue`
- **LocalStack**: Ensure container is running with `-p 4566:4566`