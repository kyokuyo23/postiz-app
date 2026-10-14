# SocialFlow — Business Requirements Document (BRD)

| Field | Value |
|---|---|
| Document | BRD.md (companion: PRD.md, FRD.md) |
| Product | SocialFlow |
| Version | 1.0 (baseline draft) |
| Date | 2026-10-06 |
| Code baseline inspected | `kyokuyo23/postiz-app`, commit `5e8a570` ("Merge: migrate Facebook insights off metrics deprecated 2026-06-15"), shallow clone (1 commit visible) |
| Authority rule | Where the product brief and the code disagree, **the code is the source of truth**. |

## 0. Read This First — Evidence Basis and Status Legend

This document was written from (a) the product owner's brief and (b) an inspection of the repository the owner designated as the project base (`postiz-app`, an open-source social scheduler, AGPL-3.0). **The repository does not contain the SocialFlow-specific capabilities listed in the brief** (see §0.2). Those capabilities are therefore not marked IMPLEMENTED anywhere in this document set.

### 0.1 Status legend

| Status | Meaning |
|---|---|
| IMPLEMENTED | Verified present in the inspected code (file-level evidence cited in FRD §A). |
| PLANNED | Intended requirement; not present in the inspected code. |
| BLOCKED | Cannot proceed until an explicit external or internal prerequisite is met. |
| EXTERNAL DEPENDENCY | Depends on a third party (Meta) or an owner action. |
| NOT YET AVAILABLE | Does not exist in any form today. |
| DEFERRED | Deliberately postponed; not to be built without explicit approval. |
| REPORTED-UNVERIFIED | Stated in the owner's brief as built, but **not found** in the inspected repository. Treated as PLANNED until the code that contains it is provided and inspected. |

### 0.2 Key finding: brief vs. repository

| Brief claim | Inspected repository (`5e8a570`) | Resulting status |
|---|---|---|
| OWNER / MEMBER roles | Roles are `SUPERADMIN` / `ADMIN` / `USER` (`UserOrganization.role`) plus `User.isSuperAdmin` | REPORTED-UNVERIFIED (different model exists) |
| Opaque server-managed sessions, rotation, revocation | Stateless JWT in `auth` cookie, signed with `JWT_SECRET`; no expiry set at signing; no session table | REPORTED-UNVERIFIED |
| AES-256-GCM credential encryption, AAD, key versioning/rotation | `AES-256-CBC`, key+IV derived from `JWT_SECRET`, fixed IV, no AAD, no key versioning (used for API keys / custom instance details) | REPORTED-UNVERIFIED; existing mechanism is weaker |
| PKCE S256, hashed single-use state, atomic consumption | Facebook state = 6 chars from `Math.random`; "codeVerifier" = 10 chars, stored in Redis (1 h TTL), no `code_challenge` sent; read-then-delete (non-atomic) | REPORTED-UNVERIFIED |
| Audit events, OWNER-only audit timeline | No audit model or endpoint found | REPORTED-UNVERIFIED |
| FAKE provider, provider contract-test harness | No FAKE provider; no test files found | REPORTED-UNVERIFIED |
| Persistent campaigns | No `Campaign` model (`Tags`, `Sets`, `AutoPost` exist) | REPORTED-UNVERIFIED |
| Public Terms/Privacy/Data Deletion/Support/Status pages | No such frontend routes found; only `GET /monitor/queue/:name` | REPORTED-UNVERIFIED |
| OAuth readiness gates (`OAUTH_READY` etc.) | No such flags in code | REPORTED-UNVERIFIED |
| Instagram deferred | `instagram.provider.ts` and `instagram.standalone.provider.ts` exist | CONTRADICTION (see §25) |
| Facebook least-privilege permissions | Provider requests 6 scopes incl. `business_management`, `pages_manage_engagement`, `read_insights` | CONTRADICTION with least privilege |
| "81+ tests" | No `*.spec.ts` / `*.test.ts` files found; test count unknown | Not documented (not fabricated) |

## 1. Executive Summary

SocialFlow is intended to be a secure social publishing workspace: content creation, AI-assisted drafting, media management, scheduling, campaign organization, publishing lifecycle management, provider-account management, workspace authorization, secure credential lifecycle, and auditability. The first real external provider target is **Facebook Pages via Meta**; Instagram is **DEFERRED**.

