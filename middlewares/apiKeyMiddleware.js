const crypto = require("crypto");
const ApiKey = require("../models/apiKeyModel");

const validateApiKey = async (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
        return res.status(401).json({ success: false, message: ["Unauthorized: API key missing"] });
    }

    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
    const keyDoc = await ApiKey.findOne({ hashedKey, isActive: true });

    if (!keyDoc) {
        return res.status(403).json({ success: false, message: ["Forbidden: Invalid API key"] });
    }

    if (keyDoc.expiresAt && new Date() > keyDoc.expiresAt) {
        return res.status(403).json({ success: false, message: ["Forbidden: API key has expired"] });
    }

    next();
};

module.exports = { validateApiKey };
