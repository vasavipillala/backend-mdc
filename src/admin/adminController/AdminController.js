const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {Admin} = require("../../../db")



// async function generateHash() {
//   const password = "123456";
//   const hash = await bcrypt.hash(password, 10);
//   console.log("Hashed password:", hash);
// }



exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({
      where: { email }
    });

    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: admin.id, role: "admin" },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};