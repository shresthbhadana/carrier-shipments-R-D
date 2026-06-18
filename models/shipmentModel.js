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
        awbNumber: String,

        shippingPrice: Number,

        status: {
            type: String,
            default: "created"
        },
        pickupConfirmationNumber: String
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Shipment",
    ShipmentSchema
);