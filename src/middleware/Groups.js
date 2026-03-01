const uploadGroups = multer({
  storage: multer.diskStorage({
    destination: "uploads/groups/",
    filename: (req, file, cb) => {
      cb(
        null,
        Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)
      );
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // groups do not need 50MB
});
