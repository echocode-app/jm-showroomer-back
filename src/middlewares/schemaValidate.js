import { badRequest } from "../core/error.js";

const REQUIRED_CODE_MAP = {
    name: "SHOWROOM_NAME_REQUIRED",
    type: "SHOWROOM_TYPE_REQUIRED",
    country: "COUNTRY_REQUIRED",
};

function mapJoiError(details) {
    const missing = details.find(
        d => d.type === "any.required" && d.path?.length
    );

    if (missing) {
        const key = String(missing.path[0]);
        const code = REQUIRED_CODE_MAP[key];
        if (code) return badRequest(code);
    }

    return badRequest("VALIDATION_ERROR");
}

export function schemaValidate({ body: bodySchema = null, params: paramsSchema = null } = {}) {
    return (req, res, next) => {
        try {
            if (bodySchema) {
                const { error } = bodySchema.validate(req.body, {
                    abortEarly: false,
                    allowUnknown: false,
                });
                if (error) throw mapJoiError(error.details);
            }

            if (paramsSchema) {
                const { error } = paramsSchema.validate(req.params, {
                    abortEarly: false,
                    allowUnknown: false,
                });
                if (error) throw mapJoiError(error.details);
            }

            next();
        } catch (err) {
            next(err);
        }
    };
}
