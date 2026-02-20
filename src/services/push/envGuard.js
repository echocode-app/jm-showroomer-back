// Purpose: Push feature flag gating.
// Responsibility: Decide whether push sending is allowed in current env.
// Invariant: push is always disabled under NODE_ENV=test.

export function isPushEnabled() {
    // Guard: tests must remain deterministic and free from network side effects.
    if ((process.env.NODE_ENV || "dev") === "test") {
        return false;
    }
    return process.env.PUSH_ENABLED === "true";
}
