import { normalizeBrand, normalizeBrands } from "../showroomNormalization.js";

describe("normalizeBrand", () => {
  it("normalizes casing, whitespace, and punctuation", () => {
    expect(normalizeBrand("  Brand  Name ")).toBe("brand name");
    expect(normalizeBrand("‘Brand’")).toBe("brand");
    expect(normalizeBrand("***Brand***")).toBe("brand");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeBrand(" ")).toBe("");
    expect(normalizeBrand(null)).toBe("");
  });
});

describe("normalizeBrands", () => {
  it("deduplicates and filters empty entries", () => {
    expect(normalizeBrands(["Brand", " brand ", "", null])).toEqual(["brand"]);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeBrands("Brand")).toEqual([]);
  });
});
