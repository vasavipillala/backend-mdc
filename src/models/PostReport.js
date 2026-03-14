// src/models/PostReport.js
module.exports = (sequelize, DataTypes) => {
  const PostReport = sequelize.define(
    "PostReport",
    {
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "post_id",
      },

      reportedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "reported_by",
      },

      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM("pending", "reviewed", "action_taken"),
        defaultValue: "pending",
      },
    },
    {
      tableName: "post_reports",
    }
  );

  PostReport.associate = (models) => {
    PostReport.belongsTo(models.UploadPosts, {
      foreignKey: "postId",
      as: "post",
    });

    PostReport.belongsTo(models.User, {
      foreignKey: "reportedBy",
      as: "user",
    });
  };

  return PostReport;
};