The designated code base (Postiz) already provides a working multi-channel scheduler (posts, calendar, media, AI helpers, Temporal-based publishing workflows, 30+ provider modules including Facebook Page). It does **not** yet provide the security and governance model that defines SocialFlow's differentiation. This BRD therefore frames the business need as: *adopt the existing scheduler capabilities as a starting point and add the secure-by-design layers, while keeping all real Meta activity gated until external prerequisites are independently confirmed.*

## 2. Business Problem

- Teams manage content across tools; planning, media, scheduling and publishing are fragmented. (Brief)
- Social-provider credentials are high-value secrets; weak storage, unclear ownership and missing audit trails create account-takeover and compliance risk. (Brief; supported by §0.2 code findings)
- Provider onboarding (Meta) has external review and configuration gates that can stall delivery; teams risk bypassing safeguards to "make it work".

## 3. Business Opportunity

A workspace product where secure credential handling, least-privilege provider access, role separation and an immutable audit trail are first-class, positioned as a foundation for later SaaS commercialization. No market sizing or pricing is asserted in this document.

## 4. Product Vision

"A secure social publishing workspace where every provider connection is explicitly authorized, minimally scoped, encrypted, revocable and auditable — and where nothing is claimed ready until it is verified."

## 5. Business Objectives

| ID | Objective | Current status |
|---|---|---|
| BO-01 | Provide a unified social content workspace | Largely IMPLEMENTED by base code (posts, calendar, media, AI); SocialFlow-specific UX PLANNED |
| BO-02 | Reduce friction in content creation and scheduling | IMPLEMENTED (base) |
| BO-03 | Secure media and content persistence | PARTIAL: persistence IMPLEMENTED (Postgres, local/R2 storage); security hardening PLANNED |
| BO-04 | Controlled team collaboration | PARTIAL: org membership + 3 roles IMPLEMENTED; OWNER/MEMBER model PLANNED |
| BO-05 | Provider-neutral architecture | IMPLEMENTED in base (`SocialProvider` interface, `IntegrationManager`); formal contract-test harness PLANNED |
| BO-06 | Secure credential handling | PLANNED (existing mechanism does not meet target) |
| BO-07 | Auditable account/security operations | NOT YET AVAILABLE |
| BO-08 | Enable real provider integrations without compromising security | PLANNED / BLOCKED (Meta prerequisites) |
| BO-09 | Minimize provider permissions (least privilege) | PLANNED (current Facebook scopes exceed candidate list) |
| BO-10 | Foundation for SaaS commercialization | PARTIAL: Stripe billing/tier code exists in base; not validated for SocialFlow |

## 6. Stakeholders

| Stakeholder | Interest |
|---|---|
| Product owner (project sponsor) | Scope, sequencing, approval of OAuth activation |
| Workspace Owners | Control of accounts, credentials, security visibility |
| Content managers / team members | Content workflow efficiency |
| Engineering (Claude-assisted development) | Authoritative requirements baseline |
| Meta (external) | App configuration, review, permissions — **EXTERNAL DEPENDENCY** |
| Legal / privacy reviewer | Policy pages; no approval is asserted here |

## 7. User / Business Personas (roles only; no demographics)

| Persona | Goal | Responsibilities / permissions (target) |
|---|---|---|
| Workspace Owner | Govern the workspace safely | Manage workspace; connect/reconnect/revoke provider accounts; rotate credentials; configure FAKE provider; view security audit timeline |
| Content Manager | Plan and ship campaigns | Create/manage content, campaigns, schedules; use authorized provider accounts |
| Team Member | Produce and publish content | Create content; use authorized accounts; view safe account metadata; **no** connect/reconnect/revoke/rotate; **no** audit timeline |
| Future social-account administrator | Administer a provider account on behalf of the workspace | Grant authorization via provider consent flow; not a SocialFlow role today (NOT YET AVAILABLE) |

Note: the target model has two roles (OWNER, MEMBER). "Content Manager" is a persona realized by MEMBER permissions unless the owner approves a third role.

## 8. Current State

**IMPLEMENTED in the base code (verified):** multi-user organizations; scheduled posts with states `QUEUE/PUBLISHED/ERROR/DRAFT`; calendar ("launches"); media library with local or Cloudflare R2 storage; AI helpers (OpenAI, agent/copilot modules); Temporal workflows for publishing and token refresh; 30+ provider modules including `facebook` ("Facebook Page") and Instagram; webhooks, public API (API key), notifications, tags, sets, signatures, autopost, Stripe billing/tiers, analytics modules.

**NOT present (see §0.2):** SocialFlow security model (sessions, GCM encryption, PKCE/state contract, audit), OWNER/MEMBER roles, campaigns entity, FAKE provider, readiness gates, public policy pages, a verifiable test suite.

