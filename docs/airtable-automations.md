# Airtable Automations → Aviary Services (Client) Standards v1.2

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

---

## 4) Endpoint Normalization & Path Guards

Accept either:

- `api_endpoint` (full URL, **must** end with required path), or  
- `api_base` (base URL; script appends path).

**Required path suffixes:**

- Condor TTS: `/v1/tts/jobs`  
- Kestrel Transcription: `/v1/transcribe/jobs`  
- Magpie Gather: `/v1/gather`

Also:

- Strip trailing `/`.  
- Enforce **https**.  
- Fail fast with helpful hints on mismatches (e.g., “points to TTS; use `/v1/transcribe/jobs`”).

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
  - `401/403` auth → “Verify API key / usage plan.”
  - `404` not found → “Check resource path / environment.”
  - `429` rate → “Back off; server retry policy applies.”
  - `5xx/502` gateway → “Check Lambda timeout/crash; API Gateway integration; env vars.”
- **Log** truncated response (~500 chars) and keep raw on outputs for debugging.

---

## 9) Observability & Outputs Contract

- **Structured logs:** `[svc:req]`, `[svc:retry]`, `[svc:err]`, `[svc:ok]` with masked headers and truncated payload/response previews.  
- **Minimum outputs** (always set):
  - `status` — `"submitted" | "queued" | "ok"`
  - `job_id`
  - `api_url_used`
  - `request_payload_json` (stringified, pruned)
  - `raw_response`
- **Optional debug:**
  - `http_status_code`, `response_headers_json`, `timestamp_iso`

> It’s fine to do a **minimal** record update post-submit (e.g., `Status=submitted`, `Job_ID=…`); reserve the authoritative write for the webhook.

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
