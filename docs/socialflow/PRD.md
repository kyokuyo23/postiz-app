# SocialFlow — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Document | PRD.md (companions: BRD.md, FRD.md) |
| Version | 1.0 (baseline draft) |
| Date | 2026-10-06 |
| Code baseline inspected | `kyokuyo23/postiz-app` @ `5e8a570` (Postiz v1.47.0 fork), shallow clone |
| Authority rule | Code is the source of truth over the brief. Status legend and the brief-vs-repository finding table are in **BRD §0**; they apply here unchanged. |

Status values used per feature: **IMPLEMENTED / PLANNED / BLOCKED / DEFERRED** (plus NOT YET AVAILABLE, EXTERNAL DEPENDENCY, REPORTED-UNVERIFIED as defined in BRD §0.1). Priority: **P0** required before any real provider activation, **P1** important, **P2** later.

Traceability: BR (BRD) → PR (this document) → FR/SEC/AUTH/AUD/META/NFR (FRD). Full matrix: FRD Appendix C.

---

## 1. Product Overview

SocialFlow is a social media content planning, media management, scheduling, publishing, campaign organization and provider-account management workspace. It is developed on the Postiz code base, which already supplies the scheduler core; SocialFlow's differentiator is a secure account/credential/audit layer that **does not yet exist in this code base** (BRD §0.2).

## 2. Product Vision

A secure social publishing workspace where every provider connection is explicitly authorized, minimally scoped, encrypted, revocable and auditable, and where nothing is called ready until independently verified.

## 3. Goals

| ID | Goal | Maps to |
|---|---|---|
| PG-1 | One workspace for drafting, media, scheduling, campaigns, publishing | BO-01/02 |
| PG-2 | Controlled multi-user collaboration with OWNER/MEMBER separation | BO-04 |
| PG-3 | Secure credential lifecycle and auditability | BO-06/07 |
| PG-4 | Provider-neutral adapters, FAKE provider for deterministic tests | BO-05 |
| PG-5 | Facebook Page publishing, gated, least privilege | BO-08/09 |

## 4. Non-goals

Instagram (DEFERRED); providers beyond FAKE and Facebook Page in the initial release; Meta Ads/Marketing APIs; inbox/messaging; mobile apps; billing redesign; compliance certifications; any real Meta call before gate approval.

## 5. User Personas

| Persona | Target role | Needs |
|---|---|---|
| Workspace Owner | OWNER | Connect/reconnect/revoke accounts, rotate credentials, audit visibility |
| Content Manager | MEMBER (third role only if owner approves, OQ-10) | Plan campaigns, schedule, monitor |
| Team Member | MEMBER | Draft, upload, schedule, publish via authorized accounts |
| Future social-account administrator | External consent actor | Grant provider consent; not a workspace role today |

Roles in the code today are `SUPERADMIN / ADMIN / USER` (`UserOrganization.role`). Mapping to OWNER/MEMBER is an open decision (OQ-10).

## 6. User Journeys

Status for each journey reflects the code.

| ID | Journey | Steps | Status |
|---|---|---|---|
| UJ-1 | Create and schedule a post | Open launches calendar → compose → select channel(s) → pick date → save | IMPLEMENTED (base) |
| UJ-2 | Draft with AI | Compose → AI generator/draft → edit → save | IMPLEMENTED (base: `/posts/generator`, `/posts/generator/draft`, copilot) |
| UJ-3 | Reuse media | Upload (or generate) → attach to post | IMPLEMENTED (base: `/media`) |
| UJ-4 | Organize into a campaign | Create campaign → attach posts | NOT YET AVAILABLE (no Campaign entity; tags exist) |
| UJ-5 | OWNER connects a provider account | Start connect → provider consent → callback → account stored → audit | PLANNED; for Meta BLOCKED. (Base has a live connect flow `POST /integrations/social/:integration` / `GET /integrations/social/:integration`, not conforming to the target contract.) |
| UJ-6 | OWNER revokes/rotates | Select account → revoke or rotate → publishing blocked → audit | PLANNED |
| UJ-7 | MEMBER publishes via authorized account | Select permitted account → publish | PLANNED (role restriction); base lets any org member use channels |
| UJ-8 | OWNER reviews audit | Open security timeline → filter | NOT YET AVAILABLE |
| UJ-9 | Visitor reads policy/support/status | Open public page | NOT YET AVAILABLE (no pages found) |

