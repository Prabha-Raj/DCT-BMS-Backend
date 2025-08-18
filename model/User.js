import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
     name: {
      type: String,
      required: [true, "Name is required"],
      lowercase: true
    },
     email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true
    },
     mobile: {
      type: String,
      required: [true, "Mobile is required"],
      unique: true,
    },
    gender:{
      type:String,
      enum:["male","female", "other"]
    },
    age:{
      type:String
    },
    profileImage:String,
    city:{
      type:String,
    },
    preparingFor:{
      type:String
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 3
    },
    role: {
      type: String,
      enum: ["student", "admin", "librarian"],
      default: "student"
    },
    isBlocked:{
      type:Boolean,
      default:false
    },
  
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
