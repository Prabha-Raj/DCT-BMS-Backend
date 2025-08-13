import mongoose from "mongoose";

const librarySchema = new mongoose.Schema({
  librarian: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", required: true 
  },
  libraryName: {
    type:String,
    required:true
  },
  description: String,
  libraryType: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "LibraryType", required: true 
  },
  services: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Facility" 
  }],
  logo: String,
  images: [String],
  location: String,
  pinCode:String,
  coordinates: {
    lat: String,
    lng: String
  },
  contactNumber: String,
  email: { type: String, required: true },
  timingFrom: String,
  timingTo: String,
  totalBooks: Number,
  isBlocked: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  status:{
    type:String,
    enum:["pending", "in_review", "approved", "rejected"],
    default:"pending"
  },
   qrCode: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});
const Library = mongoose.model("Library", librarySchema);
export default Library;