## 7. Product Architecture Overview

Observed (IMPLEMENTED):

- Monorepo (pnpm): `apps/backend` (NestJS API), `apps/orchestrator` (Temporal workflows), `apps/frontend` (React/Vite), `apps/extension`, `apps/sdk`, `apps/commands`; shared code in `libraries/`.
- Layering convention: Controller → Service → Repository (documented in `CLAUDE.md`).
- PostgreSQL via Prisma; Redis; Temporal; storage backends local / Cloudflare R2.
- Provider classes implement `SocialProvider` (~35 providers).
- Post publishing runs as versioned Temporal workflows (`post.workflow.v1.0.1`–`v1.0.5`), plus token-refresh, missing-post and autopost workflows.

Target additions (PLANNED): Workspace/OWNER-MEMBER authorization layer, opaque session store, credential vault (AES-256-GCM), authorization-attempt store, append-only audit store, readiness-gate evaluator, FAKE provider, public policy pages.

## 8. Feature Areas

| ID | Feature area | Status | Priority | Dependencies |
|---|---|---|---|---|
| PR-001 | Content Studio | IMPLEMENTED (base) | P0 | Providers, Media |
| PR-002 | AI drafting | IMPLEMENTED (base) | P1 | OpenAI key |
| PR-003 | Media library | IMPLEMENTED (base) | P0 | Storage backend |
| PR-004 | Posts & lifecycle | IMPLEMENTED (base) | P0 | Temporal, Redis |
| PR-005 | Campaigns | NOT YET AVAILABLE | P1 | OQ-11 decision |
| PR-006 | Calendar / scheduling | IMPLEMENTED (base) | P0 | PR-004 |
| PR-007 | Dashboard (+ filtering) | REPORTED-UNVERIFIED | P1 | PR-004/005 |
| PR-008 | Workspace & membership | PARTIAL (base orgs, 3 roles) | P0 | — |
| PR-009 | Roles & permissions (OWNER/MEMBER) | PLANNED | P0 | PR-008 |
| PR-010 | Sessions (opaque, revocable) | PLANNED | P0 | PR-008 |
| PR-011 | Provider accounts | PARTIAL (base integrations); neutral model PLANNED | P0 | PR-009 |
| PR-012 | Credential lifecycle (encrypt/rotate/revoke) | PLANNED | P0 | PR-011 |
| PR-013 | Audit timeline | NOT YET AVAILABLE | P0 (events) / P1 (UI) | PR-009 |
| PR-014 | Provider adapter contract + contract tests | PARTIAL (interface only) | P0 | — |
| PR-015 | OAuth security contract (PKCE/state/attempts) | PLANNED | P0 | PR-012 |
| PR-016 | Least-privilege scope policy | PLANNED / EXTERNAL DEPENDENCY | P0 | Meta |
| PR-017 | Public policy pages | NOT YET AVAILABLE | P0 | Owner text |
| PR-018 | Facebook Page integration (future) | BLOCKED | P0 | PR-012/013/015/016/017, Meta |
| PR-019 | FAKE provider | PLANNED | P1 | PR-014 |
| PR-020 | Instagram | DEFERRED | — | Explicit approval |

## 9. Content Studio — PR-001 — IMPLEMENTED (base), P0

Compose posts per channel with provider-specific settings (DTOs per provider), thread/comment structure (`parentPostId`), per-provider validation (`checkValidity`, `maxLength`).
Acceptance:
- GIVEN a user composes a Facebook Page post with a story type and no media WHEN validation runs THEN the post is rejected with "Story should have at least one media" (code: `FacebookProvider.checkValidity`).
- GIVEN a post exceeds the provider's max length WHEN validated THEN it is rejected (provider `maxLength`).

## 10. AI Drafting — PR-002 — IMPLEMENTED (base), P1

Existing: `POST /posts/generator`, `POST /posts/generator/draft`, copilot controller, OpenAI service. Requirements (PLANNED): AI output is a draft only, never auto-published; prompts and content sent to a third-party model are disclosed in the Privacy page; AI actions respect workspace scoping.
Acceptance:
- GIVEN a user requests an AI draft WHEN generation completes THEN the result is stored as a draft/edit buffer and no provider publish occurs.

