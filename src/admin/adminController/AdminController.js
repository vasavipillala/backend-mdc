const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Admin = require("./admin.model");

exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin || !admin.isActive) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: admin._id, role: "admin" },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRES }
  );

  res.json({
    token,
    admin: {
      id: admin._id,
      email: admin.email,
    }
  });
};
