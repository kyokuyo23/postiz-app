# SocialFlow — Functional Requirements Document (FRD)

| Field | Value |
|---|---|
| Document | FRD.md (companions: BRD.md, PRD.md) |
| Version | 1.0 (baseline draft) |
| Date | 2026-10-06 |
| Code baseline inspected | `kyokuyo23/postiz-app` @ `5e8a570` (Postiz v1.47.0 fork), shallow clone |
| Authority rule | Code is the source of truth over the brief. Status legend and brief-vs-repository table: BRD §0. |

Conventions: each requirement carries a **status**. "Current" describes verified behavior; "Required" describes target behavior. Statements are implementation-neutral unless they cite current code. Requirement IDs: FR-, SEC-, AUTH-, AUD-, META-, NFR-. Traceability: Appendix C.

---

## 1. System Actors

| Actor | Description | Status |
|---|---|---|
| Visitor | Unauthenticated user of public pages | PLANNED (pages not found) |
| User | Authenticated person | IMPLEMENTED |
| OWNER | Workspace role with account/security authority | PLANNED (code: `ADMIN`/`SUPERADMIN`) |
| MEMBER | Workspace role for content work | PLANNED (code: `USER`) |
| Platform super-admin | Code: `User.isSuperAdmin`, can impersonate an org | IMPLEMENTED; governance OQ-06 |
| Scheduler/Orchestrator | Temporal workflows publishing and refreshing tokens | IMPLEMENTED |
| Provider | External platform (FAKE; Facebook Page future) | FAKE PLANNED; Meta BLOCKED |
| Public API client | API-key caller (`/public/v1`) | IMPLEMENTED |

## 2. Authentication / Session Behavior

**Current (IMPLEMENTED):**
- FR-001 Requests authenticate via `auth` header or `auth` cookie holding a JWT signed with `JWT_SECRET`.
- FR-002 The middleware verifies only the signature, then reloads the user by id from the database; claims in the token are not trusted for authorization; inactive (`activated=false`) users are rejected.
- FR-003 The cookie is `httpOnly; secure; sameSite=none` unless `NOT_SECURED` is set.
- FR-004 `signJWT` for sessions sets no expiry (`jsonwebtoken` default); there is no session table, rotation or revocation.
- FR-005 Missing/invalid auth yields a forbidden exception.

**Required (PLANNED):**
- AUTH-001 Sessions are server-managed opaque identifiers stored hashed; the cookie carries only the identifier.
- AUTH-002 Sessions have an absolute and an idle expiry; expired sessions are rejected.
- AUTH-003 Session identifier is rotated on login and on privilege change.
- AUTH-004 Sessions are individually revocable; revoking invalidates immediately; user can revoke all.
- AUTH-005 Cookie is HttpOnly, Secure, with a deliberate SameSite policy; no session secret in JS-readable storage.
- AUTH-006 Authentication failures return non-enumerating errors.

## 3. Workspace Behavior

Current: `Organization` is the workspace; `UserOrganization(userId, organizationId, role, disabled)` is unique per pair; selected workspace comes from `showorg` cookie/header, falling back to the first enabled membership; disabled memberships are excluded.
- FR-006 Every workspace-owned read/write is scoped by workspace id derived server-side from membership, never from a client-supplied owner field. Status: PARTIAL (controllers pass `org` from request; no isolation tests).
- FR-007 A user who is not an enabled member of the selected workspace never resolves into it (currently falls back to another membership; Required: explicit rejection if a specifically requested workspace is not permitted — PLANNED).
- FR-008 Workspace creation assigns the creator OWNER. PLANNED.
- FR-009 A workspace always has at least one OWNER. PLANNED.

## 4. Role Authorization

- AUTH-010 Authorization decisions occur on the server for every protected operation. PARTIAL.
- AUTH-011 MEMBER is denied: connect, reconnect, revoke, credential rotation, audit timeline. PLANNED.
- AUTH-012 OWNER may: manage workspace, connect/reconnect/revoke accounts, rotate credentials, configure FAKE provider, view audit timeline. PLANNED.
- AUTH-013 UI hiding is advisory only; the server enforces independently. PLANNED.
- AUTH-014 Denials return a non-sensitive error and (for security operations) emit an audit event where defined. PLANNED.
- FR-200 Current enforcement: subscription/feature `CheckPolicies` (CASL; sections include `channel`, `ai`, `admin`, `webhooks`, `team_members`), plus admin-role checks in `settings`/`users`/`oauth-app` controllers. No OWNER-only enforcement over integration routes was found. IMPLEMENTED (different model).

## 5. Content Lifecycle

Content = post bodies, per-provider settings, attached media, optional AI draft input.
- FR-010 Content is created in a workspace with creator attribution (`creationMethod`: WEB, MCP, API, AUTOPOST, CLI, UNKNOWN). IMPLEMENTED.
- FR-011 Content may be edited until published; published content is read-only locally (editing a published post is not assumed). Behavior of edits after publish: not verified.
- FR-012 Content validation runs before scheduling (`POST /posts/valid`, provider `checkValidity`, max length). IMPLEMENTED.
- FR-013 Deletion is soft (`deletedAt`) at group level (`DELETE /posts/:group`). IMPLEMENTED.

## 6. Post Lifecycle

