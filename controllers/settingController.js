const Setting = require("../models/settingModel");
const shipmentService = require("../services/shipmentService");

const getSettings = async (req, res, next) => {
    try {
        const settings = await Setting.find({});
        res.status(200).json({
            success: true,
            message: ["Settings fetched successfully"],
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

const updateSetting = async (req, res, next) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({
                success: false,
                message: ["Key and value are required"]
            });
        }
        const setting = await Setting.findOneAndUpdate(
            { key },
            { value },
            { new: true, upsert: true }
        );
        if (key === "platform_fee" && shipmentService.invalidatePlatformFeeCache) {
            await shipmentService.invalidatePlatformFeeCache();
        }
        res.status(200).json({
            success: true,
            message: ["Setting updated successfully"],
            data: setting
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSettings,
    updateSetting
};
