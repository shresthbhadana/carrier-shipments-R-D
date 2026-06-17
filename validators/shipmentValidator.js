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
        .default("created")
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
    )
});

const rateQuerySchema = Joi.object({
    pickupPincode: Joi.string().required(),
    deliveryPincode: Joi.string().required(),
    weight: Joi.number().min(0).default(0.5),
    cod: Joi.boolean().default(false)
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

module.exports = {
    createShipmentSchema,
    updateShipmentSchema,
    rateQuerySchema,
    objectIdSchema,        
    initiateReturnSchema
};