import { __resetViewThrottleForTests, shouldEmitView } from "../viewThrottleService.js";

describe("viewThrottleService", () => {
    beforeEach(() => {
        __resetViewThrottleForTests();
    });

    it("allows first view", () => {
        expect(shouldEmitView("u1", "showroom", "s1")).toBe(true);
    });

    it("blocks duplicate view within window", () => {
        shouldEmitView("u1", "showroom", "s2");
        expect(shouldEmitView("u1", "showroom", "s2")).toBe(false);
    });

    it("allows different resource", () => {
        shouldEmitView("u1", "showroom", "s3");
        expect(shouldEmitView("u1", "showroom", "s4")).toBe(true);
    });
});

