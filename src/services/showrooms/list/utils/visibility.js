// Visibility rules for guest/owner/admin flows.

export function getVisibilityFilter(user, statusFilter) {
    if (!user) return { type: "guest" };
    if (user.role === "owner") return { type: "owner", status: statusFilter };
    if (user.role === "admin") return { type: "admin", status: statusFilter };
    return { type: "guest" };
}

export function applyVisibilityPostFilter(items, user) {
    if (!user || user.role === "owner") {
        return items.filter(s => s.status !== "deleted");
    }
    return items;
}