States (current enum `State`): `QUEUE`, `PUBLISHED`, `ERROR`, `DRAFT`.

| From | To | Trigger | Status |
|---|---|---|---|
| — | DRAFT | save as draft | IMPLEMENTED |
| — / DRAFT | QUEUE | schedule | IMPLEMENTED |
| QUEUE | PUBLISHED | workflow publish success; `releaseId`/`releaseURL` set | IMPLEMENTED |
| QUEUE | ERROR | publish failure; `error` and `Errors` row | IMPLEMENTED |
| ERROR | QUEUE | retry/reschedule | PARTIAL (not verified) |
| any | deleted | soft delete | IMPLEMENTED |

- FR-020 A post belongs to exactly one workspace and one channel; multi-channel composition produces one post per channel sharing a `group`. IMPLEMENTED.
- FR-021 Threads/comments use `parentPostId`. IMPLEMENTED.
- FR-022 Required (PLANNED): a post whose provider account is revoked or reconnect-required must not be published and must surface a clear state.
- FR-023 Required (PLANNED): an additional "cancelled"/"blocked" outcome is not assumed; blocked publishes are recorded as ERROR with a typed reason (§30).

## 7. Campaign Lifecycle

NOT YET AVAILABLE (no `Campaign` model). Required (PLANNED):
- FR-050 Create/rename/archive campaigns scoped to a workspace.
- FR-051 A post may belong to zero or one campaign (OQ-11).
- FR-052 Archiving or deleting a campaign never deletes posts or history.
- FR-053 Campaign lists show post counts by state.
- FR-054 Campaign operations are workspace-isolated.
- FR-055 Existing `Tags`/`TagsPosts` remain as separate labeling.

## 8. Media Lifecycle

Current: `Media(id, name, originalName, path, organizationId, fileSize, type, thumbnail, alt, deletedAt)`; storage local or Cloudflare R2 (`upload.factory`); routes `/media/upload-server`, generation endpoints, `DELETE /media/:id`.
- FR-040 Upload stores the file and a workspace-owned `Media` row. IMPLEMENTED.
- FR-041 Media is retrievable and attachable only within the owning workspace. PARTIAL (needs test).
- FR-042 Delete is soft; posts referencing deleted media keep their stored reference as-is (behavior not verified).
- FR-043 Upload validation (type/size) exists via `custom.upload.validation`; limits not independently verified.
- FR-044 Required (PLANNED): media URLs do not leak across workspaces.
- FR-045 Required (PLANNED): media referenced by a scheduled post is not silently removed from the publish path.

## 9. Scheduling Lifecycle

- FR-060 A scheduled post stores `publishDate` and enters a publish workflow. IMPLEMENTED.
- FR-061 Date changes via `PUT /posts/:id/date`. IMPLEMENTED.
- FR-062 Suggested slots via `GET /posts/find-slot` and `Integration.postingTimes`. IMPLEMENTED.
- FR-063 Workflows are versioned (`post.workflow.v1.0.1`…`v1.0.5`); a "missing post" workflow exists for reconciliation. IMPLEMENTED.
- FR-064 Required (PLANNED): scheduling is blocked when the target account is not in a publishable state.
- FR-065 Timezone handling: behavior not verified; Required: stored in UTC, displayed in user locale.

## 10. Publishing Lifecycle

Current sequence: schedule → Temporal workflow → provider `post()` through the adapter → success sets `PUBLISHED` and release identifiers; failure sets `ERROR` and records `Errors`; provider `handleErrors` classifies `refresh-token` and `bad-body`.
- FR-070 Publishing runs only via an authorized, non-revoked, non-disabled account. PARTIAL (disabled/deleted respected in refresh workflow; revocation concept PLANNED).
- FR-071 Each publish attempt is recorded (`PublishingAttempt` concept; code: `Errors` for failures, `Post.error`). PARTIAL.
- FR-072 No real Facebook publish occurs while any readiness gate is false. PLANNED (fail-closed).
- FR-073 Publish responses expose no tokens. PLANNED verification.

## 11. Provider Account Lifecycle

Concept states (PLANNED): `PENDING_AUTHORIZATION → CONNECTED → RECONNECT_REQUIRED → REVOKED`; plus `DISABLED`. Current fields: `disabled`, `deletedAt`, `refreshNeeded`, `inBetweenSteps` on `Integration`.
- FR-210 Connect: OWNER only; begins an authorization attempt (§29). PLANNED.
- FR-211 Reconnect: OWNER only; same safeguards. PLANNED.
- FR-212 Revoke: OWNER only; credentials invalidated; publishing blocked; history retained. PLANNED.
- FR-213 MEMBER sees safe metadata only (name, provider, status, picture). PLANNED.
- FR-214 Account list/metadata never triggers credential decryption. PLANNED.
- FR-215 Enabling/disabling an account is OWNER only. PLANNED (current routes `POST /integrations/disable|enable`, `DELETE /integrations` are org-scoped without role check).

## 12. Credential Lifecycle

States (PLANNED): `ACTIVE → ROTATED(prior version superseded) → REVOKED`; with `key_version` attribute.
- FR-220 Credentials are created only on a successful, validated authorization attempt. PLANNED.
- FR-221 One active credential per provider account. PLANNED.
- FR-222 Revoked/rotated credentials are unusable. PLANNED.
- FR-223 Credential material is never returned by any API. PLANNED.
Current: tokens live in `Integration.token` / `refreshToken` / `tokenExpiration`; a refresh workflow refreshes ahead of expiry. Encryption at rest not verified.

