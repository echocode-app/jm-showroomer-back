import { decodeCursor, encodeCursor, CURSOR_VERSION } from "../parse.js";

describe("cursor encode/decode", () => {
  it("round-trips cursor data", () => {
    const encoded = encodeCursor({ value: "2024-01-01T00:00:00.000Z", id: "abc" });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ v: CURSOR_VERSION, value: "2024-01-01T00:00:00.000Z", id: "abc" });
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
