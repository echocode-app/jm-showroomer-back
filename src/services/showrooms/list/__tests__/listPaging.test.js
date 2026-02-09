import { listShowroomsDev } from "../dev.js";
import { parseFilters } from "../parse.js";
import { DEV_STORE } from "../../_store.js";

describe("list paging meta", () => {
  beforeEach(() => {
    DEV_STORE.showrooms = [];
  });

  it("disables paging for multi-prefix geohash mode", () => {
    DEV_STORE.showrooms = [
      {
        id: "s1",
        ownerUid: "o1",
        status: "approved",
        country: "Ukraine",
        geo: { geohash: "u4pruydqq" },
      },
    ];

    const parsed = parseFilters({
      geohashPrefixes: "u4,u5",
      limit: 1,
    });
    const result = listShowroomsDev(parsed, null);

    expect(result.meta).toEqual(
      expect.objectContaining({
        nextCursor: null,
        hasMore: false,
        paging: "disabled",
        reason: "multi_geohash_prefixes",
      })
    );
  });

  it("returns end paging for empty results in enabled mode", () => {
    const parsed = parseFilters({ q: "zzzzzzzzzzzzzzzzzzzz" });
    const result = listShowroomsDev(parsed, null);

    expect(result.showrooms).toEqual([]);
    expect(result.meta).toEqual(
      expect.objectContaining({
        nextCursor: null,
        hasMore: false,
        paging: "end",
      })
    );
  });
});
