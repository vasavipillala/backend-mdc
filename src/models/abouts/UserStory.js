module.exports = (sequelize, DataTypes) => {
  const UserStory = sequelize.define("UserStory", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    story: {
      type: DataTypes.TEXT,
    },
  });

  return UserStory;
};