const mongoose = require('mongoose');
const refreshTokenSchema = new mongoose.Schema({
    userId :{
        type : mongoose.Schema.Types.ObjectId,
        ref: "User",
        required : true
    },
    token : {
        type : "String",
        required: true,
        unique : true
    },
    expiresAt : {
        type : Date,
        required : true
    },
    isUsed : {
        type : Boolean,
        default : false,
    },
    isRevoked : {
        type : Boolean,
        default : false,
    }
},{timestamps :true})


module.exports = mongoose.model("RefreshToken",refreshTokenSchema);