## 13. Credential Encryption

- SEC-010 AES-256-GCM, server-side only. PLANNED (current helper: AES-256-CBC, key+IV derived from `JWT_SECRET` via EVP_BytesToKey/MD5 with fixed IV, no authentication, no AAD).
- SEC-011 Unique random nonce per encryption. PLANNED.
- SEC-012 AAD binds workspace id and provider-account id (and credential purpose); decrypt fails on mismatch. PLANNED.
- SEC-013 Ciphertext records `key_version`. PLANNED.
- SEC-014 Encryption keys are separate from `JWT_SECRET` and never logged. PLANNED.
- SEC-015 Decryption is performed only at the moment a provider call needs the secret, in server memory. PLANNED.

## 14. Credential Rotation

- FR-230 OWNER-initiated credential rotation replaces the stored credential after provider re-authorization or refresh; the previous credential is invalidated. PLANNED.
- FR-231 Encryption-key rotation re-encrypts credentials under a new `key_version` without service interruption; old versions decryptable until migration completes. PLANNED.
- FR-232 Rotation emits `CREDENTIAL_ROTATED` (§16). PLANNED.
- FR-233 Failure mid-rotation leaves the prior credential intact (atomic). PLANNED.

## 15. Credential Revocation

- FR-240 OWNER revokes an account; server marks it REVOKED, deletes/zeroizes credential material, blocks publishing, preserves posts and audit history. PLANNED.
- FR-241 Revocation is idempotent. PLANNED.
- FR-242 Where the provider supports token revocation, a best-effort call is made only when the integration is active and permitted; local revocation is never contingent on its success. PLANNED (no external call during documentation/dev under current gates).

## 16. Audit Event Lifecycle

Status: NOT YET AVAILABLE in inspected code. All events below are **PLANNED**.

| Event | Trigger |
|---|---|
| ACCOUNT_CONNECTION_STARTED | OWNER starts an authorization attempt |
| ACCOUNT_CONNECTION_COMPLETED | Attempt consumed successfully, account stored |
| ACCOUNT_CONNECTION_FAILED | Attempt failed (typed reason, no secrets) |
| ACCOUNT_RECONNECTION_STARTED / COMPLETED / FAILED | Reconnect equivalents |
| ACCOUNT_REVOKED | OWNER revokes |
| CREDENTIAL_ROTATED | Credential or key-version rotation |

- AUD-001 Events are immutable and append-only (no update/delete path).
- AUD-002 Events are workspace-scoped.
- AUD-003 Events record actor (user id / system), action, target ids, timestamp, outcome, typed reason.
- AUD-004 Events never contain tokens, codes, verifiers, secrets, keys, raw provider responses.
- AUD-005 Audit write failure for a security operation must not be silently ignored (fail-closed or explicit alert; OQ-14).

## 17. Audit Timeline

- AUD-010 OWNER-only, workspace-scoped, paginated, newest-first, filterable by event type and date. PLANNED.
- AUD-011 MEMBER and cross-workspace requests are rejected server-side. PLANNED.
- AUD-012 Timeline responses contain only audit-safe fields. PLANNED.

## 18. AI Drafting Interaction

Current: `POST /posts/generator/draft`, `POST /posts/generator`, copilot controller guarded by `CheckPolicies(Create, AI)`, OpenAI service.
- FR-100 AI output is returned as editable draft text; it never publishes. Required; current publish path is separate. IMPLEMENTED (separation) / verification PLANNED.
- FR-101 The request is scoped to the caller's workspace. IMPLEMENTED (org from request).
- FR-102 AI prompts must not include credentials or audit data. PLANNED.
- FR-103 Failures return a non-technical error and leave existing content untouched. PLANNED verification.
- FR-104 Disclosure that prompts go to a third-party model appears in Privacy page. PLANNED.

## 19. Dashboard Filtering

REPORTED-UNVERIFIED. Required (PLANNED):
- FR-110 Filter posts by state, campaign, channel, date range.
- FR-111 Counts reflect the same filter and workspace.
- FR-112 Filters are server-validated; invalid input yields a validation error.
- FR-113 Filters never include other workspaces' data.

## 20. Public Pages

NOT YET AVAILABLE (no routes found; only `GET /monitor/queue/:name` for ops).
- FR-500 Public, unauthenticated pages: Terms, Privacy, Data Deletion, Support, Status.
- FR-501 A single canonical support-contact resolver supplies the contact to all pages.
- FR-502 If the contact configuration is absent/invalid, a safe fallback is displayed.
- FR-503 Pages contain no secrets and no workspace data.
- FR-504 Pages state only verified facts; no claim of Meta approval or certification.
- FR-505 Data Deletion page describes how a user requests deletion and what is deleted.

## 21. Provider Adapter Contract

