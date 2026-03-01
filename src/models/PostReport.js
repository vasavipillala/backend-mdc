// src/models/PostReport.js
module.exports = (sequelize, DataTypes) => {
  const PostReport = sequelize.define("PostReport", {
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reportedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "reviewed", "action_taken"),
      defaultValue: "pending",
    },
  });

  PostReport.associate = (models) => {
    PostReport.belongsTo(models.UploadPosts, { foreignKey: "postId", as: "post" });
    PostReport.belongsTo(models.User, { foreignKey: "reportedBy", as: "user" });
  };

  return PostReport;
};
