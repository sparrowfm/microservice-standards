# Airtable Automations → Aviary Services (Client) Standards v1.3

**Scope**  
Standards for Airtable **Automation** scripts that submit jobs to Aviary microservices (Condor TTS, Kestrel Transcription, Magpie Gather, Nightingale Mix, etc.) via API Gateway/Lambda.

**Goals**  
Thin, deterministic clients that: (1) validate inputs, (2) submit a fast async job, (3) correlate via webhooks, (4) expose predictable outputs for downstream steps.

---

## 1) Core Pattern

- **Trigger:** Airtable event (record created/updated) or manual run.  
- **Action:** “Run a script” → `fetch` **POST** to your API endpoint.  
- **Response:** API returns quickly (<3–5s) `{ job_id, status: "submitted" | "accepted" }`.  
- **Completion:** Your service POSTs a **webhook** (Airtable incoming webhook automation) that updates the record with final status & artifacts.  
- **Responsibility split:** Automation = submit (optionally set `Status=submitted`); webhook = authoritative final update.

---

## 2) Authentication & Secrets

- **Always HTTPS**.  
- **Auth header:** `X-API-Key: <secret>` (API Gateway usage plan or your proxy).  
- **Store secrets** with **Automation Secrets**: `input.secret("…")`.  
  Standard names: `"Condor TTS"`, `"Kestrel Transcription"`, `"Magpie API Key"`.  
  Allow an override input (e.g., `condor_secret_name`) if needed.  
- **Never** store secrets in table fields. **Mask** secrets in logs (first 6–8 chars only).  
- *(Optional)* **Signed requests:** add `X-Timestamp` and `X-Signature` (HMAC of raw body) if your edge verifies signatures.

---

## 3) Idempotency & Correlation

- **Deterministic key:** `idempotency_key = recordId + ":" + action + ":v1"`.
- **Correlation:** include `correlation_id = recordId` in request **and** propagate it back in webhooks.
- **Backend behavior:** identical requests must dedupe and return the **existing** `job_id`.

### 3.1) Job ID Format Convention

Use **semantic, human-readable job IDs** in the format: `job_{resource_id}_{timestamp}`

**Benefits:**
- Easier debugging in logs and monitoring
- Natural correlation across API responses and webhooks
- Self-documenting (contains context about what resource is being processed)

**Example:**
```javascript
const jobId = `job_${feedId}_${Date.now()}`;
```

**Important:** The **client should NOT generate the job_id**. The backend Lambda should:
1. Generate the semantic job_id when the job is accepted
2. Return it in the API response
3. Include it in the SQS message
4. Pass it through to the webhook callback

This ensures the same job_id appears consistently across:
- Initial API response: `{ job_id: "job_feed-123_1759255913454" }`
- Webhook callback: `{ job_id: "job_feed-123_1759255913454", artifacts: { job_id: "..." } }`

---

## 4) Endpoint Normalization & Path Guards

Accept either:

- `api_endpoint` (full URL, **must** end with required path), or
- `api_base` (base URL; script appends path).

**Required path suffixes:**

- Condor TTS: `/v1/tts/jobs`
- Kestrel Transcription: `/v1/transcribe/jobs`
- Magpie Gather: `/v1/gather`
- Starling RSS: `/feeds` (for feed creation) or `/feeds/{feed_id}/items/upsert` (for episodes)

Also:

- Strip trailing `/`.
- Enforce **https**.
- Fail fast with helpful hints on mismatches (e.g., "points to TTS; use `/v1/transcribe/jobs`").

### 4.1) Endpoint Construction Pattern

**Pattern:** Accept `api_base` and construct the full endpoint path in the script.

**Good:**
```javascript
const apiBase = strFrom("api_base", cfg.api_base, true);
const feedId = strFrom("feed_id", cfg.feed_id, true);
const apiEndpoint = `${apiBase}/feeds/${feedId}/items/upsert`;
```

**Avoid:**
- Asking for full endpoint paths with path parameters filled in
- Requiring users to construct URLs manually in Airtable

**Rationale:**
- Users only need to configure the base URL once
- Script handles path parameters automatically
- Less error-prone configuration

---

## 5) Inputs, Coercion & Slug Hygiene

- Keep `input.config` **small and typed**.  
- Use lookup-safe coercers (linked/select fields → strings/numbers/bools) so scripts survive schema changes.  
- Normalize slugs with a shared `slugify()`:
  - lowercase → NFKD → strip combining marks → `[^a-z0-9]+` → `-` → trim `-`.
- Accept precise `title_slug` if supplied; else derive from content or `{recordId}-{timestamp}`.

**Common inputs**

- `api_endpoint` **or** `api_base`  
- `webhook_url` (https)  
- `record_id`, `podcast_slug`, `title_slug`

