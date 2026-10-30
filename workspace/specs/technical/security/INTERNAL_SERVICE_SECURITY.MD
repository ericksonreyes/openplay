# OpenPlay API and Service Security

This document sets security rules for OpenPlay's responsive web app, guest booking, venue tools, and backend systems. The same controls should apply to native apps if they are added later. It avoids choosing a hosting vendor or service layout.

## Goals

- Keep player and business data private.
- Give each user access only to the businesses, venues, and actions allowed by their role.
- Protect guest bookings without requiring a full account.
- Keep backend data stores and model services away from direct client access.

## Public and protected access

"Public" means an endpoint can be reached over the internet. It does not mean that all data is public.

### Public access

- People can browse published Business Profile Pages, venue information, and public availability without signing in.
- Guest booking is available only when the Business Owner enables it. The app applies abuse controls and collects only the contact details needed for confirmation and booking access.
- Sign-in and account recovery endpoints are public entry points and must use rate limits and safe error messages.
- Payment-provider callbacks may be public when a provider requires them. Verify each callback, process it idempotently, and do not treat a browser redirect as proof of payment.
- Public endpoints must not reveal private booking details, contact information, or internal business notes.

### Protected business data

- Any endpoint not explicitly listed as public requires an authenticated user or trusted backend identity and an authorization check.
- Authenticated requests must validate identity and permissions according to [Identity & Access](./IDENTITY_AND_ACCESS.MD), [JWT Signing Keys](./JWT_SIGNING_KEYS.MD), and [JWT Invalidation](./JWT_INVALIDATION.MD).
- Do not trust a business ID, venue ID, role, or permission supplied only in a request body, URL, or header. Check it against the verified user's authorized scope.
- Players can access their own private records. Business Owners can access their own business; venue managers and staff can access only their assigned venues and delegated actions.
- Platform Administrator access is available only in multi-tenant deployments. Cross-business access is limited to an authorized support task and must be auditable.
- Guests can view or manage their booking only after completing the secure verification defined in [Guest Booking](../../domain/specifications/GUEST_BOOKING.MD). A name or contact detail alone is not sufficient.

## Private backend access

- The responsive web app, and any future native apps, call OpenPlay's backend APIs or an approved backend-for-frontend. Client apps never connect directly to data stores, file storage, or model servers.
- Data stores, file storage, and internal APIs must not have public routes. Private network placement is an extra layer, not a substitute for authentication.
- Files such as payment receipts must use private storage and be returned only to authorized users through controlled access.
- The optional AI assistant uses permission-checked application APIs and approved information sources. It does not access databases or make changes; see [AI Assistant](../../domain/specifications/AI_ASSISTANT.MD).
- If a hosted AI provider is enabled, send only the minimum data needed and follow the disclosure and retention rules in the AI Assistant specification.

## Calls between backend components

- A synchronous call must preserve the caller's identity and permissions, or pass an equally scoped authorization context. One service must not gain more access than the user who initiated the request.
- Background work must not carry a user's live token. Use a service identity and record the user and business that started the work when needed for audit.
- Every backend component must authenticate callers. Do not trust a request only because it came from a private network.
- The queue or event transport and the exact network layout remain open technical choices.

## Common safeguards

- Use HTTPS for client-facing traffic, and restrict cross-origin requests to approved web app origins.
- Rate-limit sign-in, guest booking, and other public requests that could be abused.
- Return errors that do not confirm whether another person's booking or account exists.
- Log sensitive support access and security-relevant administrative actions without recording passwords, tokens, or payment secrets.

## Related specifications

- [Identity & Access](./IDENTITY_AND_ACCESS.MD)
- [JWT Signing Keys](./JWT_SIGNING_KEYS.MD)
- [JWT Invalidation](./JWT_INVALIDATION.MD)
- [Guest Booking](../../domain/specifications/GUEST_BOOKING.MD)
- [AI Assistant](../../domain/specifications/AI_ASSISTANT.MD)