Current interface (`SocialProvider`, abstract `SocialAbstract`): `identifier`, `name`, `scopes`, `generateAuthUrl()`, `authenticate()`, `refreshToken()`, `reConnect()`, `post()`, optional analytics, `checkValidity()`, `maxLength()`, `handleErrors()`, `maxConcurrentJob`. IMPLEMENTED.
Required additional contract (PLANNED):
- FR-300 Adapters never receive or return raw secrets across the neutral boundary except inside the credential service.
- FR-301 Adapters declare scopes; scope policy is enforced by a central least-privilege check (META-004).
- FR-302 Adapter errors map to the failure taxonomy (§30).
- FR-303 Every adapter passes a shared contract test suite (§38).
- FR-304 Adapter registry exposes only providers enabled for the environment.

## 22. FAKE Provider

PLANNED (not found).
- FR-330 Deterministic; no network calls; configurable outcomes (success, transient failure, permanent failure, invalid-token).
- FR-331 OWNER-configurable; development/test only; unreachable in production configuration.
- FR-332 Implements the same contract as real adapters and is the reference for contract tests.
- FR-333 Produces deterministic fake identifiers; contains no real secrets.

## 23. Future Meta Provider (Facebook Page)

BLOCKED. No Meta call, Page discovery, or publishing is enabled. Code today contains a live `FacebookProvider` (Graph API v20.0 dialog; `identifier='facebook'`, `isBetweenSteps=true`; Page selection after OAuth) that must be gated or isolated before external exposure.
- META-001 Facebook Page is the only first real provider target; Instagram is DEFERRED.
- META-002 Page discovery and publish occur only after §24 gates pass.
- META-003 Posting uses a Page access token obtained under the approved flow; user tokens are not retained beyond need (to be defined with Meta guidance).
- META-004 Scopes: request only Meta-confirmed minimum. Candidates (**REQUIRES META CONFIRMATION, not approved**): `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. Current code additionally requests `business_management`, `pages_manage_engagement`, `read_insights` → conflict, to be removed unless justified.
- META-005 Page-task requirements must be confirmed with Meta. EXTERNAL DEPENDENCY.
- META-006 App Review / Advanced Access status must be independently verified. EXTERNAL DEPENDENCY.
- META-007 Test actor availability verified independently. EXTERNAL DEPENDENCY.
- META-008 Public policy/support pages live before activation.
- META-009 App Domain (`socialflow-aetktrkv.manus.space`, `META_APP_DOMAIN_STATUS = NOT_VERIFIED`) and Callback URI (`https://socialflow-aetktrkv.manus.space/api/provider-authorization/meta/callback`, candidate, unregistered/unconfirmed) are separate settings, each verified separately. Current code uses `${FRONTEND_URL}/integrations/social/facebook` (OQ-09).

## 24. OAuth Security Contract

Readiness gates (PLANNED; none exist in code). Activation requires all:

| Gate | Required | Current |
|---|---|---|
| INTERNAL_READY | true | Not assertable from this repo |
| OAUTH_READY | true | false |
| OAUTH_BLOCKED | false | true |
| EXTERNAL_META_PENDING | false | true |
| META_APP_CONFIGURED | true | false/pending |
| META_APP_DOMAIN_STATUS | VERIFIED | NOT_VERIFIED |
| META_APP_REVIEW_CONFIRMED | true, independently verified | false |
| META_TEST_ACTOR_CONFIRMED | true, independently verified | false |

- SEC-001 Gates fail closed: missing/unknown/false → refuse.
- SEC-002 Gate values cannot be set from client input.
- SEC-003 `META_APP_REVIEW_CONFIRMED` and `META_TEST_ACTOR_CONFIRMED` change to true only on independent verification.
- SEC-004 No gate bypass for convenience, testing, or demos in production.
- SEC-005 Refusals return a safe reason and (when role-permitted) are auditable.
- SEC-006 Authorization codes, access/refresh tokens, PKCE verifier, provider secrets, encryption keys never appear in browser state, logs, audit events or API responses. (Current: `generateAuthUrl` returns a `codeVerifier` that is stored in Redis; it is not sent to the browser per the controller, but the "verifier" is 10 random chars and not used for S256.)
- SEC-007 Server-only authorization-code exchange interface; the browser never handles the code beyond the redirect.

## 25. PKCE

- SEC-020 PKCE with `S256` is mandatory for connect flows where the provider supports it (Meta support to be confirmed; if not supported, the attempt still uses state binding and the limitation is documented).
- SEC-021 `code_verifier` is generated with a cryptographically secure RNG, 43–128 characters (RFC 7636), stored server-side only, never logged.
- SEC-022 `code_challenge = BASE64URL(SHA256(verifier))` sent; `plain` is not allowed.
- SEC-023 Verifier is used once, then destroyed with the attempt.
Current: not implemented (`makeId(10)` via `Math.random`, no challenge sent).

## 26. State Validation

- SEC-030 State is cryptographically random (CSPRNG), opaque, ≥128 bits.
- SEC-031 Only a hash of state is stored server-side.
- SEC-032 State is bound to session, user, workspace, provider, redirect URI, requested scope and verifier.
- SEC-033 State is single-use, expiration-protected, replay-protected.
- SEC-034 State mismatch, unknown, expired, consumed → refuse, typed failure, no detail leak.
Current: `makeId(6)` (62^6 values, `Math.random`), Redis keys `login:`, `organization:`, `redirect:`, etc. with 1 h TTL; lookups keyed by raw state; not bound to session; delete-after-read not atomic.

