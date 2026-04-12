module.exports = (sequelize, DataTypes) => {
  const UserStory = sequelize.define("UserStory", {
    userId: DataTypes.INTEGER,
    story: DataTypes.TEXT,
  });

  return UserStory;
};