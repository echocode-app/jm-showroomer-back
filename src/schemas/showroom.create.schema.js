import Joi from "joi";

const contactsSchema = Joi.object({
    phone: Joi.string().allow("", null),
    instagram: Joi.string().allow("", null),
}).min(1);

const locationSchema = Joi.object({
    lat: Joi.number(),
    lng: Joi.number(),
}).min(1);

export const showroomCreateSchema = Joi.object({
    name: Joi.string().required(),
    type: Joi.string().required(),
    country: Joi.string().required(),
    availability: Joi.any(),
    category: Joi.any(),
    brands: Joi.array(),
    address: Joi.string().allow("", null),
    city: Joi.string().allow("", null),
    contacts: contactsSchema,
    location: locationSchema,
    draft: Joi.boolean(),

    status: Joi.forbidden(),
    ownerUid: Joi.forbidden(),
    editCount: Joi.forbidden(),
    editHistory: Joi.forbidden(),
    nameNormalized: Joi.forbidden(),
    addressNormalized: Joi.forbidden(),
    submittedAt: Joi.forbidden(),
})
    .when("draft", {
        is: true,
        then: Joi.object({
            name: Joi.string(),
            type: Joi.string(),
            country: Joi.string(),
        }),
    })
    .unknown(false);
