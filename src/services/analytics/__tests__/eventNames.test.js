import { ANALYTICS_EVENTS } from "../eventNames.js";

const SNAKE_CASE_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

describe("ANALYTICS_EVENTS registry", () => {
    it("contains at least one event", () => {
        expect(Object.keys(ANALYTICS_EVENTS).length).toBeGreaterThan(0);
    });

    it("contains unique string snake_case values", () => {
        const values = Object.values(ANALYTICS_EVENTS);

        expect(values.every(value => typeof value === "string")).toBe(true);
        expect(values.every(value => SNAKE_CASE_RE.test(value))).toBe(true);
        expect(new Set(values).size).toBe(values.length);
    });
});

