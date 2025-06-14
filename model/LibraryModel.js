import mongoose from "mongoose";

const librarySchema = new mongoose.Schema({
  librarian: { type: mongoose.Schema.Types.ObjectId, ref:"User", required: true },
  description: String,
  libraryType: { type: mongoose.Schema.Types.ObjectId, ref:"LibraryType", required: true },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref:"Facility"}],
  logo: String,
  images: [String],
  location: String,
  contactNumber: String,
  email: { type: String, required: true },
  timingFrom: String,
  timingTo: String,
  totalBooks: Number
}, {
  timestamps: true
});
const Library = mongoose.model("Library", librarySchema);
export default Library;