## 27. Redirect Validation

- SEC-040 Redirect URI is taken from server configuration, never client input.
- SEC-041 Callback exact-matches the redirect URI recorded in the attempt.
- SEC-042 Post-login "return to" targets are allow-listed relative paths only (no open redirect).
- SEC-043 Redirect URI registration at provider is verified, not assumed (META-009).

## 28. Scope Validation

- SEC-050 Requested scope is recorded on the attempt.
- SEC-051 Requested scope ⊆ approved scope policy (META-004).
- SEC-052 Granted scope is compared with requested; if required scopes are missing, the attempt fails with `SCOPE_INSUFFICIENT` (typed) — current code: `checkScopes` exists on providers.
- SEC-053 Extra granted scope beyond requested is not accepted silently (fail or record and warn per policy; OQ-15).

## 29. Authorization Attempt Lifecycle

Entity `AuthorizationAttempt` is NOT YET AVAILABLE (conceptual only).

States: `CREATED → CONSUMING → COMPLETED | FAILED | EXPIRED | REVOKED`.

- AUTH-020 Creation requires OWNER, all gates true, and records: session id, user id, workspace id, provider, redirect URI, requested scope, state hash, PKCE verifier (server-side protected), creation and expiry time.
- AUTH-021 Callback validates in order: gates → state lookup (hash) → not expired → not consumed → session/user/workspace binding → provider → redirect → scope → code present.
- AUTH-022 Consumption is atomic compare-and-set (`CREATED → CONSUMING`); exactly one concurrent callback can succeed; others receive `ATTEMPT_ALREADY_CONSUMED`.
- AUTH-023 After provider exchange, the attempt moves to `COMPLETED` or `FAILED`; terminal states are final.
- AUTH-024 Expired attempts are rejected and eligible for cleanup; cleanup removes verifier material.
- AUTH-025 Each transition emits the matching audit event (§16) without secrets.
- AUTH-026 Authorization-code exchange is a server-only interface; in the current readiness state it must return a "not enabled" failure without any outbound call. PLANNED.

## 30. Failure Taxonomy

PLANNED, typed, non-secret:

| Code | Meaning | Retryable |
|---|---|---|
| GATE_NOT_READY | Readiness gate false/unknown | No |
| FORBIDDEN_ROLE | Caller lacks role | No |
| WORKSPACE_MISMATCH | Binding failed | No |
| STATE_INVALID / STATE_EXPIRED / STATE_REPLAYED | State problems | No (new attempt) |
| ATTEMPT_ALREADY_CONSUMED | Concurrent/replayed callback | No |
| REDIRECT_MISMATCH | Redirect binding failed | No |
| SCOPE_INSUFFICIENT / SCOPE_EXCESS | Scope check failed | No |
| PROVIDER_DENIED | User declined consent | No |
| PROVIDER_ERROR_TRANSIENT | Network/5xx/rate limit | Yes |
| PROVIDER_ERROR_PERMANENT | 4xx non-auth | No |
| TOKEN_INVALID | Token rejected → reconnect-required | After reconnect |
| ACCOUNT_REVOKED | Revoked connection | No |
| VALIDATION_FAILED | Content fails provider rules | After edit |
| INTERNAL_ERROR | Unexpected | Maybe |

Current partial analogue: provider `handleErrors` → `refresh-token` / `bad-body`.

## 31. Idempotency

- FR-400 Revoke, rotate and callback-consumption operations are idempotent or safely rejected on repeat.
- FR-401 Each publish attempt carries an idempotency key (post id + attempt number) so retries cannot double-post; verification against the provider response uses `releaseId` where available. PARTIAL (workflows exist; guarantees not verified).
- FR-402 Duplicate scheduling submissions for the same group do not create duplicate posts. Not verified.
- FR-403 Webhook/callback replays are harmless.

## 32. Retry / Reconciliation

Current: Temporal activity retries (e.g., token refresh: 3 attempts, 2-minute interval, 10-minute timeout); `missing.post.workflow`; `GET /posts/:id/missing`, `PUT /posts/:id/release-id` for manual reconciliation. IMPLEMENTED.
- FR-410 Retries apply only to retryable failure types (§30). PLANNED.
- FR-411 A post that may have published (timeout after submit) is reconciled before any re-publish. PARTIAL.
- FR-412 Reconciliation never invents a release id. PLANNED.
- FR-413 Token-refresh failure marks `refreshNeeded`; publish is blocked until reconnect. IMPLEMENTED (flag exists).

## 33. Cross-Workspace Isolation

- FR-700 All repositories filter by workspace id derived from the authenticated membership.
- FR-701 Object ids from the client are always re-checked against the workspace.
- FR-702 Foreign ids return not-found/forbidden with identical shape (no existence leak).
- FR-703 Super-admin impersonation is explicit, logged, and time-bounded, or removed (OQ-06). Current: impersonation via `impersonate` cookie/header for `isSuperAdmin`, no audit.
- FR-704 Isolation covers posts, media, accounts, credentials, campaigns, audit, AI history. Test coverage NOT YET AVAILABLE.
- FR-710 Instagram and other non-target providers are unreachable for SocialFlow workspaces until approved. PLANNED (DEFERRED).

## 34. Error States

