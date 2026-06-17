const userService = require("../services/userService");

const signup = async (req, res, next) => {
    try {
        const result = await userService.registerUser(req.body);
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: result
        });
    } catch (error) {
        if (error.message.includes("exists")) {
            return res.status(400).json({
                success: false,
                message: [error.message]
            });
        }
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const result = await userService.loginUser(req.body);
        res.status(200).json({
            success: true,
            message: "Login successful",
            data: result
        });
    } catch (error) {
        if (error.message.includes("Invalid")) {
            return res.status(401).json({
                success: false,
                message: [error.message]
            });
        }
        next(error);
    }
};

module.exports = {
    signup,
    login
};
