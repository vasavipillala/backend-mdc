module.exports = (sequelize, DataTypes) => {
  const FollowRequest = sequelize.define("FollowRequest", {
    requesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      defaultValue: "pending",
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["requesterId", "targetId"],
      },
    ],
  });

  FollowRequest.associate = (models) => {
    FollowRequest.belongsTo(models.User, { as: "Requester", foreignKey: "requesterId" });
    FollowRequest.belongsTo(models.User, { as: "Target", foreignKey: "targetId" });
  };

  return FollowRequest;
};
