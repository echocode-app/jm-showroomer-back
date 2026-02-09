import {
  normalizeBrand,
  normalizeBrands,
  normalizeKey,
  normalizeSubcategories,
  buildBrandsMap,
} from "../showroomNormalization.js";

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

describe("normalizeKey", () => {
  it("normalizes to lowercase snake keys", () => {
    expect(normalizeKey("  Lingerie/Swim ")).toBe("lingerie_swim");
    expect(normalizeKey("Brand  Name")).toBe("brand_name");
    expect(normalizeKey("Dresses")).toBe("dresses");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeKey(" ")).toBe("");
    expect(normalizeKey(null)).toBe("");
  });
});

describe("normalizeSubcategories", () => {
  it("deduplicates and normalizes keys", () => {
    expect(normalizeSubcategories(["Dresses", " dresses ", ""])).toEqual([
      "dresses",
    ]);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeSubcategories("Dresses")).toEqual([]);
  });
});

describe("buildBrandsMap", () => {
  it("builds a map of normalized brand keys", () => {
    expect(buildBrandsMap(["Zara", " ZARA ", "H&M"])).toEqual({
      zara: true,
      h_m: true,
    });
  });

  it("returns empty object for non-array input", () => {
    expect(buildBrandsMap("Zara")).toEqual({});
  });
});
