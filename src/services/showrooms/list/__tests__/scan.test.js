import { scanOrderedQuery } from "../utils/scan.js";

function makeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

class MockQuery {
  constructor(docs, startAfterId = null, pageSize = null) {
    this.docs = docs;
    this.startAfterId = startAfterId;
    this.pageSize = pageSize;
  }

  startAfter(_value, id) {
    return new MockQuery(this.docs, id, this.pageSize);
  }

  limit(size) {
    return new MockQuery(this.docs, this.startAfterId, size);
  }

  async get() {
    const startIndex = this.startAfterId
      ? this.docs.findIndex(doc => doc.id === this.startAfterId) + 1
      : 0;
    const docs = this.docs.slice(startIndex, startIndex + this.pageSize);
    return {
      empty: docs.length === 0,
      docs,
    };
  }
}

describe("scanOrderedQuery", () => {
  it("continues scanning when early rows are removed by post-filters", async () => {
    const query = new MockQuery([
      makeDoc("d1", { updatedAt: "2026-03-17T12:00:00.000Z", status: "deleted" }),
      makeDoc("d2", { updatedAt: "2026-03-17T11:59:00.000Z", status: "deleted" }),
      makeDoc("a1", { updatedAt: "2026-03-17T11:58:00.000Z", status: "approved" }),
      makeDoc("a2", { updatedAt: "2026-03-17T11:57:00.000Z", status: "approved" }),
    ]);

    const result = await scanOrderedQuery(query, {
      cursor: null,
      limit: 1,
      orderField: "updatedAt",
      minBatchSize: 1,
      transform: item => (item.status === "deleted" ? null : item),
    });

    expect(result.items.map(item => item.id)).toEqual(["a1", "a2"]);
  });
});
