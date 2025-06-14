import mongoose from "mongoose";

const facilitySchema = new mongoose.Schema(
  {
    facility: { type: String, required: true },
    isActive:{
        type:Boolean,
        default:true
    }
  },
  { timestamps: true }
);

const Facility = new mongoose.model("Facility", facilitySchema);
export default Facility
