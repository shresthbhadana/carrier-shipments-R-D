const jwt = require("jsonwebtoken");
const userRepository = require("../repository/userRepository");
const crypto = require("crypto");
const RefreshToken = require("../models/refreshToken");
const { getRedisKey, setRedisKey } = require("../config/redis");


const generateToken = async (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: "15m"
    });
    const refreshTokenString = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); 

    await RefreshToken.create({
        userId: userId,
        token: refreshTokenString,
        expiresAt: expiresAt
    });
    return { accessToken, refreshToken: refreshTokenString };
};

const registerUser = async (payload) => {
    const { name, email, password } = payload;
    if (!name || !email || !password) {
        throw new Error("Name, email, and password are required");
    }
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
        throw new Error("User with this email already exists");
    }
    const user = await userRepository.createUser({ name, email, password });
    const tokens = await generateToken(user._id);
    return {
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        },
        ...tokens
    };
};
const refreshAuthToken = async (tokenString) => {
    const isBlacklisted = await getRedisKey(`blacklist:token:${tokenString}`);
    if (isBlacklisted) {
        throw new Error("Token is blacklisted");
    }
    const refreshTokenDoc = await RefreshToken.findOne({ token: tokenString });
    if (!refreshTokenDoc) {
        throw new Error("invalid REFRESH token");
    }
    if (refreshTokenDoc.isUsed || refreshTokenDoc.isRevoked) {
        await RefreshToken.updateMany({ userId: refreshTokenDoc.userId }, { isRevoked: true });
        throw new Error("security alert : refreshed token reuse detected.force logging out all sessions");
    }
    if (new Date() > refreshTokenDoc.expiresAt) {
        throw new Error("Expired refresh token");
    }


    refreshTokenDoc.isUsed = true;
    await refreshTokenDoc.save();

    return await generateToken(refreshTokenDoc.userId);
};

const loginUser = async (payload) => {
    const { email, password } = payload;

   
    if (!email || !password) {
        throw new Error("Please provide email and password");
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
        throw new Error("Invalid credentials");
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    const tokens = await generateToken(user._id);

    return {
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        },
        ...tokens
    };
};

const getUserById = async (userId) => {
    const user = await userRepository.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    return {
        id: user._id,
        name: user.name,
        email: user.email
    };
};

module.exports = {
    registerUser,
    loginUser,
    getUserById,
    refreshAuthToken,
};