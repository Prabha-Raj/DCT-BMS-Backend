import mongoose from "mongoose";

const librarySchema = new mongoose.Schema({
  libraryName: { type: String, required: true },
  libraryType: { type: String, required: true },
  description: String,
  logo: String,
  images: [String],
  location: String,
  contactNumber: String,
  email: String,
  password: String,
  timingFrom: String,
  timingTo: String,
  services: [String],
  totalBooks: Number
}, {
  timestamps: true
});

export default mongoose.model("Library", librarySchema);
