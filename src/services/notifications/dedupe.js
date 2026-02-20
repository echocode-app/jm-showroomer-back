// Purpose: Notification idempotency helpers.
// Responsibility: Keep dedupe-write error semantics in one place.
// Invariant: dedupe-key collisions are treated as non-fatal for push dispatch.

export function isNotificationAlreadyExistsError(err) {
    return err?.code === 6 || err?.code === "already-exists" || err?.status === "ALREADY_EXISTS";
}
