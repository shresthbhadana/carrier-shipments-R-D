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
                    .required(),

                price: Joi.number()
                    .min(0)
                    .required()
            })
        )
        .min(1)
        .required(),

    subtotal: Joi.number().min(0),

    shippingPrice: Joi.number().min(0),

    totalAmount: Joi.number().min(0),

    pickupPincode: Joi.string().required(),

    deliveryPincode: Joi.string().required(),

    customerName: Joi.string().required(),

    customerPhone: Joi.string().required(),

    weight: Joi.number().min(0).default(0.5),

    courierName: Joi.string().allow("", null)
});

module.exports = {
    createOrderSchema
};
