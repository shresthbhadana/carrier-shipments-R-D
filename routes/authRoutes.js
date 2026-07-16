const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const validate = require("../validators/validateMiddleware");
const { signupSchema, loginSchema } = require("../validators/userValidators");

router.post("/signup", validate(signupSchema), authController.signup);
router.post("/login/step1", validate(loginSchema), authController.loginStep1);
router.post("/login/verify", authController.loginStep2Verify);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);


module.exports = router;
