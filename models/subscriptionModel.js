const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        razorpayPlanId: {
            type: String,
            required: true
        },

        razorpaySubscriptionId: {
            type: String,
            required: true,
            unique: true
        },

        status: {
            type: String,
            enum: [
                "created",
                "active",
                "pending",
                "cancelled",
                "completed"
            ],
            default: "created"
        },

        totalCount: {
            type: Number,
            default: 12
        },

        paidCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Subscription",
    subscriptionSchema
);