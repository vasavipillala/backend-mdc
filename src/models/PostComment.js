module.exports = (sequelize, DataTypes) => {
  const PostComment = sequelize.define("PostComment", {
    commentText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true, // null means it's a main comment
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  PostComment.associate = (models) => {
    // Link to post
    PostComment.belongsTo(models.UploadPosts, {
      foreignKey: "postId",
      as: "post",
    });

    // Link to user
    PostComment.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    // Self-association for replies
    PostComment.hasMany(models.PostComment, {
      as: "replies",
      foreignKey: "parentId",
    });

    PostComment.belongsTo(models.PostComment, {
      as: "parentComment",
      foreignKey: "parentId",
    });
  };

  return PostComment;
};
