const mongoose = require("mongoose");
const ProductOrderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product"
                },
                quantity: Number,
                price: Number
            }
        ],

        subtotal: Number,
        shippingPrice: Number,
        totalAmount: Number,

        shipmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shipment"
        },

        orderStatus: {
            type: String,
            enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
            default: "pending"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "ProductOrder",
    ProductOrderSchema
);