**Not active (per brief, and consistent with code state):** real Meta OAuth under SocialFlow's security contract, real Page discovery, real publishing, Instagram under SocialFlow, production social credentials, active callback registration.

## 9. Target State

A workspace meeting BR-001…BR-030 (§10) with Facebook Page publishing enabled only after the gates in §16 are independently satisfied.

## 10. Business Requirements

Status refers to the state of the requirement in the inspected code. Priority P0 = required before any real provider activation.

| ID | Requirement | Priority | Status |
|---|---|---|---|
| BR-001 | Users create, edit, schedule and organize social content in a shared workspace | P0 | IMPLEMENTED (base) |
| BR-002 | AI-assisted drafting is available inside content creation | P1 | IMPLEMENTED (base: OpenAI/agent modules); SocialFlow behavior spec PLANNED |
| BR-003 | Media can be uploaded, stored and reused | P0 | IMPLEMENTED (base) |
| BR-004 | Content can be grouped into campaigns | P1 | NOT YET AVAILABLE (no Campaign entity); tags/sets exist |
| BR-005 | Posts have a managed lifecycle (draft, scheduled, published, failed) | P0 | IMPLEMENTED (base: 4 states) |
| BR-006 | Calendar and dashboard give schedule visibility with filtering | P1 | IMPLEMENTED (calendar, base); dashboard filtering REPORTED-UNVERIFIED |
| BR-007 | Multiple users share a workspace with role separation (OWNER/MEMBER) | P0 | PLANNED (base has SUPERADMIN/ADMIN/USER) |
| BR-008 | All authorization decisions are enforced server-side | P0 | PARTIAL (auth middleware re-resolves user from DB; per-role enforcement for provider actions not verified) |
| BR-009 | Workspaces are isolated from each other | P0 | PARTIAL (queries are org-scoped by convention; no isolation test suite) |
| BR-010 | Only OWNER connects, reconnects, revokes provider accounts and rotates credentials | P0 | PLANNED |
| BR-011 | MEMBER may use authorized provider accounts and see safe metadata only | P0 | PLANNED |
| BR-012 | Sessions are server-managed, expiring, rotatable and revocable | P0 | PLANNED |
| BR-013 | Provider credentials are encrypted with authenticated encryption bound to ownership context | P0 | PLANNED |
| BR-014 | Credentials can be revoked and rotated; encryption keys can be rotated | P0 | PLANNED |
| BR-015 | Security-relevant operations produce immutable, secret-free audit events | P0 | NOT YET AVAILABLE |
| BR-016 | OWNER can view a workspace-scoped audit timeline | P1 | NOT YET AVAILABLE |
| BR-017 | Provider integrations sit behind a provider-neutral adapter contract with a deterministic test double (FAKE) | P0 | PARTIAL (adapter interface IMPLEMENTED; FAKE provider and contract tests PLANNED) |
| BR-018 | OAuth connection attempts are bound to session, user, workspace, provider, redirect and scope, use PKCE S256, and are single-use | P0 | PLANNED |
| BR-019 | Real OAuth stays fail-closed until readiness gates are independently verified | P0 | PLANNED |
| BR-020 | Provider permissions follow least privilege and are confirmed with Meta before use | P0 | PLANNED / EXTERNAL DEPENDENCY |
| BR-021 | Public Terms, Privacy, Data Deletion, Support and Status pages exist and are accurate | P0 (Meta prerequisite) | NOT YET AVAILABLE in code (REPORTED-UNVERIFIED) |
| BR-022 | Facebook Page connection and publishing | P0 (target) | BLOCKED |
| BR-023 | Instagram support | — | DEFERRED |
| BR-024 | Publishing is idempotent and failures are reconcilable | P0 | PARTIAL (Temporal workflows, `Errors` model); idempotency guarantees not verified |
| BR-025 | Historical records survive account revocation while publishing via the account is blocked | P0 | PLANNED (base soft-deletes integrations via `deletedAt`; behavior not verified against requirement) |
| BR-026 | Secrets never appear in logs, audit events, API responses or browser state | P0 | PLANNED (not verified in base) |
| BR-027 | Public policy pages use a single canonical support contact with safe fallback | P2 | NOT YET AVAILABLE |
| BR-028 | Requirements are testable with deterministic automated tests | P0 | NOT YET AVAILABLE (no test files found) |
| BR-029 | Account/plan limits support future commercialization | P2 | IMPLEMENTED (base Stripe tiers; unvalidated) |
| BR-030 | Data deletion and retention are defined and honored | P1 | PLANNED |

