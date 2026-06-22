const Joi = require("joi");

const createPlanSchema = Joi.object({
    period: Joi.string()
        .valid("daily", "weekly", "monthly", "yearly")
        .required(),

    interval: Joi.number()
        .integer()
        .min(1)
        .required(),

    amount: Joi.number()
        .positive()
        .required(),

    planName: Joi.string()
        .trim()
        .required()
});

const createSubscriptionSchema = Joi.object({
    planId: Joi.string()
        .required(),

    totalCount: Joi.number()
        .integer()
        .min(1)
        .required(),

    customerNotify: Joi.number()
        .valid(0, 1)
        .optional(),

    startAt: Joi.number()
        .integer()
        .optional(),

    addons: Joi.array()
        .items(
            Joi.object({
                item: Joi.object({
                    name: Joi.string().required(),
                    amount: Joi.number().positive().required(),
                    currency: Joi.string().default("INR").required()
                }).required()
            })
        )
        .optional()
});

const verifySubscriptionSchema = Joi.object({
    razorpay_payment_id: Joi.string()
        .required(),

    razorpay_subscription_id: Joi.string()
        .required(),

    razorpay_signature: Joi.string()
        .required()
});

module.exports = {
    createPlanSchema,
    createSubscriptionSchema,
    verifySubscriptionSchema
};