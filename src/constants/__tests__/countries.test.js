import { isCountryBlocked, isSameCountryValue, resolveCountryIdentity } from "../countries.js";

describe("country identity helpers", () => {
    it("treats ISO2 and full English country name as the same country", () => {
        expect(resolveCountryIdentity("UA")).toBe("ua");
        expect(resolveCountryIdentity("Ukraine")).toBe("ua");
        expect(isSameCountryValue("UA", "Ukraine")).toBe(true);
        expect(isSameCountryValue("PL", "Poland")).toBe(true);
    });

    it("keeps blocked-country policy compatible for ISO2 and full names", () => {
        expect(isCountryBlocked("RU")).toBe(true);
        expect(isCountryBlocked("Russia")).toBe(true);
        expect(isCountryBlocked("BY")).toBe(true);
        expect(isCountryBlocked("Belarus")).toBe(true);
        expect(isCountryBlocked("UA")).toBe(false);
    });
});
