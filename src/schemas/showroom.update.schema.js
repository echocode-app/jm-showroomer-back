import Joi from "joi";

const contactsSchema = Joi.object({
    phone: Joi.string().allow("", null),
    instagram: Joi.string().allow("", null),
}).min(1);

const locationSchema = Joi.object({
    lat: Joi.number(),
    lng: Joi.number(),
}).min(1);

const geoCoordsSchema = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
}).required();

const geoSchema = Joi.object({
    city: Joi.string().required(),
    country: Joi.string().allow(null),
    coords: geoCoordsSchema,
    placeId: Joi.string().allow(null),
}).unknown(false);

export const showroomUpdateSchema = Joi.object({
    name: Joi.string(),
    type: Joi.string(),
    country: Joi.string(),
    availability: Joi.any(),
    category: Joi.any(),
    brands: Joi.array(),
    address: Joi.string().allow("", null),
    city: Joi.string().allow("", null),
    contacts: contactsSchema,
    location: locationSchema,
    geo: geoSchema,

    status: Joi.forbidden(),
    ownerUid: Joi.forbidden(),
    editCount: Joi.forbidden(),
    editHistory: Joi.forbidden(),
    pendingSnapshot: Joi.forbidden(),
    deletedAt: Joi.forbidden(),
    deletedBy: Joi.forbidden(),
    reviewedAt: Joi.forbidden(),
    reviewedBy: Joi.forbidden(),
    reviewReason: Joi.forbidden(),
    nameNormalized: Joi.forbidden(),
    addressNormalized: Joi.forbidden(),
    submittedAt: Joi.forbidden(),
})
    .min(1)
    .unknown(false);
