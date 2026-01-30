export const ROLES = {
    GUEST: "guest",
    USER: "user",
    OWNER: "owner",

    // future
    MANAGER: "manager",
    STYLIST: "stylist",

    ADMIN: "admin",
};

// future ADMIN:
// GET /admin/showrooms/pending - список на модерацію
// PATCH /admin/showrooms/{id}/approve - approve showroom
// PATCH /admin/showrooms/{id}/reject - reject showroom
// PATCH /admin/users/{id}/approve-owner - approve owner request
// PATCH /admin/users/{id}/reject-owner - reject owner request
// GET /admin/stats - базова статистика