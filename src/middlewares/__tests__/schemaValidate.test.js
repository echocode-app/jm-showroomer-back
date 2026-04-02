import { jest } from "@jest/globals";

import { schemaValidate } from "../schemaValidate.js";

describe("schemaValidate", () => {
    it("attaches detailed meta for Joi validation errors", () => {
        const middleware = schemaValidate({
            body: {
                validate: () => ({
                    error: {
                        details: [
                            {
                                path: ["phone"],
                                type: "string.empty",
                                message: "\"phone\" is not allowed to be empty",
                            },
                        ],
                    },
                }),
            },
        });

        const next = jest.fn();
        middleware({ body: { phone: "" } }, {}, next);

        const err = next.mock.calls[0][0];
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.meta).toEqual({
            fields: [
                {
                    path: "phone",
                    type: "string.empty",
                    message: "\"phone\" is not allowed to be empty",
                },
            ],
        });
    });

    it("maps required country to COUNTRY_REQUIRED and preserves field meta", () => {
        const middleware = schemaValidate({
            body: {
                validate: () => ({
                    error: {
                        details: [
                            {
                                path: ["country"],
                                type: "any.required",
                                message: "\"country\" is required",
                            },
                        ],
                    },
                }),
            },
        });

        const next = jest.fn();
        middleware({ body: {} }, {}, next);

        const err = next.mock.calls[0][0];
        expect(err.code).toBe("COUNTRY_REQUIRED");
        expect(err.meta).toEqual({
            fields: [
                {
                    path: "country",
                    type: "any.required",
                    message: "\"country\" is required",
                },
            ],
        });
    });
});
