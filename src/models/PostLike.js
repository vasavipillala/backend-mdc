module.exports = (sequelize, DataTypes) => {
  const PostLike = sequelize.define("PostLike", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isLiked: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  PostLike.associate = (models) => {
    PostLike.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    PostLike.belongsTo(models.UploadPosts, { foreignKey: "postId", as: "post" });
  };

  return PostLike;
};
