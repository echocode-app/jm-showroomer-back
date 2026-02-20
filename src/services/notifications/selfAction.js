// Purpose: Shared self-action notification guard.
// Responsibility: Keep "skip self notification" semantics identical across domains.
// Invariant: actor should never receive notification for own action.

export function shouldNotifyActorAction(targetUid, actorUid) {
    if (!targetUid || typeof targetUid !== "string") return false;
    if (!actorUid || typeof actorUid !== "string") return false;
    return targetUid !== actorUid;
}
