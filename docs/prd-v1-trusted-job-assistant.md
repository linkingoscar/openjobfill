# OpenJobFill PRD v1 — Trusted Job Assistant implementation

This document records the implementation boundary for the PRD v1 upgrade. It intentionally distinguishes **development verification** from **personal live-site verification**.

## Product invariant

OpenJobFill remains a preview-first assistant. The extension may analyze, plan, write confirmed fields, read them back, and report issues. It does **not** automate password entry, captcha, payment, sign-in/sign-up, submit, next/continue, application confirmation, deletion, or withdrawal.

AI is advisory. Field mapping AI only receives page structure plus resume field metadata/value-presence, never the resume values themselves. Document parsing, open-question drafting, and job-variant suggestions require an explicit per-request user confirmation before resume/JD content is sent to the configured model. AI output is schema/whitelist validated locally and cannot freely execute DOM operations.

## Resume Schema v5

The v5 profile is the trusted source of truth. It keeps values compatible with `StandardResume` and stores trust metadata in the `fieldMeta` sidecar:

- source: manual/local parser/AI parser/JSON/derived/site learned
- confidence and evidence
- confirmed / confirmedAt
- locked
- autoFillEnabled
- updatedAt

Locked and confirmed values outrank import candidates. Local and AI parsing produce candidates with evidence and confidence; conflicts are exposed in the import review instead of being silently overwritten.

### Master and job variants

A job variant has a `parentResumeId` and resolves against the latest master before filling. Only explicit content changes are applied as `variantOverrides`; project/experience reordering uses stable record IDs in `variantOrdering`, so later master fact edits still flow into the job variant. Presentation preferences such as highlighted existing skills and selected existing profile links live in `variantPresentation` and do not mutate master facts.

## Decision model

The runtime decision states are:

- `FILL_HIGH_CONFIDENCE`
- `FILL_REVIEW_REQUIRED`
- `OPTIONAL_UNMATCHED`
- `NEEDS_USER`
- `SKIP`
- `BLOCKED`

Risk levels are Critical, High, Medium, LongText, and Low. Critical/High/long-text decisions have stricter thresholds. Low-confidence AI suggestions remain manual; AI cannot bypass local safety, identity exclusions, value presence checks, or risk policy.

## Typed read-back verification

A successful write is counted only when the page can be read back and the typed verifier returns `VERIFIED`.

Verification is type-specific for phone, email, ID, number, boolean, date, date range, enum, region, URL, text, long text, select, and cascader values. Generic substring matching is not the final success fallback. `PARTIALLY_VERIFIED`, `MISMATCH`, `UNREADABLE`, and `NOT_HANDLED` remain review/failure outcomes.

Execution uses a retry ladder and records strategy attempts and standardized failure codes. Existing user input is protected, and a preview is invalidated when the page or resume context changes.

## Attachment safety

Resume attachment upload:

- prioritizes semantic Resume/CV targets
- rejects avatar/photo/portfolio-like targets
- requires user selection when multiple targets are ambiguous
- treats event dispatch as an attempt, not success
- verifies native `input.files`, visible file name, or reliable upload-complete state

Only `VERIFIED` is treated as a confirmed upload. Attachment outcomes also feed the personal compatibility matrix.

## Personal site learning

Learned field mappings keep selector/fingerprint/locator evidence plus health fields:

- `ACTIVE`
- `STALE`
- `DISABLED`
- success/failure counters
- last verified timestamp
- last failure reason

A selector/fingerprint conflict is stale instead of being silently reused. Strict execution results feed mapping health and the local personal compatibility matrix without storing the field values.

### Compatibility status boundary

Compatibility statuses are `UNSEEN`, `DETECTED`, `PARTIAL`, `PERSONAL_VERIFIED`, and `DEGRADED`.

**Automatic runs, fixtures, and CI never promote a site to `PERSONAL_VERIFIED`.** Development telemetry can update module PASS/PARTIAL/FAIL status, but real verification requires the explicit `markPersonalVerified` path after a user completes a legitimate live flow. A later failure can degrade a previously verified site.

This is deliberate: local fixture success must never be presented as real-site evidence.

## Scoped QA bank

The QA bank supports:

1. job posting
2. company domain
3. job family
4. global

in that priority order.

Each QA item may keep multiple user-confirmed answer versions, including size-constrained variants. Runtime matching considers the active job variant context, current hostname, and field `maxLength`. Only manual or explicitly confirmed AI answers are learnable.

## AI capabilities

### Field mapping v2

The model receives field structure and allowed resume-key metadata/value-presence. It returns `resumeKey`, confidence, reason code, and alternatives. Responses are filtered by local allowed keys, valid indices, confidence bounds, and other-person identity safety before they can modify a FillPlan.

### Document parsing v2

Local extraction and AI parsing are candidates, not direct profile overwrites. AI conflicts with locked/confirmed facts are shown in the import review. AI failure preserves local candidates. Scan/image parsing requires explicit external-processing consent.

### Open-question drafts

An AI draft is only generated after a per-request confirmation explaining that the question, current JD, and a non-sensitive fact subset will be sent. The draft is displayed first and is not written to the page. A second explicit user action edits/confirms and applies it. The user may separately save the confirmed answer to a scoped QA item.

### Job-variant suggestions

AI can propose:

- project order
- experience order
- highlights from existing skills
- shorter existing descriptions
- self-evaluation copy
- selection among existing profile links

Every suggestion carries resume evidence keys and optional JD evidence. Local validation rejects missing evidence, invented record IDs, nonexistent skills, unavailable links, and attempts to rewrite fact fields. Adopting a suggestion creates/updates a job variant; the master is not directly modified by AI.

## Pre-submit consistency review

After a confirmed fill, OpenJobFill runs deterministic consistency checks and surfaces blockers/warnings for issues such as:

- phone/email/ID mismatch or lack of strict verification
- current-job/end-date conflicts
- invalid education/work date ranges
- suspicious other-company name reuse in open answers
- fields that failed verification
- unverified attachment status when available to the check

These findings are advisory/blocking UI only. The extension still does not submit or advance the application.

## Local quality and privacy

Fill history stores value-free diagnostics: counts, sources, failure codes, retry attempts, verification totals, AI mapping totals, and redacted page metadata. The drawer includes a local quality dashboard and the personal compatibility matrix. Resume values are not persisted in diagnostic history.

## Development verification

The PRD development gate is the repository CI pipeline:

1. TypeScript / Vue compile check
2. Vitest unit and semantic/negative-context benchmarks
3. extension production build
4. Playwright Chromium install
5. real built-extension smoke flow covering Shadow DOM UI, persisted profile data, MAIN-world adapter bridge, preview/confirm execution, strict fill snapshots, deterministic replay, and clipboard focus isolation

The semantic benchmark and negative-context benchmark remain regression gates; known false-positive behavior must not be traded for coverage.

## Explicitly deferred live-site acceptance

The following are **not** claimed by this development branch:

- three personally used recruitment sites reaching `PERSONAL_VERIFIED`
- logged-in real application page acceptance
- user-experience validation on a specific employer's live ATS

Those require the user's legitimate authenticated pages and manual inspection. They are separate from the development-complete state and must not be synthesized from fixtures or CI.
