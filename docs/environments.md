# Environment Strategy

## Configuration Pattern
```
cdk/config/
├── index.ts    # Interface + selector
├── dev.ts      # Development config
├── staging.ts  # Staging config
└── prod.ts     # Production config
```

## Deployment Commands
```bash
npm run deploy:dev      # --context environment=dev
npm run deploy:staging  # --context environment=staging
npm run deploy:prod     # --context environment=prod
```

## Resource Scaling
| Resource | Dev | Staging | Prod |
|----------|-----|---------|------|
| Rate Limit | 100/200 | 500/1000 | 2000/5000 |
| Lambda Memory | 1024MB | 1024MB | 2048MB |
| Concurrency | None | 50 | 200 |
| Log Retention | 7 days | 30 days | 90 days |

## Secret Namespacing
```
service-name/{environment}/{provider}-key
```

## Feature Toggles
```typescript
providers: {
  google: { enabled: true },      // All envs
  elevenlabs: { enabled: false }, // Dev disabled
}
```

## Local Development
```bash
npm run localstack:start  # AWS services in Docker
cp .env.example .env      # Local secrets (never commit)
```

## Replication Checklist
- [ ] Environment-specific config files
- [ ] CDK context-based deployment
- [ ] Progressive resource scaling
- [ ] Secret namespacing pattern
- [ ] LocalStack for local development
- [ ] Feature toggles per environment