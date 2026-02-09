import { decodeCursor, encodeCursor, CURSOR_VERSION, parseFilters } from "../parse.js";

describe("cursor encode/decode", () => {
  it("round-trips cursor data", () => {
    const encoded = encodeCursor(
      { value: "2024-01-01T00:00:00.000Z", id: "abc" },
      "updatedAt",
      "desc"
    );
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({
      v: CURSOR_VERSION,
      f: "updatedAt",
      d: "desc",
      value: "2024-01-01T00:00:00.000Z",
      id: "abc",
    });
  });

  it("throws CURSOR_INVALID for malformed cursor", () => {
    try {
      decodeCursor("not-base64");
    } catch (err) {
      expect(err.code).toBe("CURSOR_INVALID");
      return;
    }
    throw new Error("Expected decodeCursor to throw");
  });

  it("throws CURSOR_INVALID for wrong version", () => {
    const bad = Buffer.from(JSON.stringify({ v: 999, value: "x", id: "y" })).toString("base64");
    try {
      decodeCursor(bad);
    } catch (err) {
      expect(err.code).toBe("CURSOR_INVALID");
      return;
    }
    throw new Error("Expected decodeCursor to throw");
  });
});

describe("cursor mode safety (parseFilters)", () => {
  it("accepts v2 cursor when order field matches default list", () => {
    const encoded = encodeCursor(
      { value: "2024-01-01T00:00:00.000Z", id: "abc" },
      "updatedAt",
      "desc"
    );
    const parsed = parseFilters({ cursor: encoded });
    expect(parsed.cursor).toBeTruthy();
  });

  it("rejects v2 cursor when order field mismatches mode", () => {
    const encoded = encodeCursor(
      { value: "abc", id: "id1" },
      "nameNormalized",
      "asc"
    );
    try {
      parseFilters({ cursor: encoded });
    } catch (err) {
      expect(err.code).toBe("CURSOR_INVALID");
      return;
    }
    throw new Error("Expected parseFilters to throw");
  });

  it("accepts v1 cursor in default mode only", () => {
    const v1 = Buffer.from(JSON.stringify({ v: 1, value: "2024-01-01T00:00:00.000Z", id: "abc" })).toString("base64");
    const parsed = parseFilters({ cursor: v1 });
    expect(parsed.cursor).toBeTruthy();
  });

  it("rejects v1 cursor for qName mode", () => {
    const v1 = Buffer.from(JSON.stringify({ v: 1, value: "a", id: "abc" })).toString("base64");
    try {
      parseFilters({ q: "test", cursor: v1 });
    } catch (err) {
      expect(err.code).toBe("CURSOR_INVALID");
      return;
    }
    throw new Error("Expected parseFilters to throw");
  });
});
