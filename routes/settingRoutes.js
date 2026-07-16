const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settingController");
const { authenticateJWT, adminMiddleware } = require("../middlewares/authMiddleware");

router.use(authenticateJWT);
router.use(adminMiddleware);

router.get("/", settingController.getSettings);
router.post("/", settingController.updateSetting);

module.exports = router;