## 11. Scope

**In scope (Phases 1–4):** content, AI drafting, media, posts, campaigns, scheduling/calendar, dashboard, workspace and roles, provider-account management, secure credentials, audit, public policy pages, provider adapter contract, FAKE provider (development only), Facebook Page integration (gated).

## 12. Out of Scope

Instagram (DEFERRED); any provider other than FAKE and Facebook Page until Phase 5; Meta Ads/Marketing API; messaging inboxes; payments redesign; mobile apps; legal certifications; real Meta calls during documentation or development without gate approval.

## 13. Business Rules

| ID | Rule |
|---|---|
| BRL-01 | Least privilege: request only permissions confirmed necessary by Meta; never add "just in case". |
| BRL-02 | Fail closed: if any readiness gate is false or unknown, OAuth activation is refused. |
| BRL-03 | `META_APP_REVIEW_CONFIRMED` and `META_TEST_ACTOR_CONFIRMED` remain false until independently verified. |
| BRL-04 | Only OWNER may connect/reconnect/revoke accounts or rotate credentials. |
| BRL-05 | All authorization is server-side; client state is never trusted. |
| BRL-06 | No secret is displayed, logged or audited; credentials are never decrypted merely to show metadata. |
| BRL-07 | Audit history is append-only. |
| BRL-08 | FAKE provider is development-only and must be unreachable in production. |
| BRL-09 | The candidate callback URL is not "active" until registration is independently confirmed. |
| BRL-10 | Documentation never claims Meta approval or compliance certification. |

## 14. Security & Governance Requirements

Principles: least privilege, fail closed, server-side authorization, secret minimization, defense in depth, explicit consent, workspace isolation, immutable auditability, deterministic testing, provider abstraction, no implicit trust, no fabricated readiness. Detailed requirements: SEC-001…SEC-020 in FRD §37.

Gap summary against the code (all targets are PLANNED unless stated):

| Area | Code today | Target |
|---|---|---|
| Session | Stateless JWT, no expiry in `signJWT`, cookie `httpOnly; secure; sameSite=none` unless `NOT_SECURED` | Opaque server-side session, expiry, rotation, revocation |
| Credential cipher | AES-256-CBC, key/IV from `JWT_SECRET`, fixed IV | AES-256-GCM, AAD, key versions |
| OAuth state | 6-char `Math.random`; Redis; get-then-del | CSPRNG, hashed, bound, atomic single-use, PKCE S256 |
| Audit | none | append-only secret-free events |
| Roles | SUPERADMIN/ADMIN/USER | OWNER/MEMBER |
| Impersonation | Super-admin impersonation exists in auth middleware | Must be explicitly governed or removed; open question |

## 15. Compliance / Privacy Considerations

- Public Privacy, Terms, Data Deletion, Support pages are Meta-review prerequisites (EXTERNAL DEPENDENCY) and are NOT YET AVAILABLE in the inspected code.
- No legal or compliance approval is claimed. No certification (SOC 2, ISO 27001, etc.) is claimed.
- Personal data in scope (from schema): user email/profile, provider account names/pictures, post content, media. Retention and deletion policy: PLANNED, owner decision required (§25).
- Data sent to third parties: post content/media to providers; prompts to OpenAI for AI drafting (base). Disclosure wording requires legal review.

## 16. Provider Integration Strategy

1. Provider-neutral adapter contract (base `SocialProvider` interface is the starting point).
2. FAKE provider for deterministic development/tests (PLANNED).
3. Facebook Page via Meta as the first real provider (BLOCKED).
4. Instagram DEFERRED.

**Readiness gates (conceptual; PLANNED; none exist in code):**

| Gate | Required value for activation | Current |
|---|---|---|
| INTERNAL_READY | true | Cannot be asserted from this repo |
| OAUTH_READY | true | false |
| OAUTH_BLOCKED | false | true |
| EXTERNAL_META_PENDING | false | true |
| META_APP_CONFIGURED | true | false/pending |
| META_APP_DOMAIN_STATUS | VERIFIED | NOT_VERIFIED |
| META_APP_REVIEW_CONFIRMED | true (independently verified) | false |
| META_TEST_ACTOR_CONFIRMED | true (independently verified) | false |

Candidate callback (NOT active, NOT confirmed registered): `https://socialflow-aetktrkv.manus.space/api/provider-authorization/meta/callback`. App Domain (expected, NOT verified persisted): `socialflow-aetktrkv.manus.space`. These are distinct concepts. Note: the base Facebook provider uses a different redirect (`${FRONTEND_URL}/integrations/social/facebook`), so the candidate callback is not what the code uses today.

