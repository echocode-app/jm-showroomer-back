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

  it("throws in dev when event is not in domain catalog", () => {
    process.env.NODE_ENV = "dev";

    expect(() =>
      logDomainEvent(
        { log: { info: jest.fn(), error: jest.fn() } },
        { domain: "showroom", event: "not_real_event" },
        "info"
      )
    ).toThrow("Invalid domain event catalog");
  });

  it("throws in dev when status is not in enum", () => {
    process.env.NODE_ENV = "dev";

    expect(() =>
      logDomainEvent(
        { log: { info: jest.fn(), error: jest.fn() } },
        { domain: "showroom", event: "create", status: "not_valid" },
        "info"
      )
    ).toThrow("Invalid domain status");
  });
});

describe("logDomainEvent hardening", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("marks error object as domain logged after valid error-flow log", () => {
    const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const err = new Error("x");

    logDomainEvent(
      { id: "req-1", log: logger },
      {
        domain: "auth",
        event: "login",
        status: "failed",
        meta: { code: "AUTH_INVALID" },
      },
      "warn",
      err
    );

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(err.__domainLogged).toBe(true);
  });

  it("uses direct prod fallback for invalid catalog without recursion and marks error", () => {
    process.env.NODE_ENV = "prod";
    const logger = { info: jest.fn(), error: jest.fn() };
    const err = new Error("x");

    logDomainEvent(
      { id: "req-1", log: logger },
      { domain: "showroom", event: "drifted_event", status: "success" },
      "info",
      err
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(err.__domainLogged).toBe(true);
    expect(logger.error.mock.calls[0][0]).toMatchObject({
      domain: "invalid_schema",
      event: "invalid_event_catalog",
    });
  });

  it("uses prod fallback for invalid status", () => {
    process.env.NODE_ENV = "prod";
    const logger = { info: jest.fn(), error: jest.fn() };

    logDomainEvent(
      { id: "req-1", log: logger },
      { domain: "showroom", event: "create", status: "drifted_status" },
      "info"
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error.mock.calls[0][0]).toMatchObject({
      domain: "invalid_schema",
      event: "invalid_status",
      status: "failed",
    });
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
