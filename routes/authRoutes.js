const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const validate = require("../validators/validateMiddleware");
const { signupSchema, loginSchema } = require("../validators/userValidators");

router.post("/signup", validate(signupSchema), authController.signup);
router.post("/login", validate(loginSchema), authController.login);

module.exports = router;
