const mongoose = require("mongoose");

const ApiKeySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    hashedKey: {
        type: String,
        required: true,
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("ApiKey", ApiKeySchema);
