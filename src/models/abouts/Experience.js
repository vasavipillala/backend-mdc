module.exports = (sequelize, DataTypes) => {
  const Experience = sequelize.define("Experience", {
    userId: DataTypes.INTEGER,
    company: DataTypes.STRING,
    role: DataTypes.STRING,
    logo: DataTypes.STRING,
    experienceYears: DataTypes.STRING,
  });

  return Experience;
};