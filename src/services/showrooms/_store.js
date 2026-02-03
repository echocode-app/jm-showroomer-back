export const useDevMock = process.env.NODE_ENV === "dev";

export const DEV_STORE = { showrooms: [] };

// generateId
export function generateId() {
    return Math.random().toString(36).substring(2, 10);
}
