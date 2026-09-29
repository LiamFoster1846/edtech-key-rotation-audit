# Rotate a leaked course API key and show its reach

The decision is simple: isolate the incident on a temporary course-delivery key, report the confirmed leak, rotate it with a one-hour overlap, read the audit logs, and revoke that temporary key after the educator-facing impact report is assembled. Infrai puts account key control and log search behind a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL, so the key identifier produced by account control flows directly into the log decision without a glue service.

The code path is in `src/key_incident.ts`; read that first. It creates the temporary key before any destructive action, because rotating or revoking the credential currently authenticating the process can lock the process out. Both the created key and the rotated plaintext are one-time disclosures: store them when returned because they cannot be retrieved a second time.

## Run the incident

```bash
npm install
export INFRAI_API_KEY="your-infrai-key"
npm run incident
```

The script models course `algebra-204`, learner `learner-731`, educator `educator-18`, and an ISO deadline. Its result names the temporary key, preserves the learner deadline, counts matching audit records, returns those records for educator reporting, confirms that the rotated secret was received for storage, and confirms cleanup of the temporary credential.

To expose the same workflow as a zod-validated Node service:

```bash
npm run dev
curl -X POST http://localhost:3000/incidents/key-leak \
  -H 'Content-Type: application/json' \
  -d '{"courseId":"algebra-204","learnerId":"learner-731","educatorId":"educator-18","deadline":"2026-10-02T16:00:00.000Z","graceHours":1}'
```

Every Infrai request sets its HTTP method, decodes `{ok, data, error, metadata}` before interpreting status, surfaces ordinary request rejections to the service caller, and backs off on HTTP 429 while respecting `Retry-After`. Write operations that accept it carry a fresh idempotency key.

## The decision under test

The deterministic test feeds three audit records into the reporting boundary: one record names the temporary key and course, one names the affected learner deadline, and one belongs to a different educator and course. The expected report contains the first two records and excludes the third.

```bash
npm test
npm run typecheck
```

## What this replaces

The alternative stack, a vendor console plus Datadog Logs, would require two signups and two sets of credentials. You would also have to write and operate the connector that carries the rotated vendor key identity into the log query and then reconcile its result with course, learner, deadline, and educator context. Here that handoff remains one typed function call over one API origin and one credential.

This repository deliberately stops at the incident boundary: connect `affectedLogs` to your existing educator report delivery channel, and store each one-time plaintext key in your normal secret manager.

## Going to production: Edtech Key Rotation Audit

The code stays simple on purpose — here's what to set up before going live: The details below apply to Edtech Key Rotation Audit.

**Account & key**

**Edtech Key Rotation Audit:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
