const Joi = require("joi");

const createShipmentSchema = Joi.object({
    orderId: Joi.string().required(),

    courierName: Joi.string().required(),

    trackingId: Joi.string().allow("", null),

    awbNumber: Joi.string().allow("", null),

    shippingPrice: Joi.number()
        .min(0)
        .required(),

    status: Joi.string()
        .valid(
            "pending",
            "created",
            "shipped",
            "delivered",
            "cancelled"
        )
        .default("created"),
        packages: Joi.array()
        .items(
            Joi.object({
                weight: Joi.number().min(0).required(),
                length: Joi.number().min(0).required(),
                width: Joi.number().min(0).required(),
                height: Joi.number().min(0).required()
            })
        )
        .min(1)
        .optional(),
});

const updateShipmentSchema = Joi.object({
    courierName: Joi.string(),

    trackingId: Joi.string(),

    awbNumber: Joi.string(),

    shippingPrice: Joi.number().min(0),

    status: Joi.string().valid(
        "pending",
        "created",
        "shipped",
        "delivered",
        "cancelled"
    ),
    packages: Joi.array()
        .items(
            Joi.object({
                weight: Joi.number().min(0).required(),
                length: Joi.number().min(0).required(),
                width: Joi.number().min(0).required(),
                height: Joi.number().min(0).required()
            })
        )
        .min(1)
        .optional(),
});

const rateQuerySchema = Joi.object({
    pickupPincode: Joi.string().required(),
    deliveryPincode: Joi.string().required(),
    weight: Joi.number().min(0).default(0.5),
    cod: Joi.boolean().default(false),
    packages: Joi.array()
        .items(
            Joi.object({
                weight: Joi.number().min(0).required(),
                length: Joi.number().min(0).required(),
                width: Joi.number().min(0).required(),
                height: Joi.number().min(0).required()
            })
        )
        .min(1)
        .optional(),
});
const objectIdSchema = Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        "string.pattern.base": "Invalid MongoDB ObjectId format"
    })
});
const initiateReturnSchema = Joi.object({
    customerName: Joi.string().allow("", null),
    customerPhone: Joi.string().allow("", null),
    pickupAddress: Joi.string().required(),
    pickupPincode: Joi.string().required(),
    pickupCity: Joi.string().required(),
    pickupState: Joi.string().required(),
    weight: Joi.number().min(0).optional(),
    returnReasonId: Joi.number().integer().optional(),
    customerRequest: Joi.string().optional(),
    reasonComment: Joi.string().allow("", null).optional()
});

const schedulePickupSchema = Joi.object({
    date: Joi.string().optional(),
    anyTimeAfter: Joi.string().optional(),
    untilTime: Joi.string().optional(),
    weight: Joi.number().min(0).optional(),
    pickupLocation: Joi.string().optional(),
    additionalInstructions: Joi.string().allow("", null).optional(),
    supplyRequestCodes: Joi.array().items(Joi.string()).optional(),
    pickupAddress: Joi.string().optional(),
    pickupState: Joi.string().optional(),
    pickupCity: Joi.string().optional(),
    pickupPincode: Joi.string().optional(),
    customerName: Joi.string().optional(),
    customerPhone: Joi.string().optional(),
    email: Joi.string().email().optional()
});

const getLocationsSchema = Joi.object({
    carrier: Joi.string().optional(),
    postalCode: Joi.string().required()
});
const pickupAvailabilitySchema = Joi.object({
    carrier: Joi.string().required(),
    pickupPincode: Joi.string().required(),
    pickupDate: Joi.string().optional()
});

module.exports = {
    createShipmentSchema,
    updateShipmentSchema,
    rateQuerySchema,
    objectIdSchema,        
    initiateReturnSchema,
    schedulePickupSchema,
    getLocationsSchema,
    pickupAvailabilitySchema
};