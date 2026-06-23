const express = require("express");
const router = express.Router();
const { authenticateJWT,adminMiddleware } = require("../middlewares/authMiddleware");
const validate = require("../validators/validateMiddleware");
const {
    createPlanSchema,
    createSubscriptionSchema,
    verifySubscriptionSchema
} = require("../validators/subscriptionValidation");

const subscriptionController = require("../controllers/subscriptionController");


router.post(
    "/plans",
    authenticateJWT,
    adminMiddleware,
    validate(createPlanSchema),
    subscriptionController.createPlan
);


router.post(
    "/",
    authenticateJWT,
    validate(createSubscriptionSchema),
    subscriptionController.createSubscriptions
);

router.post(
    "/:subscriptionId/cancel",
    authenticateJWT,
    subscriptionController.cancelSubscription
);

router.get(
    "/user/:userId",
    authenticateJWT,
    subscriptionController.getUserSubscription
);

router.get(
    "/razorpay/:subscriptionId",
    authenticateJWT,
    subscriptionController.getSubscriptionByRazorpayId
);

router.get(
    "/:subscriptionId",
    authenticateJWT,
    subscriptionController.fetchSubscriptions
);

router.put(
    "/:subscriptionId/status/:status",
    authenticateJWT,adminMiddleware,
    subscriptionController.updateSubscriptionStatus
);

router.post(
    "/verify",
    authenticateJWT,
    validate(verifySubscriptionSchema),
    subscriptionController.verifySubscription
);

router.post(
    "/webhook",
    subscriptionController.handleWebhook
);

module.exports = router;
