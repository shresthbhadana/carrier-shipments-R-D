const Subscription =
    require("../models/subscriptionModel");

const create = async (payload) => {
    return Subscription.create(payload);
};

const findBySubscriptionId = async (
    subscriptionId
) => {
    return Subscription.findOne({
        razorpaySubscriptionId: subscriptionId
    });
};
const findAllSubscription = async({
    userId,
    limit=10,
    skip=0
})=>{
    const filter={userId}
    return Subscription.find(filter).sort({createdAt:-1}).skip(skip).limit(limit).populate("planId", "name")
}

const updateStatus = async (
    subscriptionId,
    status
) => {
    return Subscription.findOneAndUpdate(
        {
            razorpaySubscriptionId: subscriptionId
        },
        {
            status
        },
        {
            new: true
        }
    );
};

module.exports = {
    create,
    findBySubscriptionId,
    updateStatus,
    findAllSubscription,
};