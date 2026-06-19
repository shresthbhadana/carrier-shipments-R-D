const razorpay = require("../config/razorpay");
const subscriptionRepository = require("../repository/subscriptionRepository");

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

        const totalAmount = Number((amount * 1.18).toFixed(2));

        return {
            ...plan,
            amount: `${amount} + 18% GST`,
            totalAmount
        };

    
    }catch(error){
        throw new Error(
            error.message ||
            "Failed to create plan"
        );
    }
}

const createSubscription = async({
    userId,
    planId,
    totalCount = 12,
    customerNotify = 1,
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

const subscription = await razorpay.subscriptions.create({
    
       plan_id: planId,
                total_count: totalCount,
                customer_notify: customerNotify
})


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
    throw new Error(
        error.message ||
        "Failed to create subscription"
    )

}
}

const fetchSubscription = async(subscriptionId)=>{
    try{
if(!subscriptionId){
    throw new Error("SubscriptionId is required")
}
 return await razorpay.subscriptions.fetch(subscriptionId);




    }catch(error){
        throw new Error(
            error.message || "failed in fetching subscription"
        )

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
        throw new Error(
            error.message || "failed in cancelling subscription"
        )
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

module.exports = {
    createPlan,
    createSubscription,
    fetchSubscription,
    cancelSubscription,
    getUserSubscriptions,
    updateSubscriptionStatus,
    getSubscriptionByRazorpayId
};
