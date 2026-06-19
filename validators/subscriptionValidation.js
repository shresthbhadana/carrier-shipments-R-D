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
        .optional()
});

module.exports = {
    createPlanSchema,
    createSubscriptionSchema
};