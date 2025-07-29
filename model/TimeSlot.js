import mongoose from "mongoose";

const TimeSlotSchema = new mongoose.Schema(
  {
    library:{
      type: mongoose.Schema.Types.ObjectId,
      ref:"Library",
      required:true
    },
    
    seats:[{
      type: mongoose.Schema.Types.ObjectId,
      ref:"Seat",
      default:null
    }],

    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time format (HH:MM)`
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time format (HH:MM)`
      }
    },
    price: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Validation to ensure startTime is before endTime
TimeSlotSchema.pre('validate', function(next) {
  if (this.startTime >= this.endTime) {
    this.invalidate('startTime', 'startTime must be before endTime');
  }
  next();
});

const TimeSlot = mongoose.model("TimeSlot", TimeSlotSchema);
export default TimeSlot;