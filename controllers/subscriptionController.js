const subscriptionService = require("../services/subscriptionService");

const createPlan = async(req,res,next)=>{
    try{
        const plan = await subscriptionService.createPlan(req.body)

        return res.status(201).json({
            success : true,
            message : "Plan created successfully",
            data : plan
        }) 
    }
    catch(err){
        next(err)
    }
}

const createSubscriptions = async(req,res,next)=>{
    try{
        const userId = req.user?.id || req.body.userId;
        const { planId, totalCount, customerNotify, startAt, addons } = req.body;
        const subscription = await subscriptionService.createSubscription({
            userId,
            planId,
            totalCount,
            customerNotify,
            startAt,
            addons
        })

        return res.status(201).json({
            success : true,
            message : "Subscription created successfully",
            data : subscription
        })
    }
    catch(err){
        next(err)
    }
}

const fetchSubscriptions = async(req,res,next)=>{
    try{
        const {subscriptionId}= req.params
        const subscription = await subscriptionService.fetchSubscription(subscriptionId)
        return res.status(200).json({
            success : true,
            message : "Subscription fetched successfully",
            data : subscription
        })
    }
    catch(err){
        next(err)
    }
}

const cancelSubscription = async(req,res,next)=>{
    try{
        const {subscriptionId}= req.params
        const subscription = await subscriptionService.cancelSubscription(subscriptionId)
        return res.status(200).json({
            success : true,
            message : "Subscription cancelled successfully",
            data : subscription
        })
    }
    catch(err){
        next(err)
    }
}

const getUserSubscription = async(req,res,next)=>{
    try{
        const userId = req.params.userId || req.user?.id;

        if (userId !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: ["Forbidden: You do not have access to this user's subscriptions"]
            });
        }

        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;
        const subscription = await subscriptionService.getUserSubscriptions({ userId, limit, skip })
        return res.status(200).json({
            success : true,
            message : "User Subscription fetched successfully",
            data : subscription
        })
    }
    catch(err){
        next(err)
    }
}

const updateSubscriptionStatus = async(req,res,next)=>{
    try{
        const {subscriptionId,status} = req.params
        const subscription = await subscriptionService.updateSubscriptionStatus(subscriptionId,status)
        return res.status(200).json({
            success : true,
            message : "Subscription Status updated successfully",
            data : subscription
        })
    }
    catch(err){
        next(err)
    }
}

const getSubscriptionByRazorpayId = async(req,res,next)=>{
    try{
        const {subscriptionId} = req.params
        const subscription = await subscriptionService.getSubscriptionByRazorpayId(subscriptionId)
        return res.status(200).json({
            success : true,
            message : "Subscription fetched successfully",
            data : subscription
        })
    }
    catch(err){
        next(err)
    }
}

const verifySubscription = async(req,res,next)=>{
    try{
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
        const result = await subscriptionService.verifySubscriptionSignature({
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature
        });
        return res.status(200).json({
            success : true,
            message : "Payment signature verified successfully",
            data : result
        });
    }
    catch(err){
        next(err);
    }
}

const handleWebhook = async(req,res,next)=>{
    try{
        const signature = req.headers["x-razorpay-signature"];
        const result = await subscriptionService.processWebhook(req.body, signature, req.rawBody);
        return res.status(200).json({
            success : true,
            message : "Webhook processed successfully",
            data : result
        });
    }
    catch(err){
        next(err);
    }
}

module.exports = {
    createPlan,
    createSubscriptions,
    fetchSubscriptions,
    cancelSubscription,
    getUserSubscription,
    updateSubscriptionStatus,
    getSubscriptionByRazorpayId,
    verifySubscription,
    handleWebhook
}
