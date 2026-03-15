const { Sequelize, DataTypes } = require("sequelize");

// 1️⃣ Connect to PostgreSQL
// const sequelize = new Sequelize("mdc", "postgres", "1234", {
//   host: "localhost",
//   dialect: "postgres",
//   logging: console.log,
// });

const sequelize = new Sequelize(
  process.env.NEONURL,
  {
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // important for Neon/Supabase
      },
    },
    logging: console.log,
  
  pool: {                          // ← Recommended addition
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {                        // ← Optional but good for consistency
      timestamps: true,
      underscored: true,
    },
  }
);
// 2️⃣ Test connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Connected to PostgreSQL with Sequelize"))
  .catch((err) => console.error("❌ DB connection error:", err));

// 3️⃣ Import all models
const User = require("./src/models/User")(sequelize, DataTypes);
const UserFollowers = require("./src/models/UserFollowers")(sequelize, DataTypes);
const FollowRequest = require("./src/models/FollowRequest")(sequelize, DataTypes);
const Chat = require("./src/models/Chat")(sequelize, DataTypes);
const Message = require("./src/models/Message")(sequelize, DataTypes);
const ChatUser = require("./src/models/ChatUser")(sequelize, DataTypes); // add this
// Group-related models
const Group = require("./src/models/Group")(sequelize, DataTypes);
const GroupMember = require("./src/models/GroupMember")(sequelize, DataTypes);
const GroupMessage = require("./src/models/GroupMessage")(sequelize, DataTypes);

// Post-related models
const UploadPosts = require("./src/models/Post")(sequelize, DataTypes);
const PostLike = require("./src/models/PostLike")(sequelize, DataTypes);
const PostComment = require("./src/models/PostComment")(sequelize, DataTypes);
const PostReport = require("./src/models/PostReport")(sequelize, DataTypes);
const SavedPost = require("./src/models/SavedPost")(sequelize, DataTypes);

// 4️⃣ Run associations

if (User.associate) {
  User.associate({
    UserFollowers,
    FollowRequest,
    User,
    Chat,
    Message,
    Group,
    UploadPosts,
    ChatUser
  });
}

if (UserFollowers.associate) UserFollowers.associate({ User });
if (FollowRequest.associate) FollowRequest.associate({ User });

if (Chat.associate) Chat.associate({ User, Message });
if (Message.associate) Message.associate({ Chat, User });

// Group associations
if (Group.associate) Group.associate({ GroupMember, GroupMessage, User });
if (GroupMember.associate) GroupMember.associate({ Group, User });
if (GroupMessage.associate) GroupMessage.associate({ Group, User });

// ✅ Post associations (FIXED & SAFE)
if (UploadPosts.associate) {
  UploadPosts.associate({
    User,
    PostLike,
    PostComment,
    PostReport,
    SavedPost, // ✅ REQUIRED
  });
}

if (PostLike.associate) PostLike.associate({ User, UploadPosts });
if (PostComment.associate)
  PostComment.associate({ User, UploadPosts, PostComment });

if (PostReport.associate) PostReport.associate({ UploadPosts, User });

// ❌ DO NOT pass SavedPost to itself
if (SavedPost.associate) SavedPost.associate({ User, UploadPosts });

// 5️⃣ Sync database
// sequelize
//   .sync({ alter: true })
//   .then(() => console.log("✅ Tables synced successfully"))
//   .catch((err) => console.error("❌ Sync error:", err));

// 6️⃣ Export all models
module.exports = {
  sequelize,
  User,
  UserFollowers,
  FollowRequest,
  Chat,
  Message,
  Group,
  GroupMember,
  GroupMessage,
  UploadPosts,
  PostLike,
  PostComment,
  PostReport,
  SavedPost,
  ChatUser,
};
