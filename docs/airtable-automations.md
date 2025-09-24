# Airtable Automations → AWS Lambda Best Practices

KISS and YAGNI: keep Airtable Automations thin. Trigger a fast, asynchronous Lambda/API and handle completion via a webhook that updates Airtable.

## Core pattern
- Trigger: Airtable event (record created/updated) or manual run.
- Action: "Run a script" → `fetch` POST to your API Gateway endpoint.
- Response: API responds fast (<3–5s) with `job_id` and status `accepted`.
- Completion: Your service sends a webhook back (incoming webhook automation) to update the record.

## Authentication
- Prefer API Gateway with an API key or custom header: `X-API-Key: <key>`.
- Do NOT store secrets in table fields. Keep them in the Automation script (and restrict editor access) or call a proxy you control that holds the secret.
- Always use HTTPS. If you sign requests, add `X-Timestamp` and `X-Signature` (HMAC of raw body).

## Idempotency and correlation
- Generate a deterministic idempotency key per record/action, e.g.: `recordId + ":transcribe:v1"`.
- Include `idempotency_key` and `correlation_id` (the Airtable `recordId`) in the request body.
- Your backend should use the key to deduplicate requests and return the existing `job_id`.

## Timeouts and latency
- Automation scripts should not wait for long jobs. Keep the request quick and non-blocking.
- Offload work to Step Functions or background Lambda and return immediately with `job_id`.

## Retries
- Implement simple client retries for transient failures (max 2–3 attempts with 1–5s delay).
- Treat any non-2xx as failure. Do not retry indefinitely. Prefer server-side retries.

## Error handling
- On failure, set a status field (e.g., "error") on the record and store the `last_error` message and HTTP status.
- Include the `request_id`/`trace` from response headers if available for debugging.

## Observability
- Save `job_id` to the record after a successful submission.
- Include `correlation_id` in the request so the webhook can map back to the record.
- If your API returns an execution ARN or link to logs, store it in a debug field.

## Webhook (job completion)
- Use Airtable "When webhook received" trigger for callbacks.
- Verify signature if provided. Update the record with final status and artifact URLs.
- If the payload contains a large blob, consider saving only a URL and a compact summary to Airtable fields.

## Example: Automation script (POST → async job)
```javascript
// Inputs: tableId, recordId, apiBase, apiKey, callbackUrl
let table = base.getTable(input.config().tableId);
let recordId = input.config().recordId;

let idempotencyKey = `${recordId}:transcribe:v1`;
let body = {
  correlation_id: recordId,
  idempotency_key: idempotencyKey,
  outputs: ["words", "vtt", "srt"],
  callback_url: input.config().callbackUrl
};

let resp;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    resp = await fetch(`${input.config().apiBase}/v1/transcribe/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": input.config().apiKey
      },
      body: JSON.stringify(body)
    });
    if (resp.status >= 200 && resp.status < 300) break;
    await delay(1000 * attempt);
  } catch (e) {
    if (attempt === 3) throw e;
    await delay(1000 * attempt);
  }
}

if (!resp || resp.status < 200 || resp.status >= 300) {
  const msg = resp ? await resp.text() : "no response";
  await table.updateRecordAsync(recordId, {
    Status: "error",
    Last_Error: msg.slice(0, 500)
  });
  output.markdown(`Failed: ${msg}`);
  return;
}

const data = await resp.json();
await table.updateRecordAsync(recordId, {
  Job_ID: data.job_id,
  Status: "submitted"
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
```

## Example: Webhook payload expectations
- Your service should send back at completion:
  - `job_id`, `status`, `occurred_at`
  - `correlation_id` (Airtable `recordId`)
  - `artifacts` with public URLs (e.g., CloudFront)
  - Optionally an inline `blob` (stringified JSON) for convenience

## Field design in Airtable
- Add fields: `Status` (single select), `Job_ID` (text), `Last_Error` (long text), `Artifacts_URL` (URL), `Updated_At` (last modified time).
- Keep only necessary data in Airtable; store large payloads externally and link by URL.

## Security notes
- Do not embed secrets in base tables. If Automations lack secure secrets for your case, route via a minimal proxy that injects credentials server-side.
- Validate webhook signatures and timestamps; reject if stale.

## Rate limiting
- Throttle submissions using batch triggers and the Automation "delay" between operations when iterating records.
- Avoid firing on every keystroke; trigger on stable state changes (e.g., when `Status` becomes "ready").


