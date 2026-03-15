module.exports = (sequelize, DataTypes) => {
  const ChatUser = sequelize.define(
    "ChatUser",
    {
      role: {
        type: DataTypes.STRING,
        defaultValue: "member",
      },
    },
    {
      tableName: "chat_users",
      schema: "public",
      freezeTableName: true,
      timestamps: true,
    }
  );

  return ChatUser;
};