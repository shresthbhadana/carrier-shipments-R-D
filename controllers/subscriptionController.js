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
        const { planId, totalCount, customerNotify } = req.body;
        const subscription = await subscriptionService.createSubscription({
            userId,
            planId,
            totalCount,
            customerNotify
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

module.exports = {
    createPlan,
    createSubscriptions,
    fetchSubscriptions,
    cancelSubscription,
    getUserSubscription,
    updateSubscriptionStatus,
    getSubscriptionByRazorpayId
}
