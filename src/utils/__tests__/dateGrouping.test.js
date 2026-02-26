import { assertGroupBy, bucketStartIso, toDateOrNull } from "../dateGrouping.js";

describe("dateGrouping", () => {
    describe("assertGroupBy", () => {
        it("normalizes supported values", () => {
            expect(assertGroupBy("DAY")).toBe("day");
            expect(assertGroupBy(" week ")).toBe("week");
            expect(assertGroupBy(undefined)).toBe("day");
        });

        it("throws for unsupported values", () => {
            expect(() => assertGroupBy("year")).toThrow("Unsupported groupBy");
        });
    });

    describe("toDateOrNull", () => {
        it("parses Date and ISO string inputs", () => {
            expect(toDateOrNull(new Date("2026-02-01T00:00:00.000Z"))).toBeInstanceOf(Date);
            expect(toDateOrNull("2026-02-01T00:00:00.000Z")).toBeInstanceOf(Date);
        });

        it("supports Firestore Timestamp-like objects", () => {
            const value = {
                toDate: () => new Date("2026-02-01T10:30:00.000Z"),
            };
            expect(toDateOrNull(value)?.toISOString()).toBe("2026-02-01T10:30:00.000Z");
        });

        it("returns null for invalid input", () => {
            expect(toDateOrNull("not-a-date")).toBeNull();
            expect(toDateOrNull(null)).toBeNull();
        });
    });

    describe("bucketStartIso", () => {
        const source = "2026-02-11T15:45:00.000Z"; // Wednesday

        it("normalizes to day bucket start", () => {
            expect(bucketStartIso(source, "day")).toBe("2026-02-11T00:00:00.000Z");
        });

        it("normalizes to Monday week bucket start (UTC)", () => {
            expect(bucketStartIso(source, "week")).toBe("2026-02-09T00:00:00.000Z");
        });

        it("normalizes to month bucket start", () => {
            expect(bucketStartIso(source, "month")).toBe("2026-02-01T00:00:00.000Z");
        });

        it("returns null for invalid source value", () => {
            expect(bucketStartIso("bad-date", "day")).toBeNull();
        });
    });
});
