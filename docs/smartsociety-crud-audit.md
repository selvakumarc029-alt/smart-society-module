# SmartSociety CRUD and dashboard audit — 10 October 2026

## Verified changes

- Resident complaint progress uses saved society complaint status and resolution notes. Removed the hardcoded AC/Kumar spotlight, sample complaint rows, automatic fake technician names, and browser-local sample complaint overlays.
- Maintenance worker dashboard now includes a real maintenance-team complaint queue. In Progress and Resolved actions await the saved PATCH response; worker notes become visible to the owning resident on the 15-second refresh.
- Workers cannot update complaints that have not been routed to the maintenance team. Residents cannot submit worker progress updates.
- Dashboard API requests can use the JWT for the role signed into that tab, avoiding another role's shared browser session replacing authorization. Fresh sign-in is required for tabs opened before token storage was added.
- Failed payment saves do not mark invoices paid. Real transaction references are required.
- Maintenance requests require an actual authenticated account and tenant access; fake fallback resident accounts and flat details were removed. Unknown request categories are rejected.
- Security initialization no longer references the removed QR scanner button.
- Demo account seeding defaults to disabled. Existing database records were not deleted.

## Passing checks

- 90 Node dashboard regression checks.
- Worker registration/request/complaint integration: 12 tests passed. Includes worker-save/resident-read complaint progress, unassigned-worker denial, resident-update denial, tenant isolation, real registration/login, catalogue token isolation, persisted profile fields, blocked worker self-promotion, persisted superadmin settings, and residents awaiting apartment assignment.
- Auto assignment: 15 tests passed; authenticated maintenance requests: 4 passed; service order progress: 5 passed; maintenance actor boundaries: 5 passed.
- Saved maintenance progress: 3 tests passed.
- Assigned service ticket controller: 9 tests passed.
- Society record CRUD: 5 tests passed.
- Security console: 10 tests passed.
- Latest focused run also passed 4 maintenance actor-boundary checks, 3 security hardening checks, 7 admin insights checks, 8 invoice checks, and the attendance integration checks.

## Additional repairs during the audit

- SmartSociety dashboard routes now require an authenticated account; opening a dashboard URL cannot manufacture a signed-in role.
- Maintenance profile and superadmin configuration saves wait for real successful backend responses. Removed browser-only success reporting.
- Admin worker creation uses supplied email/password credentials and persists before showing success; worker removal uses saved version checks and deactivation.
- Emergency dispatch accepts both AVAILABLE and IDLE ready partners, and repeated dispatch calls preserve active offers and accepted work.
- The resident header Chat button opens saved conversations. Removed sample thread cards, fake initial conversation selection, hardcoded sender identity and fake fallback worker names from chat loading. Failed message saves preserve entered text.
- Static inventory found 380 dashboard controls. Inventory coverage is not proof that all 380 controls have passed live interaction checks.

## Live verification and remaining coverage

Chrome verification on the isolated audit instance opened all fourteen society-admin sidebar sections successfully, with no console errors during that check. Empty gate and chat screens show no fabricated gates or conversations. The resident fake spotlight was visibly removed.

The whole-product button audit is not complete. The broad Java run reported 56 failures and 2 errors out of 216 tests before the latest focused fixes; some assertions expect sections the user requested removed or use session flags without authentication, while emergency dispatch and other workflows still require investigation. Focused passing checks must not be represented as every button or every CRUD path passing. This broad run has not yet been reconciled after the focused repairs.

The user is editing PropertyDirect on port 8080. The opt-in, disposable H2 audit instance runs on port 8081; the harness does not connect to the live database. Startup hit a Windows Java local socket error; Tomcat's NIO2 connector and the simple test HTTP client resolved it. Browser tests use 127.0.0.1 to avoid sharing localhost:8080 cookies.

Live worker Clock In, Start Break, End Break, reload persistence, task/complaint/service-ticket refresh and logout were checked successfully. Clock Out's browser confirmation was interrupted, so the real API was tested separately; the reloaded UI correctly showed OFFLINE and saved working minutes. The browser confirmation itself remains unverified.

Authenticated live reads across admin, resident, security, superadmin and accountant returned 23 successful responses and one admin Residents HTTP 500. The failing endpoint assumed every resident had an apartment; a null-safe response and regression test were added and passed. After restarting only the audit instance, the live Residents endpoint returned HTTP 200 with the saved resident and a blank unit number. This failure is verified fixed.

Additional repairs remove startup-generated chat conversations, read-generated gates, and fabricated active integration records. Chat messages use the authenticated sender and enforce society/resident ownership. Restarting no longer resets existing superadmin passwords or unlocks accounts. Resident technician simulation controls were removed. Maintenance request updates reject unauthorized assignments, invalid statuses, foreign workers, and cancelled-request completion.

Superadmin audit logs now read saved audit records. The unimplemented MFA policy endpoint explicitly returns HTTP 501 instead of pretending a policy was saved. External mail/payment delivery and the remaining live controls are not certified by this report.

Changes add nullable chat_conversation.tenant_id through the application's configured schema update; environments using managed migrations must include that column before deployment. Legacy unscoped conversations are withheld unless their saved maintenance request establishes society ownership. Existing operational database records were not bulk deleted.