## 11. Media Library — PR-003 — IMPLEMENTED (base), P0

`Media` entity (`organizationId`, `path`, `type`, `fileSize`, `alt`, `thumbnail`, soft-delete). Upload to local or Cloudflare R2. AI image/video generation endpoints exist.
Acceptance:
- GIVEN media belongs to Workspace A WHEN a user of Workspace B requests it by id THEN the server denies it (verification test PLANNED; no test exists).
- GIVEN a media item is deleted WHEN listing THEN it is excluded (soft delete via `deletedAt`).

## 12. Posts — PR-004 — IMPLEMENTED (base), P0

States: `QUEUE`, `PUBLISHED`, `ERROR`, `DRAFT`; soft delete; `releaseId/releaseURL`; `error` text; `Errors` records; tags. Draft/scheduled/published/failed lifecycle is detailed in FRD §6.
Acceptance:
- GIVEN a post is scheduled in the future WHEN its time arrives THEN a workflow attempts publish and sets `PUBLISHED` or `ERROR`.

## 13. Campaigns — PR-005 — NOT YET AVAILABLE, P1

No `Campaign` model exists; `Tags`/`TagsPosts`, `Sets`, `AutoPost` exist. Requirement: persistent campaign entity with a name, optional description/date range, and relationships to posts; campaign deletion must not delete published history. Whether to model as new entity vs. tags is OQ-11.
Acceptance (PLANNED):
- GIVEN a campaign with three posts WHEN one post is moved to another campaign THEN each campaign shows the correct posts and counts.

## 14. Calendar / Scheduling — PR-006 — IMPLEMENTED (base), P0

Calendar ("launches" frontend area); `GET /posts?…` listing, `PUT /posts/:id/date`, `GET /posts/find-slot`, per-channel posting-time presets (`Integration.postingTimes`).
Acceptance:
- GIVEN a scheduled post WHEN the user changes its date THEN the new `publishDate` persists and the workflow honours it.

## 15. Dashboard — PR-007 — REPORTED-UNVERIFIED, P1

Brief claims dashboard and dashboard filtering. Not located as such; analytics module and `/analytics` routes exist. Treat as PLANNED until located.
Acceptance (PLANNED):
- GIVEN posts across states and campaigns WHEN the user filters by state, campaign and date range THEN only matching posts and counts are shown.

## 16. Workspace — PR-008 — PARTIAL, P0

Base: `Organization`, `UserOrganization` (`role`, `disabled`), org selection via `showorg` header/cookie, team invite flow. Target: Workspace with OWNER/MEMBER and strict isolation.
Acceptance:
- GIVEN a user disabled in Workspace A WHEN they call the API with Workspace A selected THEN they are not resolved into Workspace A (base middleware filters `disabled`).

## 17. Provider Accounts — PR-011 — PARTIAL, P0

Base: `Integration` (name, `providerIdentifier`, `disabled`, `deletedAt`, `refreshNeeded`, `inBetweenSteps`, `customerId`), routes for list/enable/disable/delete/nickname/settings. Target: provider-neutral `ProviderAccount` with status (connected / reconnect-required / revoked), safe-metadata view for MEMBERs, OWNER-only mutations.
Acceptance:
- GIVEN an OWNER has an authorized connection WHEN the OWNER revokes it THEN publishing through it is blocked while historical posts remain visible.
- GIVEN a MEMBER WHEN they call a connect, reconnect, revoke or rotate operation THEN the server rejects it.

## 18. Credential Lifecycle — PR-012 — PLANNED, P0

Required: AES-256-GCM with workspace/account-bound AAD, key versioning, rotation (credential and encryption key), revocation, sanitized logging, no decryption to render metadata. Current code: `token`/`refreshToken` columns on `Integration`; legacy AES-256-CBC helper (`fixedEncryption`) keyed from `JWT_SECRET`; whether tokens are encrypted at rest was not verified.
Acceptance:
- GIVEN a credential is stored WHEN the row is read raw THEN no plaintext token is present and the ciphertext is bound to its workspace and account.
- GIVEN an encryption key rotates WHEN credentials are re-encrypted THEN old-version ciphertext remains decryptable until migrated and new writes use the new version.

## 19. Audit Timeline — PR-013 — NOT YET AVAILABLE, P0/P1

