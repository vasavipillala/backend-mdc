const uploadUserImages = multer({
  storage: multer.diskStorage({
    destination: "uploads/users/",
    filename: (req, file, cb) => {
      cb(
        null,
        Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB is enough
});