## 17. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| RK-01 | Brief and repository diverge; developers assume security features exist | Critical | This BRD's §0.2; code is authoritative |
| RK-02 | Existing Facebook provider can be pointed at real Meta with broader scopes than least privilege | High | Gate activation; reduce scopes after Meta confirmation |
| RK-03 | Weak credential cipher / stateless long-lived JWT | High | BR-012/013 |
| RK-04 | Meta App Domain not persisting; review delays | Medium | Isolated investigation; do not bypass |
| RK-05 | Upstream (Postiz) licence obligations (AGPL-3.0) for a SaaS | High | Legal review (OQ-03) |
| RK-06 | No automated tests; regressions undetected | High | BR-028 |
| RK-07 | Upstream changes (provider API deprecations) | Medium | Pin versions; track upstream |
| RK-08 | Super-admin impersonation bypasses workspace separation | Medium | OQ-06 |

## 18. Dependencies

EXTERNAL DEPENDENCY: Meta App configuration; App Domain persistence; permission availability; Page-task requirements; App Review / Advanced Access; test actor availability; production callback registration; public policy/support requirements. Internal: PostgreSQL, Redis, Temporal, storage provider (local/R2), OpenAI key (AI), hosting domain.

## 19. Assumptions

| ID | Assumption |
|---|---|
| AS-01 | `postiz-app` at `5e8a570` is the intended code base (user-confirmed 2026-10-06). |
| AS-02 | SocialFlow-specific features described in the brief live in a different, unavailable code base or are not yet built. |
| AS-03 | Only one inspected commit is visible (shallow clone); history cannot be consulted. |
| AS-04 | Target role model is exactly OWNER and MEMBER. |
| AS-05 | Support contact and policy text will be supplied by the owner. |

## 20. Constraints

No application code, migrations, environment variables or credentials are changed by this task; no Meta API calls; no OAuth implementation; no numeric SLAs; no certification claims.

## 21. Success Criteria

1. Every P0 BR has PRD and FRD coverage and passing deterministic tests.
2. OAuth remains fail-closed unless every gate is independently verified.
3. A MEMBER cannot perform OWNER-only actions (server-verified by test).
4. No secret appears in logs/audit/responses (verified by test).
5. A Facebook Page post is published only after Phase 3 approval.

## 22. KPIs (indicators only; no targets are invented)

Count of P0 requirements with passing automated tests; number of cross-workspace isolation tests; number of secret-leak tests; percentage of provider actions covered by audit events; count of open EXTERNAL DEPENDENCY items; publish success/failure counts (after Phase 4). Target values to be set by the owner.

## 23. Rollout Strategy

Internal development with FAKE provider → internal security hardening → gated Meta test-actor pilot → limited real publishing → broader availability. Each step requires explicit owner approval.

## 24. Future Roadmap

| Phase | Name | Status |
|---|---|---|
| 1 | Internal MVP | Base scheduler IMPLEMENTED; SocialFlow-specific parts PLANNED |
| 2 | External Provider Readiness | In progress (security model, policy pages, FAKE provider, gates) — PLANNED in this repo |
| 3 | Facebook Page OAuth | BLOCKED pending Meta prerequisites and explicit approval |
| 4 | Real Facebook Page Publishing | PLANNED (after Phase 3) |
| 5 | Additional Providers | PLANNED; Instagram DEFERRED |

## 25. Open Questions

| ID | Question |
|---|---|
| OQ-01 | Where is the code that implements the SocialFlow features in the brief (roles, sessions, GCM, audit, FAKE, policy pages)? Is it a separate repo or unbuilt? |
| OQ-02 | Should the existing Instagram/other providers in the base be disabled for SocialFlow (they contradict "Instagram deferred")? |
| OQ-03 | Is AGPL-3.0 acceptable for the intended SaaS model? (legal review) |
| OQ-04 | Which minimum Facebook permissions does Meta confirm (candidates only: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`)? Are `business_management`, `pages_manage_engagement`, `read_insights` to be removed? |
| OQ-05 | Is the Meta App Domain persisted after reload? |
| OQ-06 | Keep or remove super-admin impersonation? |
| OQ-07 | Data retention and deletion periods? |
| OQ-08 | Should billing/tier gating (Stripe) be retained for SocialFlow? |
| OQ-09 | Final callback URL and its registration status? |
