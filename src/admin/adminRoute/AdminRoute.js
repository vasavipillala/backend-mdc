const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/authenticateAdmin");
const { loginAdmin } = require("./admin.controller");

router.post("/login", loginAdmin);

router.get("/dashboard", adminAuth, (req, res) => {
  res.json({ message: "Welcome Admin", admin: req.admin });
});

module.exports = router;
