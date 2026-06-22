const mongoose = require("mongoose");
const bcyrpt = require("bcrypt");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required : true,
            unique: true,
        }, 
         password: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);


UserSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }
    const salt = await bcyrpt.genSalt(10);
    this.password = await bcyrpt.hash(this.password, salt);
});
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcyrpt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
