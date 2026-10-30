# Optional AI assistant

## Feature controls and providers

The chatbot is optional. Form-based search and inquiry remains the default and must work when the chatbot is disabled.

- A Business Owner can turn the assistant on or off for their business. In a single-company installation, the setting applies to that company's venues; in multi-tenant mode, it applies only to that Business Owner's business.
- When enabled, signed-in players and venue users can open the chatbot in the responsive web app. Native-app support is deferred with native apps.
- Whether guests can use the chatbot for public availability searches or form prefilling is a separate open decision; guests never gain access to private booking data without verification.
- The Business Owner selects from provider options configured for the installation: an Ollama-hosted model or a hosted large language model (LLM) API, such as OpenAI or another approved provider.
- External providers are bring-your-own-key (BYOK): the Business Owner supplies their own API credentials. The Ollama option needs no external credentials.
- Provider keys are write-only in the app — they can be entered and replaced but never read back. They are stored encrypted in PostgreSQL (the database holds ciphertext only) and are never shown in responses, chat output, or logs. Changes to provider settings are audit-logged without recording the key itself.
- Turning the feature off stops assistant requests and does not affect reservations, open play, rentals, memberships, or payments.
- Whether the assistant ships in the initial release, its default setting, and the final provider/model list are open decisions.
- Voice mode lets the user dictate instead of typing, using the browser's Web Speech API (`SpeechRecognition`) — no audio reaches OpenPlay servers or the AI provider. Voice capture starts only after the user taps the microphone; the app does not listen continuously.
- The browser's transcription is shown for correction and only the user-approved text goes through the same permission-checked, read-only assistant flow. Voice input does not add booking, payment, or approval permissions.
- On browsers without `SpeechRecognition` (for example Firefox), the microphone control is hidden and typing remains the input path — the same graceful-degradation rule as the rest of the assistant.
- Spoken answers may use the browser's `speechSynthesis`. External speech-to-text/text-to-speech providers are deferred — they are an optional quality upgrade, not a foundation decision.

## Questions the assistant can answer

The assistant answers read-only questions about current OpenPlay information. At the player's request, it can also prepare an unsaved booking form for review. Examples include:

### Availability and schedules

- “Which courts are available at this venue on Saturday between 2 and 6 p.m.?”
- “What is the next available time for a court that supports pickleball?”
- “What is the next available court at this venue?”
- “Which scheduled events have open registration this weekend?”
- “What are the current standings for this event?” — only when standings are enabled and visible to the user.
- “What venues and events does this business offer?” — using published Business Profile Page content.
- “Which Open Play sessions still have spaces this evening?”
- “How many places remain in the 7 p.m. session?”

### Reservations and rentals

- “What reservations do I have this week?”
- “When and where is my next reservation?”
- “What is the status of my reservation?”
- “Can you fill in the booking form for the 3 p.m. slot we selected?”
- “What reservations does this player have at my venue tomorrow?” — only for an authorized Business Owner, manager, or staff member.
- “Can I rent two paddles with my reservation?”
- “How much would it cost to rent two paddles?”
- “What equipment is available to rent for these times?”
- “When is my equipment rental due back?”

### Memberships, payments, and venue information

- “What membership plans does this venue offer, and what benefits do they include?”
- “When does my membership expire?”
- “Does my membership benefit apply to this reservation or rental?”
- “Which payment methods does this venue accept?”
- “Has my transfer been marked as received?”
- “What is the remaining balance and when is it due?”
- “What are this venue's hours and cancellation policy?”

Venue staff and managers may ask operational questions, such as which reservations need attention, what equipment stock is available for a period, or which direct transfers are awaiting authorized review. They can only see information within their assigned venues and permissions.

## Data access and limits

- The assistant gets live availability, event registration and standings, public Business Profile Page content, reservation, rental, membership, and payment-status information through permission-checked application tools or APIs. It can use approved venue information for policy questions. It must not access databases directly.
- Every answer must respect the signed-in user's identity, role, business, venue assignments, and permissions. Players can ask about their own records; venue users can ask about records only within their authorized scope.
- Guests can ask about public availability. The assistant must not reveal private guest booking details unless the guest completes the secure verification required by the Guest Booking spec.
- The assistant must use current application data for live availability and status. If data is missing or a service cannot be reached, it says it cannot verify the answer rather than guessing.
- The assistant never writes business data. At the player's request, it may open and prefill an unsaved booking form with the selected venue, event or resource, date, time, duration, and other confirmed details. This changes only the draft form; it does not create a reservation or event registration, hold a slot, or reserve equipment.
- The player must review and submit the form through the normal app flow. On submission, the app rechecks resource availability, event capacity, prices, and policies. If required details are missing or unclear, the assistant asks instead of guessing.
- The assistant cannot submit or change reservations or event registrations, join events, rent equipment, collect or verify payments, approve refunds, or change venue settings.
- The assistant can report a payment status but cannot verify transfer evidence, mark a payment paid, approve a reservation, or make another business decision.
- For hosted providers, only the minimum permitted information needed to answer a question may be sent. Chat history is session-only and never persisted. How users are told about hosted-provider data handling remains an open decision. Provider credentials are Business Owner-supplied (BYOK), stored encrypted, and must not be shown to users or included in chat responses.

## Technical notes

- The assistant runs as a module inside the NestJS backend. Its tools are thin adapters over the same permission-checked domain services the API uses, executing with the caller's identity, tenant, roles, and venue assignments. See [ADR-0006](../../technical/decisions/0006-ai-assistant-runtime.MD).
- Governance rules — authority boundary, identity propagation, prompt-injection defense, data protection, and evaluation — live in [AI Governance](../../technical/AI_GOVERNANCE.MD).
- Ollama is optional backend-owned infrastructure behind an `ai` Docker Compose profile; a host-installed Ollama is recommended on macOS. Hosted providers work without Ollama.

## Scope decisions still needed

- Whether the assistant is part of the initial release and whether it starts disabled by default.
- The Ollama model allowlist contents. (Provider credential ownership is decided: external providers are BYOK, and BYOK tenants may use any provider/model reachable with their own key.)
- How users are told about hosted-provider data handling. (Chat history is decided: session-only, never persisted.)
- Whether a business may configure an ordered fallback provider and whether failover notifies anyone. (The terminal fallback is decided: always the classic manual form.)
- Which additional question types and languages are supported.
