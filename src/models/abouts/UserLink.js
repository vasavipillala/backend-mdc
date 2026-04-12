module.exports = (sequelize, DataTypes) => {
  const UserLink = sequelize.define("UserLink", {
    userId: DataTypes.INTEGER,
    type: DataTypes.STRING,
    url: DataTypes.STRING,
  });

  return UserLink;
};