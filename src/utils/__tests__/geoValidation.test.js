import { normalizeCity } from "../geoValidation.js";

describe("normalizeCity", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeCity("  New   York ")).toBe("new york");
  });

  it("returns null for null/undefined", () => {
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity(undefined)).toBeNull();
  });
});
