import { jest } from "@jest/globals";
import { logDomainEvent, sanitizeMeta } from "../logDomainEvent.js";

describe("logDomainEvent schema enforcement", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("throws in dev when domain is missing", () => {
    process.env.NODE_ENV = "dev";

    expect(() =>
      logDomainEvent(
        { log: { info: jest.fn(), error: jest.fn() } },
        { event: "login" },
        "info"
      )
    ).toThrow("Invalid domain log schema");
  });

  it("throws in dev when event is missing", () => {
    process.env.NODE_ENV = "dev";

    expect(() =>
      logDomainEvent(
        { log: { info: jest.fn(), error: jest.fn() } },
        { domain: "auth" },
        "info"
      )
    ).toThrow("Invalid domain log schema");
  });
});

describe("sanitizeMeta", () => {
  it("removes email and arrays", () => {
    expect(
      sanitizeMeta({
        email: "user@example.com",
        code: "AUTH_INVALID",
        ids: ["a", "b"],
      })
    ).toEqual({
      code: "AUTH_INVALID",
    });
  });

  it("truncates nested objects deeper than depth 2", () => {
    expect(
      sanitizeMeta({
        level1: {
          level2: {
            level3: {
              tooDeep: true,
            },
          },
        },
      })
    ).toEqual({
      level1: {
        level2: {
          truncated: true,
        },
      },
    });
  });
});

