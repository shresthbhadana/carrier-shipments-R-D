const jwt = require("jsonwebtoken");
const userRepository = require("../repository/userRepository");

const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: ["Unauthorized: Token not provided"] });
    }
    const token = authHeader.split(" ")[1];
    

    const secrets = process.env.JWT_SECRETS 
        ? process.env.JWT_SECRETS.split(",") 
        : [process.env.JWT_SECRET];
    let decoded = null;
    let errorToThrow = null;
    
    for (const secret of secrets) {
        try {
            decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
            break;
        } catch (err) {
            errorToThrow = err;
        }
    }
    if (!decoded) {
        return res.status(403).json({
            success: false,
            message: ["Forbidden: Invalid or expired token"],
            error: errorToThrow ? errorToThrow.message : null
        });
    }
    const user = await userRepository.findById(decoded.id);
    if (!user) {
        return res.status(401).json({ success: false, message: ["Unauthorized: User not found"] });
    }
    req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
    };
    next();
};


 



// Admin middleware
const adminMiddleware = (req,res,next)=>{

    if(req.user.role !== "admin"){

        return res.status(403).json({
            success:false,
            message:"Admin access required"
        });

    }


    next();

};


module.exports = {
    authenticateJWT,
    adminMiddleware
};