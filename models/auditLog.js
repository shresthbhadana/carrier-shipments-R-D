const mongoose =  require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    userId : {
        type :  mongoose.Schema.ObjectId,
        ref : "User",
        default : null
    },
    action : {
        type:String,
        required : true
    },
    status  : {
        type : String,
        enum : ["success","failure"],
        required : true
    },
    ipAddress  :{
        type : String,
        required: true
    },
    userAgent : {
        type  :String,
        required: true
    },
    details : {
        type : mongoose.Schema.Types.Mixed,
        default : {}
    }
},{timestamps:true});
module.exports = mongoose.model("AuditLog",AuditLogSchema)