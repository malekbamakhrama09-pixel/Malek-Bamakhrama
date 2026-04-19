# GulfCV AI Security Specification

## 1. Data Invariants
- A **Resume** cannot exist without a `userId` that matches the authenticated user's UID.
- Users can only read, write, or list **Resumes** where `resource.data.userId == request.auth.uid`.
- **UserProfile** documents are strictly owned by the user whose UID matches the document ID (`/users/{userId}`).
- `createdAt` is immutable after creation.
- `updatedAt` must always be the current server time on every write.
- `isPro` and `downloadCredits` in `UserProfile` are "System-Generated" and cannot be modified by the user directly (simulating a backend-only update via Cloud Functions/Stripe hooks).

## 2. The "Dirty Dozen" Payloads (Denial Tests)

### Profile Attacks
1. **Identity Spoofing**: Attempt to create a Profile for another UID.
2. **Privilege Escalation**: Attempt to set `isPro: true` on your own profile.
3. **Credit Theft**: Attempt to increment `downloadCredits` manually.
4. **ID Poisoning**: Use a 2KB string as a User ID.

### Resume Attacks
5. **Resume Hijacking**: Attempt to write a resume with a `userId` belonging to someone else.
6. **Orphaned Writes**: Attempt to create a resume without an owner ID.
7. **Cross-User Leak**: Attempt to `list` resumes without a `where("userId", "==", uid)` filter (Rule must block blanket reads).
8. **Shadow Field Injection**: Create a resume with a hidden `isAdmin: true` field.
9. **Timestamp Manipulation**: Set `createdAt` to a date in 2030.
10. **State Bypassing**: Attempt to update an immutable `jobTitle` during a "Tailor" action (if we had state locking).
11. **Outcome Poisoning**: Set `isTailored` to `true` without providing a `targetJobDescription`.
12. **Malicious ID injection**: Attempt to create a resume with an ID like `../../secrets/config`.

## 3. Test Runner Requirement
- All above must return `PERMISSION_DENIED`.
