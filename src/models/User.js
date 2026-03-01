module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    phoneNumber: { type: DataTypes.STRING, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    otp: { type: DataTypes.STRING },
    otpExpiry: { type: DataTypes.DATE },
  
   isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    fullName: DataTypes.STRING,
    occupation: DataTypes.STRING,
    goal: DataTypes.STRING,
    type: { type: DataTypes.ENUM("mentor","school","business","user"), defaultValue: "user" },
    accountType: { type: DataTypes.ENUM("public","private"), defaultValue: "public" },
    uniqueId: { type: DataTypes.STRING, unique: true },
    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    showFollowers: { type: DataTypes.BOOLEAN, defaultValue: true },
    showFollowing: { type: DataTypes.BOOLEAN, defaultValue: true },
    description: { type: DataTypes.TEXT },
    userVerifyed:{ type: DataTypes.BOOLEAN, defaultValue: false },
    premiumVerifyed:{ type: DataTypes.BOOLEAN, defaultValue: false },
   // schoolVerifyed:{ type: DataTypes.BOOLEAN, defaultValue: false },
    address: { type: DataTypes.TEXT,defaultValue:"Enter Address"},
    image: { type: DataTypes.STRING,defaultValue: null},
    isOnline:{ type: DataTypes.BOOLEAN,defaultValue: false},
        // image: {
    // type: DataTypes.STRING,
    // get() {
    //   const rawValue = this.getDataValue("image");
    //   if (!rawValue) return null;

    //   const baseUrl = process.env.BASE_URL || "http://localhost:4000";
    //   return `${baseUrl}/${rawValue}`;
    // },
 // },
  });

  User.associate = (models) => {
    // Followers & Following (self-referencing many-to-many)
    User.belongsToMany(models.User, {
      through: models.UserFollowers,
      as: "Following",
      foreignKey: "followerId",
      otherKey: "followingId"
    });

    User.belongsToMany(models.User, {
      through: models.UserFollowers,
      as: "Followers",
      foreignKey: "followingId",
      otherKey: "followerId"
    });
User.belongsToMany(models.Chat, {
  through: "ChatUsers",
  as: "participants", // us
  foreignKey: "userId",
  otherKey: "chatId",
});
    // Follow Requests
    User.hasMany(models.FollowRequest, { as: "SentRequests", foreignKey: "requesterId" });
    User.hasMany(models.FollowRequest, { as: "ReceivedRequests", foreignKey: "targetId" });
    
  User.associate = (models) => {
    User.belongsToMany(models.Group, { through: 'UserGroups' }); // ✅ must be models.Group
  };
    
  };

  return User;
};
