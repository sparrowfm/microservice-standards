# Monitoring & Troubleshooting

## Log Groups
```
/aws/lambda/CondorStack-{env}-IngestLambda
/aws/lambda/CondorStack-{env}-WorkerLambda
/aws/apigateway/CondorStack-{env}
```

## Debug Failed Job
```bash
# 1. Check DynamoDB
aws dynamodb get-item \
  --table-name condor-jobs-prod \
  --key '{"job_id":{"S":"tts_01XXXXX"}}'

# 2. Check Lambda logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/CondorStack-prod-WorkerLambda" \
  --filter-pattern "tts_01XXXXX"

# 3. Check SQS queue
aws sqs get-queue-attributes \
  --queue-url "QUEUE_URL" \
  --attribute-names All
```

## Common Issues

### Rate Limiting (HTTP 429)
Increase limits in environment config:
```typescript
api: { throttle: { rateLimit: 5000, burstLimit: 10000 } }
```

### Lambda Timeout
```typescript
lambdas: { timeout: 600, memorySize: 3008 }
```

### Memory Issues
Check CloudWatch MemoryUtilization metric, increase `memorySize`

## Health Check
```bash
#!/bin/bash
curl -X POST "https://api.condor.com/v1/tts/jobs" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"text":"test","voice":"en-US-Neural2-A"}'
```

## CloudWatch Queries
```sql
-- Find errors
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc

-- Response times
fields @timestamp, @duration
| filter @type = "REPORT"
| stats avg(@duration) by bin(5m)
```