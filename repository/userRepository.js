const User = require("../models/userModel");

const createUser = async (payload) => {
    return User.create(payload);
};

const findByEmail = async (email) => {
    return User.findOne({ email });
};

const findById = async (userId) => {
    return User.findById(userId);
};

module.exports = {
    createUser,
    findByEmail,
    findById
};
