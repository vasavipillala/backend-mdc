const bcrypt = require("bcryptjs");

async function generateHash() {
  const password = "123456";
  const hash = await bcrypt.hash(password, 10);
  console.log("Hashed password:", hash);
}

generateHash();