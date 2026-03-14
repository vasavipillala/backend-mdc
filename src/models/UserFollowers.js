module.exports = (sequelize, DataTypes) => {
  const UserFollowers = sequelize.define("UserFollowers", {
    followerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "follower_id",
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    followingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "following_id",
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
  }, {
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["follower_id", "following_id"]
      }
    ]
  });

  UserFollowers.associate = (models) => {
    UserFollowers.belongsTo(models.User, { as: "FollowerUser", foreignKey: "followerId" });
    UserFollowers.belongsTo(models.User, { as: "FollowingUser", foreignKey: "followingId" });
  };

  return UserFollowers;
};