# Security Specification — Nosso Roteiro

## 1. Data Invariants

1. **Email Verification Gate**: Every read and write requires `request.auth != null` and `request.auth.token.email_verified == true`.
2. **PII Isolation**: User profiles at `/users/{userId}` are strictly readable and writable only by `request.auth.uid == userId`. List queries on `/users` are denied.
3. **Itinerary Collaboration Integrity**: An itinerary at `/itineraries/{itineraryId}` is readable, listable, and editable only by verified Gmail accounts present in `linkedEmails` (bounded 1–25). Only `ownerUid` can delete an itinerary, and `ownerUid`, `ownerEmail`, and `createdAt` are immutable. `ownerEmail` must always remain in `linkedEmails`.
4. **Event Master Gate & Relational Sync**: An event at `/itineraries/{itineraryId}/events/{eventId}` cannot exist without an existing parent itinerary, and `incoming().linkedEmails` must match the parent itinerary's `linkedEmails`. Only current linked members of the parent itinerary may read, create, update, or delete events.
5. **Server Timestamp Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time` on creation, and `updatedAt` must strictly equal `request.time` on updates.
6. **Strict Schema & Size Guards**: Every document enforces exact `hasAll` / `hasOnly` keys, string length limits, regex format validation for IDs, dates (`YYYY-MM-DD`), and times (`HH:MM`), and bounded arrays (`<= 25`).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoof**: `{ auth: { uid: "u1", token: { email: "m4rcelo69@gmail.com", email_verified: false } } }` attempting to create or read `/itineraries/itin1` -> **PERMISSION_DENIED**.
2. **PII Cross-User Read**: User `u2` reading `/users/u1` -> **PERMISSION_DENIED**.
3. **Shadow Ghost Field on Itinerary Create**: Adding `isAdmin: true` or `verified: true` to `/itineraries/itin1` -> **PERMISSION_DENIED**.
4. **Owner Spoofing on Itinerary Create**: User `u1` creating `/itineraries/itin1` with `ownerUid: "u2"` -> **PERMISSION_DENIED**.
5. **Client-Forged Timestamp**: Creating `/itineraries/itin1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **PERMISSION_DENIED**.
6. **Blanket List Query Scraping**: Listing `/itineraries` without filtering by `linkedEmails array-contains auth.email` -> **PERMISSION_DENIED**.
7. **Owner Removal Lockout**: Collaborator updating `linkedEmails` on `/itineraries/itin1` and removing `ownerEmail` -> **PERMISSION_DENIED**.
8. **Non-Member Event Creation**: User `u3` (not in `linkedEmails`) creating `/itineraries/itin1/events/ev1` -> **PERMISSION_DENIED**.
9. **Malformed Event Date / Oversized Payload**: Creating `/itineraries/itin1/events/ev1` with `date: "13/12/2026"` or 50KB `notes` -> **PERMISSION_DENIED**.
10. **Path Variable ID Poisoning**: Creating `/itineraries/bad$id!with*invalid/events/ev1` or 200-char ID -> **PERMISSION_DENIED**.
11. **Immutable Field Mutation**: Updating `createdByUid` or `createdAt` on `/itineraries/itin1/events/ev1` -> **PERMISSION_DENIED**.
12. **Non-Owner Itinerary Deletion**: Collaborator `u2` (not `ownerUid`) attempting `delete` on `/itineraries/itin1` -> **PERMISSION_DENIED**.
