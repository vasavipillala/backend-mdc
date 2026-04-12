module.exports = (sequelize, DataTypes) => {
  const Education = sequelize.define("Education", {
    userId: DataTypes.INTEGER,
    schoolName: DataTypes.STRING,
    course: DataTypes.STRING,
    startYear: DataTypes.STRING,
    endYear: DataTypes.STRING,
  });

  return Education;
};