| State | Behavior |
|---|---|
| Unauthenticated | Forbidden; no detail |
| Unauthorized role | Forbidden; audit where defined |
| Validation failure | Field-level safe messages |
| Provider down | Transient failure; retry per §32 |
| Reconnect required | Account flagged; publishing blocked; OWNER notified |
| Gate not ready | `GATE_NOT_READY`; no outbound call |
| Storage failure | Upload error; no orphan DB row |
| AI failure | Safe error; content intact |

## 35. API Boundaries

Observed route groups (IMPLEMENTED): `/auth`, `/user(s)`, `/integrations`, `/posts`, `/media`, `/analytics`, `/copilot`, `/settings`, `/notifications`, `/webhooks`, `/sets`, `/signatures`, `/autopost`, `/third-party`, `/billing`, `/monitor`, `/public/v1` (API key), OAuth app endpoints (Postiz acting as OAuth provider — not the SocialFlow provider-authorization contract).
Required boundaries (PLANNED):
- FR-600 Browser-facing APIs return safe DTOs only (no credential fields).
- FR-601 Provider-authorization endpoints live under a dedicated path (candidate `/api/provider-authorization/meta/callback`) and are inert while gates are false.
- FR-602 Server-only interfaces (code exchange, decryption) are not routable.
- FR-603 Public API keys are workspace-scoped and cannot perform OWNER-only operations. (Current: `Organization.apiKey` is auto-generated per org.)

## 36. Data Validation

Current: class-validator DTOs per provider and per route; custom upload validation.
- FR-610 All inputs validated server-side (type, length, enum, id format).
- FR-611 Scheduled date must be a valid future instant (except drafts).
- FR-612 Media type/size checks before storage.
- FR-613 Callback parameters validated before any lookup; unexpected parameters ignored.
- FR-614 Free-text fields are length-limited and rendered escaped.

## 37. Security Requirements

| ID | Requirement | Status |
|---|---|---|
| SEC-001 | Gates fail closed (see §24) | PLANNED |
| SEC-002 | Gate values are server-controlled | PLANNED |
| SEC-003 | Review/test-actor flags only true after independent verification | PLANNED |
| SEC-004 | No gate bypass | PLANNED |
| SEC-005 | Safe, auditable refusals | PLANNED |
| SEC-006 | No secrets in browser/logs/audit/API | PLANNED (not verified in base) |
| SEC-007 | Server-only code exchange | PLANNED |
| SEC-008 | Server-side authorization everywhere | PARTIAL |
| SEC-009 | Workspace isolation tested | PLANNED |
| SEC-010–015 | Credential encryption (§13) | PLANNED |
| SEC-016 | Credentials never decrypted to render metadata | PLANNED |
| SEC-017 | Logs sanitized by allow-list/redaction | PLANNED |
| SEC-018 | Secrets in environment/secret store, not in repo or client bundle | Not verified |
| SEC-019 | Dependency and config review before external activation | PLANNED |
| SEC-020 | PKCE S256 / state / redirect / scope (§25–§28) | PLANNED |
| SEC-021 | Cookies HttpOnly+Secure; no `NOT_SECURED` in production | PARTIAL |
| SEC-022 | Rate limiting on auth and callback endpoints | Not verified |

Principles: least privilege; fail closed; server-side authorization; secret minimization; defense in depth; explicit consent; workspace isolation; immutable auditability; deterministic testing; provider abstraction; no implicit trust; no fabricated readiness.

## 38. Test Requirements

Current baseline: no `*.spec.*`/`*.test.*` files found; Jest is configured at root (`pnpm test`); brief's "81+" tests and TypeScript/build/E2E passes are **unverified here**; no count is asserted.

| ID | Requirement |
|---|---|
| TST-001 | Unit tests for role authorization (OWNER vs MEMBER) on every provider-account and audit route. |
| TST-002 | Cross-workspace isolation tests for posts, media, accounts, campaigns, audit. |
| TST-003 | Session tests: expiry, rotation, revocation, cookie flags. |
| TST-004 | Crypto tests: GCM round-trip, tamper detection, AAD mismatch, key-version rotation. |
| TST-005 | Attempt tests: state single-use, expiry, replay, binding mismatches, concurrent callbacks (exactly one success). |
| TST-006 | PKCE tests: S256 challenge derivation, verifier length/charset. |
| TST-007 | Gate tests: any false/unknown gate → refusal, no outbound call. |
| TST-008 | Secret-leak tests: logs, audit events, API responses contain no secret patterns. |
| TST-009 | Provider contract suite run against FAKE and every adapter. |
| TST-010 | Audit tests: append-only, secret-free, OWNER-only timeline. |
| TST-011 | Lifecycle tests: revoke blocks publish, history retained. |
| TST-012 | Browser E2E and responsive checks for P0 flows. |
| TST-013 | Deterministic: no network, fixed clock/random seeds where needed. |

---

## NFR — Non-Functional Requirements

No numeric SLA, uptime, latency or capacity guarantee is defined or implied; targets are to be set by the owner.

