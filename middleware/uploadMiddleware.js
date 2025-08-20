import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = "uploads";
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  console.log("file", file)
  // check mimetype
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) {
    // fallback to extension check
    cb(null, true);
  } else {
    cb(new Error("Images only (jpg, jpeg, png, webp)!"));
  }

};


export const upload = multer({ storage, fileFilter });
