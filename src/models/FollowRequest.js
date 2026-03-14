module.exports = (sequelize, DataTypes) => {
  const FollowRequest = sequelize.define(
    "FollowRequest",
    {
      requesterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "requester_id",
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },

      targetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "target_id",
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },

      status: {
        type: DataTypes.ENUM("pending", "accepted", "rejected"),
        defaultValue: "pending",
      },
    },
    {
      tableName: "follow_requests",
      indexes: [
        {
          unique: true,
          fields: ["requester_id", "target_id"], // snake_case
        },
      ],
    }
  );

  FollowRequest.associate = (models) => {
    FollowRequest.belongsTo(models.User, {
      as: "Requester",
      foreignKey: "requesterId",
    });

    FollowRequest.belongsTo(models.User, {
      as: "Target",
      foreignKey: "targetId",
    });
  };

  return FollowRequest;
};