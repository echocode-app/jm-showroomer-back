import ngeohash from "ngeohash";
import { resolveBoundedPrefixes } from "../map/shared.js";

describe("showrooms map shared viewport prefixes", () => {
    it("includes the geohash cell for a point inside a Lviv viewport", () => {
        const bounds = {
            north: 49.95,
            south: 49.72,
            east: 24.18,
            west: 23.88,
        };

        const { precision, prefixes } = resolveBoundedPrefixes(bounds, 6);
        const pointHash = ngeohash.encode(49.8397, 24.0297, precision).toLowerCase();

        expect(prefixes).toContain(pointHash);
    });

    it("includes the geohash cell for a point inside a Cherkasy viewport", () => {
        const bounds = {
            north: 49.52,
            south: 49.36,
            east: 32.16,
            west: 31.96,
        };

        const { precision, prefixes } = resolveBoundedPrefixes(bounds, 6);
        const pointHash = ngeohash.encode(49.4444, 32.0598, precision).toLowerCase();

        expect(prefixes).toContain(pointHash);
    });
});
