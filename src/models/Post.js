module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define("Post", {
    type: {
      type: DataTypes.ENUM("text", "photo", "video"),
      allowNull: false,
    },
    textContent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
    },
    title: {
      type: DataTypes.TEXT,
    },
    mediaPaths: {
      type: DataTypes.JSON, // ✅ stores array of images or single video
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // ✅ Add new columns here
    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    commentsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isDeleted: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
}
  });

  Post.associate = (models) => {
    Post.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Post.hasMany(models.PostLike, { foreignKey: "postId", as: "likes" }); 
    //Post.hasMany(models.SavedPost, {foreignKey: "postId",as: "savedBy"});

  //  Post.hasMany(models.PostComment, { foreignKey: "postId", as: "comment" }); // ✅ relation
  };

  return Post;
};
