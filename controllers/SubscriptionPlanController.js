import Library from "../model/LibraryModel.js";
import SubscriptionPlan from "../model/SubscriptionPlan.js";
import mongoose from "mongoose";



// ✅ Create a new subscription plan (librarian only)
export const createSubscriptionPlan = async (req, res) => {
  try {
    const librarianId = req.user._id;

    const library = await Library.findOne({ librarian: librarianId });

    if (!library) {
      return res.status(404).json({ message: "Library not found for this librarian" });
    }

    const { type, pricePerHour, totalHoursAllowed, dailyHourLimit, description } = req.body;

    const newPlan = await SubscriptionPlan.create({
      library: library._id,
      type,
      pricePerHour,
      totalHoursAllowed,
      dailyHourLimit,
      description
    });

    res.status(201).json({ message: "Subscription plan created", plan: newPlan });
  } catch (err) {
    console.error("Create Plan Error:", err.message);
    res.status(500).json({ message: "Server error while creating plan" });
  }
};

// ✅ Get all plans for current librarian
export const getMySubscriptionPlans = async (req, res) => {
  try {
    const librarianId = req.user._id;
    const library = await Library.findOne({ librarian: librarianId });

    if (!library) {
      return res.status(404).json({ message: "Library not found for this librarian" });
    }

    const plans = await SubscriptionPlan.find({ library: library._id });
    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ message: "Error fetching plans", error: err.message });
  }
};

// ✅ Get all active plans (for students/general users)
export const getAllActivePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .populate("library", "libraryName email location");
    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ message: "Error fetching active plans", error: err.message });
  }
};

// ✅ Get plans by library ID (e.g., for detail page of a library)
export const getPlansByLibraryId = async (req, res) => {
  try {
    const { libraryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({ message: "Invalid Library ID" });
    }

    const plans = await SubscriptionPlan.find({ library: libraryId, isActive: true });
    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ message: "Error fetching library plans", error: err.message });
  }
};

// ✅ Toggle plan active status (librarian/admin)
export const togglePlanStatus = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({ message: `Plan status updated`, isActive: plan.isActive });
  } catch (err) {
    res.status(500).json({ message: "Error toggling status", error: err.message });
  }
};

// ✅ Delete a plan
export const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    await SubscriptionPlan.findByIdAndDelete(planId);
    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting plan", error: err.message });
  }
};
