const jwt = require("jsonwebtoken");
const userRepository = require("../repository/userRepository");

const generateToken = (userId)=>{
    return jwt.sign({id:userId}, process.env.JWT_SECRET, {
         expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    });
}

const registerUser = async(payload)=>{
    const {name,email,password} = payload;
      if (!name || !email || !password) {
        throw new Error("Name, email, and password are required");
    }
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
        throw new Error("User with this email already exists");
    }
       const user = await userRepository.createUser({ name, email, password });
    const token = generateToken(user._id);
    return {
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        },
        token
    };
  
}
const loginUser = async(payload)=>{
     const {email,password} = payload;

    //validation
    if(!email || !password) {
        throw new Error("Please provide email and password");
    }

    const user = await userRepository.findByEmail(email);
    if(!user) {
        throw new Error("User not found");
    }

    const isMatch = await user.matchPassword(password);

    if(!isMatch) {
        throw new Error("Invalid password");
    }

    const token = generateToken(user._id);

    return {
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        },
        token
    };

}

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
    getUserById
};