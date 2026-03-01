module.exports = (sequelize, DataTypes) => {
  const UserFollowers = sequelize.define("UserFollowers", {
    followerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    followingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["followerId", "followingId"] // prevent duplicate follows
      }
    ]
  });

  UserFollowers.associate = (models) => {
    UserFollowers.belongsTo(models.User, { as: "FollowerUser", foreignKey: "followerId" });
    UserFollowers.belongsTo(models.User, { as: "FollowingUser", foreignKey: "followingId" });
  };

  return UserFollowers;
};