**Service-specific (examples)**

- **Condor:** `script`, `tts_provider`, `voice_id_google`  
- **Kestrel:** `audio_url`  
- **Magpie:** `cue_sheet_json`

**Options (examples)**

- Numerics (clamped): `speed`, `audio_gain_db`, `min_score`, `max_alternates`  
- Booleans: `force`, `force_rerender`, `callback_append_params`

---

## 6) Timeouts & Retries

- **Timeout:** wrap `fetch` with `AbortController` (target **20s**).  
- **Shallow retry once** on transient errors only:
  - network errors, timeouts, HTTP `>=500`, `429` (use 500–1000 ms backoff).
- **Do not retry** on `4xx` (except `408` if you explicitly choose).

---

## 7) Payload Hygiene & Client Fingerprint

- **Prune** `undefined`/`NaN` deeply before POST.  
- **Clamp** numeric options (e.g., `speed ∈ [0.25, 4.0]`, `audio_gain_db ∈ [-96, 16]`).  
- **Always include:**
  - `podcast_slug`, `title_slug`
  - `callback_url` (https; may append helpful query params)
  - `idempotency_key`, `correlation_id`
  - `client`: `{ "tag": "aviary/<service>@<semver>", "record_id": "<recordId>" }`
  - `options` tunables
  - Service inputs (`text`, `audio_url`, `cue_sheet`, …)
- **Headers:**
  - `X-API-Key: <secret>`
  - `X-Client: aviary/<service>@<semver>`
  - `X-Request-Id: <record_id>`

> **Condor/Chirp note:** If model contains “Chirp” and text includes SSML, map `<break>` → textual pauses client-side and set `options.ssml_mode = "strip"`.

---

## 8) Error Taxonomy & Hints

- Classify and throw with actionable hints:
  - `401/403` auth → "Verify API key / usage plan."
  - `404` not found → "Check resource path / environment."
  - `422` validation → "Check required fields are present and valid."
  - `429` rate → "Back off; server retry policy applies."
  - `5xx/502` gateway → "Check Lambda timeout/crash; API Gateway integration; env vars."
- **Log** truncated response (~500 chars) and keep raw on outputs for debugging.

### 8.1) Error Hint Pattern

Provide contextual, actionable hints for common HTTP error codes:

```javascript
if (status >= 400 && status < 500) {
  let hint = "";
  if (status === 401 || status === 403) {
    hint = "\nHint: Verify API key is correct and has permissions.";
  } else if (status === 404) {
    hint = "\nHint: Check resource exists. May need to create it first.";
  } else if (status === 422) {
    hint = "\nHint: Check required fields are present and valid.";
  } else if (status === 429) {
    hint = "\nHint: Rate limited. Back off and retry later.";
  }

  throw new Error(`HTTP ${status}: ${responseText.slice(0, 500)}${hint}`);
}
```

---

## 9) Observability & Outputs Contract

- **Structured logs:** `[svc:req]`, `[svc:retry]`, `[svc:err]`, `[svc:ok]` with masked headers and truncated payload/response previews.
- **Minimum outputs** (always set):
  - `status` — `"submitted" | "queued" | "ok"`
  - `job_id` — Semantic job ID in format `job_{resource_id}_{timestamp}` (use for correlation with webhook)
  - `api_url_used`
  - `request_payload_json` (stringified, pruned)
  - `raw_response`
- **Optional debug:**
  - `http_status_code`, `response_headers_json`, `timestamp_iso`

### 9.1) Optional Immediate Status Updates

Scripts may optionally update the record immediately after job submission:

```javascript
if (tableId) {
  try {
    const table = base.getTable(tableId);
    await table.updateRecordAsync(recordId, {
      "Status": "submitted",
      "Job ID": jobId,
    });
  } catch (updateErr) {
    console.warn(`[${SERVICE}:warn] Could not update record: ${updateErr.message}`);
  }
}
```

