module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define("Group", {
    id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("public", "private"),
      defaultValue: "public",
    },
    inviteLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    messagePermission: {
      type: DataTypes.ENUM("everyone", "admin", "some"),
      defaultValue: "everyone",
    },
    schoolId: {
  type: DataTypes.INTEGER,
  allowNull: true,
},
 groupImage: { type: DataTypes.STRING,defaultValue: null},
  });

  Group.associate = (models) => {
    // ✅ Many Users can belong to many Groups (through GroupMember)
    Group.belongsToMany(models.User, {
      through: models.GroupMember,
      foreignKey: "groupId",
      otherKey: "userId",
      as: "members",
    });

    // ✅ A Group has one creator (User)
    Group.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });

    // ✅ A Group has many Messages
    Group.hasMany(models.GroupMessage, {
      foreignKey: "groupId",
      as: "messages",
      onDelete: "CASCADE",
    });

    // ✅ A Group has many GroupMembers (important for your getMyGroups API)
    Group.hasMany(models.GroupMember, {
      foreignKey: "groupId",
      as: "groupMembers",
      onDelete: "CASCADE",
    });
  };

  return Group;
};
