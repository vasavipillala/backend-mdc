module.exports = (sequelize, DataTypes) => {
  const SavedPost = sequelize.define(
    "SavedPost",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      indexes: [
        {
          unique: true,
          fields: ["user_id", "post_id"],
        },
      ],
    }
  );

  SavedPost.associate = (models) => {
    SavedPost.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    // ✅ THIS WAS THE CRASH
    SavedPost.belongsTo(models.UploadPosts, {
      foreignKey: "postId",
      as: "post",
    });
  };

  return SavedPost;
};
