// models/NotInterestedPost.js

module.exports = (sequelize, DataTypes) => {
  const NotInterestedPost = sequelize.define("NotInterestedPost", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  return NotInterestedPost;
};