| ID | Area | Requirement | Status |
|---|---|---|---|
| NFR-001 | Security | See §37 | PLANNED/PARTIAL |
| NFR-002 | Privacy | Data minimization; disclosure; deletion path | PLANNED |
| NFR-003 | Availability | Publishing continues across API restarts via durable workflows | IMPLEMENTED (Temporal); no availability figure |
| NFR-004 | Performance | Defined targets TBD by owner; no numbers asserted | OPEN |
| NFR-005 | Scalability | Stateless API, queued jobs, per-provider concurrency caps (`maxConcurrentJob`) | IMPLEMENTED (base) |
| NFR-006 | Maintainability | Controller→Service→Repository layering; shared libs; typed DTOs | IMPLEMENTED (convention) |
| NFR-007 | Observability | Structured, secret-free logs; error records; monitor route | PARTIAL |
| NFR-008 | Data integrity | FK relations, unique constraints, soft deletes; atomic state transitions for attempts | PARTIAL |
| NFR-009 | Idempotency | See §31 | PARTIAL |
| NFR-010 | Auditability | See §16–§17 | NOT YET AVAILABLE |
| NFR-011 | Accessibility | Target level TBD (OQ-12) | PLANNED |
| NFR-012 | Responsive | Desktop + mobile for P0/P1 screens | PLANNED verification |
| NFR-013 | Disaster recovery | Considerations only: database backups and restore tests, object-storage durability, key backup/escrow separate from data, documented runbook; no RTO/RPO values defined | OPEN |

---

## Appendix A — Implementation Evidence (inspected, `5e8a570`)