**Important:**
- Make this optional via `table_id` parameter
- Catch and warn on failure (don't fail the entire job)
- The webhook callback provides the authoritative final update
- Only update minimal fields (status, job_id)

---

## 10) Webhook (Job Completion)

- Use Airtable **incoming webhook** trigger.
- Verify signature/timestamp if your service signs callbacks.
- Expect payload:
  - `job_id`, `status` (`succeeded|failed`), `occurred_at`
  - `correlation_id` (Airtable `recordId`)
  - `artifacts` object (e.g., `{ "primary_url": "https://…" }`)
  - Optional `blob` (stringified JSON for convenience)
- Update record fields: final status, artifact URLs, debug info (request/trace id).
  Prefer storing **URLs** and concise summaries over large blobs.

### 10.1) Standard Webhook Payload

All webhooks should follow this structure:

```json
{
  "event_type": "item.published",
  "version": "v1",
  "job_id": "job_{resource}_{timestamp}",
  "event_id": "uuid",
  "subject_id": "resource-id",
  "status": "success" | "error",
  "source": "service-name",
  "times": {
    "published_at": "ISO8601",
    "processed_at": "ISO8601"
  },
  "attempt": 1,
  "correlation_id": "airtable-record-id",
  "artifacts": {
    "job_id": "job_{resource}_{timestamp}"
  },
  "blob": {}
}
```

**Key points:**
- `job_id` appears at top level AND in artifacts for easy access
- `correlation_id` maps to the Airtable record ID for updates
- `subject_id` identifies the primary resource (feed_id, item_id, etc.)
- `artifacts` contains service-specific outputs (URLs, ETags, etc.)
- Same `job_id` format as returned in initial API response for correlation

---

## 11) Field Design in Airtable

- `Status` (single select): `ready`, `submitted`, `processing`, `succeeded`, `failed`, `error`  
- `Job_ID` (text)  
- `Artifacts_URL` (URL / multiple)  
- `Last_Error` (long text)  
- `Updated_At` (last modified time)  
- Optional: `Request_ID` / `Trace_ID`, `Service_Logs_URL`

---

## 12) Rate Limiting & Triggers

- Don’t trigger on every keystroke. Use stable state changes (e.g., `Status = "ready"`).  
- When iterating records, **batch** and **delay** between calls to respect service quotas.

---

## 13) Standard Helper Block (copy into each script)

```javascript
// Lookup-safe & hygiene helpers (keep identical across scripts)
function maybeUnwrapQuoted(s){ if(s==null) return ""; const str=String(s); const q=str.length>=2&&((str.startsWith('"')&&str.endsWith('"'))||(str.startsWith("'")&&str.endsWith("'"))); return q?str.slice(1,-1):str; }
function pickFirstStringLike(arr){ if(!Array.isArray(arr)) return null; for(const el of arr){ if(el==null) continue; if(typeof el==="string"){const t=el.trim(); if(t) return t;} if(typeof el==="number"||typeof el==="boolean") return String(el); if(typeof el==="object"){const cand=el.name??el.value??el.id??el.text??null; if(cand&&String(cand).trim()) return String(cand).trim();}} return null; }
function strFrom(name, v, required=false){ if(Array.isArray(v)){ const first=pickFirstStringLike(v); if(first) return String(first).trim(); if(required) throw new Error(`Missing required input "${name}" (lookup empty).`); return ""; } if(typeof v==="string"||typeof v==="number"||typeof v==="boolean"){ const s=maybeUnwrapQuoted(String(v)).trim(); if(!s&&required) throw new Error(`Missing required input "${name}".`); return s; } if(v&&typeof v==="object"){ const cand=v.name??v.value??v.id??v.text??null; if(cand) return String(cand).trim(); } if(required) throw new Error(`Missing required input "${name}".`); return ""; }
function numFrom(name, v, def, min=null, max=null){ const raw=Array.isArray(v)?pickFirstStringLike(v):v; const n=Number(maybeUnwrapQuoted(raw)); let out=Number.isFinite(n)?n:def; if(min!=null&&out<min) out=min; if(max!=null&&out>max) out=max; return out; }
function boolFrom(name, v, def=false){ if(v==null||v==="") return def; const s=String(v).toLowerCase().trim(); if(["true","1","yes","y","on"].includes(s)) return true; if(["false","0","no","n","off"].includes(s)) return false; throw new Error(`Input "${name}" must be boolean-like.`); }
function slugify(s){ return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"untitled"; }
function prune(o){ if(Array.isArray(o)) return o.map(prune).filter(v=>v!==undefined); if(o&&typeof o==="object"){ const out={}; for(const [k,v] of Object.entries(o)){ const pv=prune(v); if(pv!==undefined&&!Number.isNaN(pv)) out[k]=pv; } return out; } return (o===undefined||Number.isNaN(o))?undefined:o; }
function mask(s){ return s ? String(s).slice(0,8)+"..." : "MISSING"; }

## Appendix A — `input.config()` Variables (Spec)

This section standardizes the Airtable **Run a script → Input variables** used by Aviary Automations.  
**Naming:** use `snake_case` keys. **Types:** `string`, `number`, `boolean`.  
**Validation:** scripts must reject missing/invalid types with actionable errors.

### A.1 Common Inputs (all services)

| Key             | Type    | Required | Example                                         | Notes |
|-----------------|---------|----------|-------------------------------------------------|-------|
| `api_endpoint`  | string  | one of   | `https://…/dev/v1/transcribe/jobs`              | Full HTTPS URL **ending in required path** (service-specific). Provide **either** this or `api_base`. |
| `api_base`      | string  | one of   | `https://…/dev`                                 | HTTPS base; script appends the required path. Provide **either** this or `api_endpoint`. |
| `webhook_url`   | string  | yes      | `https://hooks.example.com/aviary`              | HTTPS only. Scripts may append helpful query params if `callback_append_params=true`. |
| `record_id`     | string  | yes      | `recA1B2C3D4`                                   | Used for `idempotency_key` and `correlation_id`. |
| `podcast_slug`  | string  | yes      | `briefly-remembered`                            | Normalized with `slugify()` unless already clean. |
| `title_slug`    | string  | yes      | `mel-taub-1954`                                 | Accept as-is if provided; otherwise derive per service rules. |
| `table_id`      | string  | no       | `tblXyZ…`                                       | If set, script may do an **optional minimal** update (`Status=submitted`, `Job_ID`). |

**Common options**

| Key                       | Type    | Required | Default | Clamp/Validation                    | Notes |
|---------------------------|---------|----------|---------|-------------------------------------|-------|
| `callback_append_params`  | boolean | no       | `true`  | –                                   | If true, append `record_id`, `podcast_slug`, `title_slug` to `webhook_url`. |

**Secrets (stored via Automation → Secrets; not `input.config`)**

- `"Condor TTS"`, `"Kestrel Transcription"`, `"Magpie API Key"`  
- Optional override keys per service (e.g., `condor_secret_name`) may be provided in `input.config` if you support them.

---

### A.2 Service: Condor (TTS)

**Required inputs**

| Key               | Type   | Required | Example                 | Notes |
|-------------------|--------|----------|-------------------------|-------|
| `script`          | string | yes      | `Hello <break time="1s"/>` | Text or SSML. Chirp models may trigger client-side SSML → pause mapping. |
| `tts_provider`    | string | yes      | `google`                | Current standard is `"google"`. Validate values. |
| `voice_id_google` | string | yes      | `en-US-Neural2-A`       | Sent as `model`/`voice_id`. |

**Optional inputs (options)**

| Key               | Type    | Default | Clamp          |
|-------------------|---------|---------|----------------|
| `speed`           | number  | `1.0`   | `[0.25, 4.0]`  |
| `audio_gain_db`   | number  | `0`     | `[-96, 16]`    |
| `force_rerender`  | boolean | `false` | –              |

**Endpoint path guard:** `/v1/tts/jobs`

---

### A.3 Service: Kestrel (Transcription)

**Required inputs**

| Key         | Type   | Required | Example                          | Notes |
|-------------|--------|----------|----------------------------------|-------|
| `audio_url` | string | yes      | `https://cdn.example.com/x.mp3`  | Public or signed URL; HTTPS. |

**Optional inputs**

| Key       | Type    | Default | Notes                       |
|-----------|---------|---------|-----------------------------|
| (none)    |         |         | Request minimal outputs (e.g., `["words"]`) in script. |

**Endpoint path guard:** `/v1/transcribe/jobs`

---

### A.4 Service: Magpie (SFX / Music Gather)

**Required inputs**

| Key              | Type   | Required | Example                       | Notes |
|------------------|--------|----------|-------------------------------|-------|
| `cue_sheet_json` | string | yes      | `{"cue_sheet":{…}}` (string)  | JSON **string**; script parses and ensures `episode_id`. |

**Optional inputs (options)**

| Key               | Type    | Default | Clamp           | Notes |
|-------------------|---------|---------|-----------------|-------|
| `min_score`       | number  | –       | `[0.0, 1.0]`    | If set. |
| `max_alternates`  | number  | –       | `[0, 100]`      | Integer. |
| `force`           | boolean | –       | –               | –       |

**Endpoint path guard:** `/v1/gather`

---

### A.5 Type & Value Rules

- **Strings**: trim; allow lookup/select/linked-field values via lookup-safe coercion (`strFrom()`).
- **Numbers**: coerce and **clamp**; reject `NaN`.
- **Booleans**: accept `true/false/1/0/yes/no/y/n/on/off` (case-insensitive).
- **URLs**: must be `https://`.
- **Slugs**: normalize with `slugify()` unless user supplied exact `title_slug`.

---

### A.6 Example `input.config()` Sets

**Condor (TTS)**
```json
{
  "api_base": "https://ky6q4irohf.execute-api.us-east-1.amazonaws.com/prod",
  "webhook_url": "https://hooks.example.com/aviary",
  "record_id": "recA1B2C3D4",
  "podcast_slug": "briefly-remembered",
  "title_slug": "mel-taub-1954",
  "script": "Hello <break time=\"1s\"/> world",
  "tts_provider": "google",
  "voice_id_google": "en-US-Neural2-A",
  "speed": 1.0,
  "audio_gain_db": 0,
  "force_rerender": false,
  "callback_append_params": true
}
