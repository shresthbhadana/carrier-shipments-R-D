const jwt = require("jsonwebtoken");
const userRepository = require("../repository/userRepository");


const authenticateJWT = async (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {

        const token = authHeader.split(" ")[1];

        try {

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );


            const user = await userRepository.findById(decoded.id);


            if (!user) {
                return res.status(401).json({
                    success:false,
                    message:["Unauthorized: User not found"]
                });
            }


            req.user = {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role
            };


            next();


        } catch(error){

            return res.status(403).json({
                success:false,
                message:["Forbidden: Invalid or expired token"]
            });

        }

    } else {

        return res.status(401).json({
            success:false,
            message:["Unauthorized: Token not provided"]
        });

    }
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