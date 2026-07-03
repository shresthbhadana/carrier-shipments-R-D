const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const subscriptionRepository = require("../repository/subscriptionRepository");

const getErrorMessage = (error) => {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    if (error.description) return error.description;
    if (error.error) {
        if (typeof error.error === "string") return error.error;
        if (error.error.description) return error.error.description;
        if (error.error.message) return error.error.message;
    }
    return error.message || "Unknown error";
};

const createPlan = async(payload)=>{
try{
const period = payload.period;
const interval= payload.interval;
const amount = payload.amount;
const planName = payload.planName;
  if (!period) {
            throw new Error("Period is required");
        }

        if (!interval || interval <= 0) {
            throw new Error("Valid interval is required");
        }

        if (!amount || amount <= 0) {
            throw new Error("Valid amount is required");
        }

        if (!planName) {
            throw new Error("Plan name is required");
        }

 const plan = await razorpay.plans.create({
            period,
            interval,
            item: {
                name: planName,
                amount: amount * 100,
                currency: "INR"
            }
        });

        const taxRate = parseFloat(process.env.TAX_RATE || "0.18");
        const totalAmount = Number((amount * (1 + taxRate)).toFixed(2));

        return {
            ...plan,
            amount: `${amount} + ${taxRate * 100}% GST`,
            totalAmount
        };

    
    }catch(error){
        console.error("Error in createPlan:", error);
        throw new Error(
            getErrorMessage(error) ||
            "Failed to create plan"
        );
    }
}

const createSubscription = async({
    userId,
    planId,
    totalCount = 12,
    customerNotify = 1,
    startAt,
    addons
})=>{
try{
    if(!userId){
        throw new Error("userId is required")
    }
    if(!planId){
        throw new Error("planId is required")
    }
     if(totalCount<=0){
        throw new Error("totalCount should be greater than 0");
    }
    if(customerNotify !== 0 && customerNotify !== 1){
        throw new Error("customerNotify should be 0 or 1");   
    }

    const options = {
        plan_id: planId,
        total_count: totalCount,
        customer_notify: customerNotify
    };

    if (startAt) {
        options.start_at = startAt;
    }

    if (addons && addons.length > 0) {
        options.addons = addons.map(addon => ({
            item: {
                name: addon.item.name,
                amount: addon.item.amount * 100, // convert to subunits
                currency: addon.item.currency || "INR"
            }
        }));
    }

    const subscription = await razorpay.subscriptions.create(options);


const savedSubscription = await subscriptionRepository.create({
    userId,
    razorpayPlanId: planId,
    razorpaySubscriptionId: subscription.id,
    status: subscription.status,
    totalCount
});

return {
    subscription,
    savedSubscription
};
    }catch(error){
        console.error("Error in createSubscription:", error);
        throw new Error(
            getErrorMessage(error) ||
            "Failed to create subscription"
        );
    }
}

const fetchSubscription = async(subscriptionId)=>{
    try{
if(!subscriptionId){
    throw new Error("SubscriptionId is required")
}
 return await razorpay.subscriptions.fetch(subscriptionId);




    }catch(error){
        console.error("Error in fetchSubscription:", error);
        throw new Error(
            getErrorMessage(error) || "failed in fetching subscription"
        );
    }
}

const cancelSubscription = async(subscriptionId)=>{
    try{
        if(!subscriptionId){
    throw new Error("SubscriptionId is required")
}
const subscription = await razorpay.subscriptions.cancel(subscriptionId);


const updatedSubscription = await subscriptionRepository.updateStatus(
    subscriptionId,
    subscription.status || "cancelled"
);

return {
    subscription,
    updatedSubscription
};
    }catch(error){
        console.error("Error in cancelSubscription:", error);
        throw new Error(
            getErrorMessage(error) || "failed in cancelling subscription"
        );
    }
}

const getUserSubscriptions = async ({ userId, limit = 10, skip = 0 }) => {
    try {
        if (!userId) {
            throw new Error("userId is required");
        }
        return await subscriptionRepository.findAllSubscription({ userId, limit, skip });
    } catch (error) {
        throw new Error(
            error.message || "Failed to fetch user subscriptions from database"
        );
    }
};

const updateSubscriptionStatus = async (subscriptionId, status) => {
    try {
        if (!subscriptionId || !status) {
            throw new Error("subscriptionId and status are required");
        }
        const updated = await subscriptionRepository.updateStatus(subscriptionId, status);
        if (!updated) {
            throw new Error("Subscription not found in database");
        }
        return updated;
    } catch (error) {
        throw new Error(
            error.message || "Failed to update subscription status in database"
        );
    }
};

const getSubscriptionByRazorpayId = async (subscriptionId) => {
    try {
        if (!subscriptionId) {
            throw new Error("subscriptionId is required");
        }
        const subscription = await subscriptionRepository.findBySubscriptionId(subscriptionId);
        if (!subscription) {
            throw new Error("Subscription not found in database");
        }
        return subscription;
    } catch (error) {
        throw new Error(
            error.message || "Failed to get subscription from database"
        );
    }
};

const verifySubscriptionSignature = async ({
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature
}) => {
    try {
        const isProduction = process.env.NODE_ENV === "production";
        const secret = isProduction
            ? (process.env.RAZORPAY_LIVE_SECRET || process.env.RAZORPAY_KEY_SECRET)
            : process.env.RAZORPAY_TEST_SECRET;
        if (!secret) {
            throw new Error("Razorpay secret is not configured");
        }

        const payload = `${razorpay_payment_id}|${razorpay_subscription_id}`;
        const generated_signature = crypto
            .createHmac("sha256", secret)
            .update(payload)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            throw new Error("Signature verification failed");
        }

        const subscription = await subscriptionRepository.updateStatus(
            razorpay_subscription_id,
            "active"
        );

        if (!subscription) {
            throw new Error("Subscription not found in database");
        }

        return subscription;
    } catch (error) {
        if (process.env.NODE_ENV !== "test") {
            console.error("Error in verifySubscriptionSignature:", error);
        }
        throw new Error(getErrorMessage(error) || "Signature verification failed");
    }
};

const processWebhook = async (event, signature, rawBody) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (webhookSecret && signature && rawBody) {
            const generated_signature = crypto
                .createHmac("sha256", webhookSecret)
                .update(rawBody)
                .digest("hex");

            if (generated_signature !== signature) {
                throw new Error("Webhook signature verification failed");
            }
        }

        const eventName = event.event;
        const payload = event.payload;

        if (!payload || !payload.subscription || !payload.subscription.entity) {
            return { message: "Ignored event: missing subscription entity" };
        }

        const subscriptionEntity = payload.subscription.entity;
        const razorpaySubscriptionId = subscriptionEntity.id;
        const status = subscriptionEntity.status;

        let localStatus = status;
        if (status === "authenticated") localStatus = "active";

        const updated = await subscriptionRepository.updateStatus(
            razorpaySubscriptionId,
            localStatus
        );

        return {
            event: eventName,
            subscriptionId: razorpaySubscriptionId,
            status: localStatus,
            updated
        };
    } catch (error) {
        console.error("Error in processWebhook:", error);
        throw new Error(getErrorMessage(error) || "Failed to process webhook");
    }
};

module.exports = {
    createPlan,
    createSubscription,
    fetchSubscription,
    cancelSubscription,
    getUserSubscriptions,
    updateSubscriptionStatus,
    getSubscriptionByRazorpayId,
    verifySubscriptionSignature,
    processWebhook
};