| Area | Evidence (path) | Finding |
|---|---|---|
| Auth middleware | `apps/backend/src/services/auth/auth.middleware.ts` | JWT verify, DB reload, `activated` check, `showorg`, impersonation |
| JWT/crypto helper | `libraries/helpers/src/auth/auth.service.ts` | bcrypt hashing; `jsonwebtoken` sign/verify; AES-256-CBC legacy helper from `JWT_SECRET` |
| Session signing | `apps/backend/src/services/auth/auth.service.ts` | `signJWT(user)` — no expiry option |
| OAuth connect | `apps/backend/src/api/routes/integrations.controller.ts` (~L226–250) | state-keyed Redis entries, 3600 s TTL |
| State generation | `libraries/nestjs-libraries/src/services/make.is.ts` | `Math.random` based `makeId` |
| Facebook provider | `.../integrations/social/facebook.provider.ts` | 6 scopes; Graph v20.0 dialog; no PKCE challenge |
| Provider interface | `.../integrations/social/social.integrations.interface.ts` | `SocialProvider` contract |
| Providers present | `.../integrations/social/*.provider.ts` | ~35 incl. instagram, threads |
| Permissions | `apps/backend/src/services/auth/permissions/*` | CASL, subscription sections |
| Schema | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` | `Organization`, `UserOrganization`, `Integration`, `Post`, `Media`, `Errors`, `Tags`, `OAuthApp`, `OAuthAuthorization`; enums `Role`, `State`, `CreationMethod` |
| Workflows | `apps/orchestrator/src/workflows/*` | post v1.0.1–v1.0.5, refresh token, missing post, autopost |
| Storage | `libraries/nestjs-libraries/src/upload/*` | local, Cloudflare R2 |
| AI | `libraries/nestjs-libraries/src/openai/*`, `copilot.controller.ts`, `posts.controller.ts` | OpenAI, generator/draft |
| Tests | repo-wide search | none found |
| Not found | repo-wide search | audit, FAKE provider, readiness gates, policy pages, Campaign, OWNER/MEMBER, `manus.space`, "SocialFlow" |

Limitations: shallow clone (single commit), no runtime execution, no database inspection, token-at-rest encryption in `Integration` not traced end-to-end, dashboard/calendar UI not exhaustively reviewed.

## Appendix B — Conceptual Data Model

"Verified" = exists in schema at `5e8a570`. "Conceptual" = required by this document, no schema support found. No column is asserted beyond what is listed as verified.

| Entity | Verified (code) | Conceptual (SocialFlow target) |
|---|---|---|
| User | `User` (id, email, password hash, `activated`, `isSuperAdmin`, provider enum) | — |
| Workspace | `Organization` (id, `apiKey`, …) | Workspace naming/ownership invariant |
| WorkspaceMembership | `UserOrganization` (userId, organizationId, `role` SUPERADMIN/ADMIN/USER, `disabled`) | role OWNER/MEMBER |
| Session | none (stateless JWT) | opaque id hash, expiries, revoked-at, rotation lineage |
| Post | `Post` (state, publishDate, organizationId, integrationId, content, group, releaseId/URL, error, soft delete) | campaign reference, publish idempotency key |
| Campaign | none | name, status, relation to posts |
| MediaAsset | `Media` | integrity/ownership checks |
| SocialAccount | `Integration` (acts as account) | provider-neutral status model |
| Destination | Page/channel concept inside `Integration`/provider (`internalId`, `rootInternalId`) | explicit entity (Page id, type) |
| ProviderAccount | `Integration` (`providerIdentifier`, `disabled`, `deletedAt`, `refreshNeeded`) | status enum CONNECTED/RECONNECT_REQUIRED/REVOKED |
| Credential | `Integration.token`, `refreshToken`, `tokenExpiration` (plain `String` columns) | ciphertext, nonce, `key_version`, AAD context, state |
| AuthorizationAttempt | none (Redis keys by state in code) | session/user/workspace/provider/redirect/scope/state-hash/verifier/state/expiry |
| AuditEvent | none | append-only event with actor, action, target, outcome, reason |
| PublishingAttempt | partial: `Errors` (message, platform, postId, body) | per-attempt record with idempotency key and outcome |

## Appendix C — Requirements Traceability Matrix

| BR | PR | FR / functional | Security / NFR | Acceptance criteria | Status |
|---|---|---|---|---|---|
| BR-001 | PR-001, PR-004, PR-006 | FR-010–FR-013, FR-020–FR-023, FR-060–FR-065 | NFR-003, NFR-008 | PRD §9, §12, §14 | IMPLEMENTED (base) |
| BR-002 | PR-002 | FR-100–FR-104 | SEC-006, NFR-002 | PRD §10 | IMPLEMENTED (base) |
| BR-003 | PR-003 | FR-040–FR-045 | NFR-008, SEC-009 | PRD §11 | IMPLEMENTED (base); isolation PLANNED test |
| BR-004 | PR-005 | FR-050–FR-055 | — | PRD §13 | NOT YET AVAILABLE |
| BR-005 | PR-004 | FR-020–FR-023, FR-070–FR-073 | NFR-009 | PRD §12 | IMPLEMENTED (base) |
| BR-006 | PR-006, PR-007 | FR-060–FR-065, FR-110–FR-113 | — | PRD §14, §15 | Calendar IMPLEMENTED; dashboard UNVERIFIED |
| BR-007 | PR-008, PR-009 | FR-006–FR-009, AUTH-010–014, FR-200 | SEC-008 | PRD §16, §32 | PLANNED |
| BR-008 | PR-009 | AUTH-010–014 | SEC-008 | PRD §32, §36 | PARTIAL |
| BR-009 | PR-008 | FR-700–FR-704 | SEC-009, TST-002 | PRD §36 | PARTIAL |
| BR-010 | PR-011 | FR-210–FR-215, AUTH-011–012 | SEC-008 | PRD §17 | PLANNED |
| BR-011 | PR-011 | FR-213–FR-214 | SEC-016 | PRD §17 | PLANNED |
| BR-012 | PR-010 | AUTH-001–006, FR-001–FR-005 | SEC-021 | PRD §32 (PR-010) | PLANNED |
| BR-013 | PR-012 | FR-220–FR-223, SEC-010–015 | SEC-010–SEC-016 | PRD §18 | PLANNED |
| BR-014 | PR-012 | FR-230–FR-233, FR-240–FR-242 | SEC-013, TST-004 | PRD §18 | PLANNED |
| BR-015 | PR-013 | AUD-001–005, §16 | NFR-010, SEC-006 | PRD §19 | NOT YET AVAILABLE |
| BR-016 | PR-013 | AUD-010–012 | AUD-011 | PRD §19, §36 | NOT YET AVAILABLE |
| BR-017 | PR-014, PR-019 | FR-300–FR-304, FR-330–FR-333 | NFR-006, TST-009 | PRD §21 | PARTIAL |
| BR-018 | PR-015 | AUTH-020–026, SEC-020–053 | SEC-020, TST-005, TST-006 | PRD §22, §36 | PLANNED |
| BR-019 | PR-015, PR-018 | §24 SEC-001–007 | SEC-001–SEC-005, TST-007 | PRD §22, §36 | PLANNED |
| BR-020 | PR-016 | META-004–META-007 | SEC-051 | PRD §22 | PLANNED / EXTERNAL DEPENDENCY |
| BR-021 | PR-017 | FR-500–FR-505, META-008 | NFR-002 | PRD §20 | NOT YET AVAILABLE |
| BR-022 | PR-018 | META-001–META-009 | SEC-001–SEC-007 | PRD §22 | BLOCKED |
| BR-023 | PR-020 | FR-710 | — | PRD §23 | DEFERRED |
| BR-024 | PR-004 | FR-400–FR-403, FR-410–FR-413, FR-071 | NFR-009 | PRD §12, §28 | PARTIAL |
| BR-025 | PR-011 | FR-212, FR-240–FR-242, FR-022 | TST-011 | PRD §17, §36 | PLANNED |
| BR-026 | PR-012, PR-013 | SEC-006, AUD-004, FR-223, FR-600 | SEC-006, SEC-017, TST-008 | PRD §36 | PLANNED |
| BR-027 | PR-017 | FR-501–FR-502 | — | PRD §20 | NOT YET AVAILABLE |
| BR-028 | all | §38 TST-001–TST-013 | NFR-006 | PRD §36 | NOT YET AVAILABLE |
| BR-029 | PR-008 | FR-200 (subscription `CheckPolicies`) | — | — | IMPLEMENTED (base); unvalidated |
| BR-030 | PR-017 | FR-505 | NFR-002 | PRD §31 | PLANNED |

## Appendix D — Additional Open Questions (FRD-specific; BRD/PRD IDs unchanged)

| ID | Question |
|---|---|
| OQ-14 | If an audit write fails during a security operation, should the operation be aborted? |
| OQ-15 | If the provider grants more scope than requested, fail or accept-and-warn? |
| OQ-16 | Does Meta support PKCE for the Facebook Login flow used here? (Confirm in current Meta documentation.) |
| OQ-17 | Does the base encrypt `Integration.token`/`refreshToken` at rest anywhere outside the traced path? |
