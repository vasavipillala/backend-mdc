module.exports = (sequelize, DataTypes) => {
  const AdminAction = sequelize.define("AdminAction", {
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false }, // e.g., delete_post, ban_user
    targetType: { type: DataTypes.STRING, allowNull: false }, // e.g., "user", "post"
    targetId: { type: DataTypes.INTEGER, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  });

  AdminAction.associate = (models) => {
    AdminAction.belongsTo(models.Admin, { foreignKey: "adminId", as: "admin" });
  };

  return AdminAction;
};
