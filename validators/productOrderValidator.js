const Joi = require("joi");

const createOrderSchema = Joi.object({
    userId: Joi.string().required(),

    products: Joi.array()
        .items(
            Joi.object({
                productId: Joi.string().required(),
                quantity: Joi.number()
                    .integer()
                    .min(1)
                    .required()
            })
        )
        .min(1)
        .required(),

    pickupPincode: Joi.string().required(),

    deliveryPincode: Joi.string().required(),

    customerName: Joi.string().required(),

    customerPhone: Joi.string().required(),

    weight: Joi.number().min(0).default(0.5),

    courierName: Joi.string().allow("", null)
});
const updateOrderSchema = Joi.object({
    orderStatus: Joi.string().valid("pending", "processing", "shipped", "delivered", "cancelled", "returned"),
    pickupPincode: Joi.string(),
    deliveryPincode: Joi.string(),
    customerName: Joi.string(),
    customerPhone: Joi.string(),
    weight: Joi.number().min(0)
});


module.exports = {
    createOrderSchema,
    updateOrderSchema
};
