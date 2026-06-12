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

module.exports = {
    createShipmentSchema,
    updateShipmentSchema,
    rateQuerySchema
};