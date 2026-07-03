const mongoose = require("mongoose");
const ShipmentSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductOrder",
            index: true
        },

        courierName: String,
        trackingId: String,
        awbNumber: {
            type: String,
            index: true
        },

        shippingPrice: Number,

        status: {
            type: String,
            enum: ["pending", "created", "shipped", "delivered", "cancelled", "pending_booking", "return_created"],
            default: "created"
        },
        pickupConfirmationNumber: String,
        labelUrl: String,
        packages :[
            {
                weight   :{ 
                type: Number,
                width : Number,
                height : Number
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Shipment",
    ShipmentSchema
);