import { parseFilters } from "../parse.js";
import { parseCountersFilters } from "../parse/counters.js";
import { buildNearbyGeohashPrefixes } from "../parse/nearby.js";

describe("nearby showroom filters", () => {
  it("maps nearLat/nearLng to derived geohash prefixes for list endpoint", () => {
    const parsed = parseFilters({
      nearLat: "50.4501",
      nearLng: "30.5234",
      nearRadiusKm: "5",
    });

    expect(parsed.geohashPrefixes.length).toBeGreaterThan(0);
    expect(parsed.geohashPrefixes.length).toBeLessThanOrEqual(9);
  });

  it("uses default radius when nearRadiusKm is omitted", () => {
    const prefixes = buildNearbyGeohashPrefixes({
      nearLat: "50.4501",
      nearLng: "30.5234",
    });

    expect(prefixes.length).toBeGreaterThan(0);
    expect(prefixes.length).toBeLessThanOrEqual(9);
  });

  it("rejects partial nearby params", () => {
    expect(() => parseFilters({ nearLat: "50.45" })).toThrow(
      expect.objectContaining({ code: "QUERY_INVALID" })
    );
  });

  it("rejects mixing explicit geohash and nearby params", () => {
    expect(() =>
      parseFilters({
        geohashPrefix: "u8v",
        nearLat: "50.4501",
        nearLng: "30.5234",
      })
    ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
  });

  it("rejects nearby params combined with q name search", () => {
    expect(() =>
      parseFilters({
        nearLat: "50.4501",
        nearLng: "30.5234",
        q: "zara",
      })
    ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
  });

  it("rejects invalid nearby radius", () => {
    expect(() =>
      parseFilters({
        nearLat: "50.4501",
        nearLng: "30.5234",
        nearRadiusKm: "0",
      })
    ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
  });

  it("rejects invalid nearby coordinates", () => {
    expect(() =>
      parseFilters({
        nearLat: "999",
        nearLng: "30.5234",
      })
    ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
  });

  it("supports nearby params in counters parser", () => {
    const parsed = parseCountersFilters({
      nearLat: "52.2297",
      nearLng: "21.0122",
      nearRadiusKm: "20",
    });

    expect(parsed.geohashPrefixes.length).toBeGreaterThan(0);
    expect(parsed.geohashPrefixes.length).toBeLessThanOrEqual(9);
  });

  it("rejects nearby + explicit geohash in counters parser", () => {
    expect(() =>
      parseCountersFilters({
        geohashPrefixes: "u8v,u8w",
        nearLat: "52.2297",
        nearLng: "21.0122",
      })
    ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
  });
});
