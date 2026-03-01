module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define("Admin", {
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("superadmin", "moderator"),
      defaultValue: "moderator",
    },
  });

  return Admin;
};
