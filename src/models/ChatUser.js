// models/chatuser.js
// module.exports = (sequelize, DataTypes) => {
//   const ChatUser = sequelize.define(
//     "ChatUser",
//     {
//       role: {
//         type: DataTypes.STRING,
//         defaultValue: "member",
//       },
//     },
//     {
//    tableName: "ChatUsers",
//       schema: "public",
//       timestamps: false,
//       freezeTableName: true,
//     }
//   );

//   return ChatUser;
// };
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
      tableName: "ChatUsers",
      schema: "public",      // ⭐ important
      freezeTableName: true,
      timestamps: true,
    }
  );

  return ChatUser;
};