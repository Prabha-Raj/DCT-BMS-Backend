import mongoose from "mongoose";

const libraryType = new mongoose.Schema(
  {
    type: { type: String, required: true },
    isActive:{
        type:Boolean,
        default:true
    }
  },
  { timestamps: true }
);

const LibraryType = new mongoose.model("LibraryType", libraryType);
export default LibraryType
