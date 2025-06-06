// config/multerConfig.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinaryConfig.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'uplodes',
    format: async (req, file) => 'png', // You can set the format dynamically
  },
});

const upload = multer({ storage });

export default upload;
