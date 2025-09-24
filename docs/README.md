# DevOps Docs

Essential operational guides for Condor TTS.

## Files
- **[deploy.md](deploy.md)** - Deployment commands and rollback
- **[secrets.md](secrets.md)** - AWS Secrets Manager setup
- **[monitoring.md](monitoring.md)** - Logs, debugging, health checks
- **[environments.md](environments.md)** - Dev/staging/prod strategy
- **[api-standards.md](api-standards.md)** - REST and webhook payload standards
- **[airtable-automations.md](airtable-automations.md)** - Airtable Automations best practices for calling Lambdas
- **[infrastructure-standards.md](infrastructure-standards.md)** - Infrastructure patterns and decision frameworks

## Quick Start
```bash
# Local development
npm run localstack:start && npm run deploy:dev

# Production deployment
npm run ci:test && npm run deploy:prod

# Debug failed job
aws logs filter-log-events --log-group-name "/aws/lambda/CondorStack-prod-WorkerLambda" --filter-pattern "JOB_ID"
```