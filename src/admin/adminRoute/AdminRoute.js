const express = require("express");
const router = express.Router();
const { loginAdmin } = require("../adminController/AdminController");
const adminAuth = require('../../middleware/auth/AdminAuth')

router.post("/admin", loginAdmin);

router.get("/dashboard", adminAuth, (req, res) => {
  res.json({ message: "Welcome Admin", admin: req.admin });
});

module.exports = router;
