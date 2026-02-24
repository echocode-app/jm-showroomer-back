import { classifyError } from "../errorClassifier.js";

describe("classifyError", () => {
  it("maps 400 errors to domain_validation/warn", () => {
    expect(classifyError({ status: 400, code: "VALIDATION_ERROR" })).toEqual({
      category: "domain_validation",
      level: "warn",
    });
  });

  it("maps 409 errors to business_blocked/warn", () => {
    expect(classifyError({ status: 409, code: "USER_DELETE_BLOCKED" })).toEqual({
      category: "business_blocked",
      level: "warn",
    });
  });

  it("maps 500 errors to infra/error", () => {
    expect(classifyError({ status: 500, code: "INTERNAL" })).toEqual({
      category: "infra",
      level: "error",
    });
  });
});

