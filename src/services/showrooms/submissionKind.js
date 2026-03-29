export function getSubmissionKindFromEditHistory(editHistory) {
    const history = Array.isArray(editHistory) ? editHistory : [];
    const lastSubmit = [...history].reverse().find(entry => entry?.action === "submit");

    if (!lastSubmit) return "unknown";

    const statusBefore = typeof lastSubmit?.statusBefore === "string"
        ? lastSubmit.statusBefore.toLowerCase()
        : null;

    if (statusBefore === "draft") return "new";
    if (statusBefore === "approved" || statusBefore === "rejected") {
        return "edited";
    }

    return "unknown";
}