Append-only, workspace-scoped, actor-aware, secret-free events; OWNER-only timeline. Candidate event names are in FRD §16, all PLANNED.
Acceptance:
- GIVEN a MEMBER in Workspace A WHEN they request Workspace A's audit timeline THEN the server rejects the request.
- GIVEN any audit event WHEN stored or returned THEN it contains no token, code, verifier, secret or key.

## 20. Public Policy Pages — PR-017 — NOT YET AVAILABLE, P0 (Meta prerequisite)

Terms, Privacy, Data Deletion, Support, Status; single canonical support-contact resolver with safe fallback. No such routes found in frontend. Content requires owner/legal input; no legal approval is claimed.
Acceptance:
- GIVEN an unauthenticated visitor WHEN they open each policy URL THEN the page renders without login and shows the support contact.
- GIVEN the support contact configuration is missing WHEN the page renders THEN a safe fallback is shown and nothing breaks.

## 21. Provider Integration — PR-014/015/016/019 — see FRD §21–§32

Adapter contract (base interface IMPLEMENTED), contract-test harness (PLANNED), FAKE provider (PLANNED, development only, must be unreachable in production), attempt-bound OAuth (PLANNED).

## 22. Facebook Page Integration — Future — PR-018 — BLOCKED, P0

Preconditions (all must be true, independently verified): META_APP_CONFIGURED, `META_APP_DOMAIN_STATUS = VERIFIED`, permissions confirmed by Meta, Page-task requirements known, App Review/Advanced Access as required, test actor available, production callback registered, public policy/support pages live, internal gates satisfied.
Candidate permissions (**REQUIRES META CONFIRMATION; not approved**): `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. The base code requests six scopes (adds `business_management`, `pages_manage_engagement`, `read_insights`), which conflicts with least privilege; reduction is PLANNED (META-004).
Acceptance:
- GIVEN OAuth is not approved WHEN an OAuth activation attempt occurs THEN the system remains fail-closed.
- GIVEN `META_APP_REVIEW_CONFIRMED` is false WHEN a connect request arrives THEN it is refused with a non-secret reason.

## 23. Instagram — Deferred — PR-020 — DEFERRED

Not to be activated without explicit approval. Note: base contains `instagram.provider.ts` and `instagram.standalone.provider.ts`; they must be disabled/unreachable for SocialFlow until approval (OQ-02).

## 24. Notifications / Feedback

Base has a `Notifications` model and notification routes (IMPLEMENTED). Requirements (PLANNED): user-visible success/failure feedback for publish, reconnect-required and revocation events; no secret content in notifications.
Acceptance: GIVEN a publish fails WHEN the workflow records the error THEN the user sees a failure state with a safe message.

## 25. UX Requirements

Clear status chips (Draft, Scheduled, Published, Failed); account status chips (Connected, Reconnect required, Revoked); role-aware UI hides OWNER actions from MEMBERs **in addition to** server enforcement; readiness state shown to OWNER without exposing secrets. Frontend conventions per `CLAUDE.md` (Tailwind 3, native components, SWR hooks).

## 26. Accessibility

No accessibility conformance is claimed. Target (PLANNED): keyboard-operable flows, visible focus, labelled controls, non-color-only status, adequate contrast. A formal audit level (e.g., WCAG 2.1 AA) is an owner decision (OQ-12).

## 27. Responsive Design

Desktop and mobile viewports are in scope for all P0/P1 screens (brief reports desktop and mobile verification; not re-verifiable here). Acceptance: GIVEN a 375px-wide viewport WHEN a user opens calendar, composer, media and account screens THEN content is usable without horizontal scroll.

## 28. Error Handling

Safe, non-secret messages; typed failure categories (FRD §30); publish failures recorded (`Post.error`, `Errors`); token problems surface as reconnect-required (base: provider `handleErrors` returns `refresh-token` / `bad-body`). Acceptance: GIVEN a provider returns an invalid-token error WHEN publishing THEN the account is flagged reconnect-required and the user is told to reconnect.

## 29. Security

Principles: least privilege, fail closed, server-side authorization, secret minimization, defense in depth, explicit consent, workspace isolation, immutable auditability, deterministic testing, provider abstraction, no implicit trust, no fabricated readiness. Requirements SEC-001…SEC-020 in FRD §37.

## 30. Privacy

Personal data in scope (from schema): user identity/profile, provider account names/pictures, post content, media, AI prompts sent to a third-party model. Requirements: disclose in Privacy page; data minimization; deletion path (Data Deletion page). No legal approval claimed.

## 31. Data Retention

No retention periods are defined. Requirements (PLANNED, owner decision, OQ-07): defined retention for posts, media, revoked-credential records (credential material deleted on revocation/deletion), and audit events; soft-delete (`deletedAt`) is current base behavior.

## 32. Roles & Permissions

| Capability | OWNER | MEMBER |
|---|---|---|
| Manage workspace | Yes | No |
| Create/manage permitted content | Yes | Yes |
| Use authorized provider accounts / publish where permitted | Yes | Yes |
| View safe account metadata | Yes | Yes |
| Connect / reconnect provider account | Yes | **No** |
| Revoke provider account | Yes | **No** |
| Rotate credentials | Yes | **No** |
| Configure FAKE provider | Yes | No |
| View security audit timeline | Yes | **No** |

All enforcement server-side. Status: PLANNED (code has ADMIN/USER/SUPERADMIN and subscription-based `CheckPolicies`; no OWNER-only enforcement on provider-account routes was found).

## 33. Analytics

Base: analytics controller and per-provider analytics (e.g., Facebook insights migrated off deprecated metrics, per HEAD commit). Product analytics/KPIs: no targets invented (BRD §22). Any provider insights permission (`read_insights`) must be justified against least privilege before use.

## 34. Non-Functional Requirements

See FRD NFR-001…NFR-013. No numeric SLA, uptime, or latency guarantee is defined or implied.

## 35. Release Strategy

1. Internal build with FAKE provider.
2. Security hardening gate (PR-009/010/012/013/015) with passing deterministic tests.
3. Public policy pages live.
4. Meta test-actor pilot only after gates verified.
5. Controlled real publishing.
6. Broader availability.
Each step needs explicit owner approval. No step relies on claimed Meta approval.

## 36. Acceptance Criteria (cross-cutting)

- GIVEN a MEMBER belongs to Workspace A WHEN the MEMBER attempts to access Workspace A's security audit timeline THEN the server rejects the request.
- GIVEN an OWNER has an authorized provider connection WHEN the OWNER revokes the connection THEN publishing through that connection is blocked while historical records remain available.
- GIVEN OAuth is not approved WHEN an OAuth activation attempt occurs THEN the system remains fail-closed.
- GIVEN a user of Workspace B WHEN they request any Workspace A resource by id THEN the server returns not-found/forbidden and discloses no data.
- GIVEN any log, audit event, API response or browser-visible state WHEN inspected THEN it contains no authorization code, token, PKCE verifier, provider secret or encryption key.
- GIVEN the same callback is delivered twice concurrently WHEN processed THEN at most one succeeds.

## 37. Product Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 Internal MVP | Content, AI, media, posts, calendar, teams | Base IMPLEMENTED; campaigns, dashboard filtering UNVERIFIED |
| 2 External Provider Readiness | OWNER/MEMBER, sessions, credential vault, audit, FAKE provider, policy pages, readiness gates, tests | PLANNED in this repo (brief: in progress elsewhere) |
| 3 Facebook Page OAuth | Attempt-bound OAuth + Page discovery | BLOCKED (Meta prerequisites + explicit approval) |
| 4 Real Facebook Page Publishing | Publish via authorized Page | NOT YET AVAILABLE |
| 5 Additional Providers | New providers; Instagram only if approved | DEFERRED / PLANNED |

## 38. Open Questions

| ID | Question |
|---|---|
| OQ-01 | Where is the code implementing the brief's SocialFlow features? (BRD OQ-01) |
| OQ-02 | Disable inherited non-target providers incl. Instagram? |
| OQ-04 | Meta-confirmed minimum Facebook permissions? |
| OQ-05 | Is the Meta App Domain persisted? |
| OQ-07 | Retention/deletion periods? |
| OQ-09 | Authoritative callback URL and registration status? |
| OQ-10 | Role mapping ADMIN/USER/SUPERADMIN → OWNER/MEMBER; is a third role needed? |
| OQ-11 | Campaign as new entity or tag-based? |
| OQ-12 | Accessibility conformance target? |
| OQ-13 | Dashboard: does it exist elsewhere; required filters? |
