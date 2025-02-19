import multer from "multer";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp")
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
// export const uploads = multer({ storage }).fields([
//   { name: "avatar", maxCount: 1 },
//   { name: "coverImage", maxCount: 1 }
// ]);
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
})
