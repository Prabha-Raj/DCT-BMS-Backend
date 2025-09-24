import Library from "../model/LibraryModel.js";
import LibrarySubscription from "../model/LibrarySubscription.js";
import Subscription from "../model/Subscription.js";

export const getSubscriptionsForLibrary = async (req, res) => {
  try {
 
    const library = await Library.findOne({ librarian: req.user._id });
    if (!library) {
      return res.status(404).json({ success: false, message: "Library not found" });
    }

    const libraryLocation = library.location ? library.location.toLowerCase() : "";
    const subscriptions = await Subscription.find({ isActive: true }).sort({ createdAt: -1 });

    const matchedSubscriptions = subscriptions.filter(sub =>
      libraryLocation.includes(sub.city.toLowerCase())
    );

    res.status(200).json({
      success: true,
      message:"These are listed Plans for you!",
      count: matchedSubscriptions.length,
      data: matchedSubscriptions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Purchase Subscription
export const purchaseSubscription = async (req, res) => {
  try {
    const { libraryId, planId } = req.body;

    // check if user is librarian
    if (req.user.role !== "librarian") {
      return res.status(403).json({ message: "Only librarians can purchase subscription" });
    }

    // check if library belongs to logged-in librarian
    const library = await Library.findOne({ _id: libraryId, librarian: req.user._id });
    if (!library) {
      return res.status(404).json({ message: "Library not found or not owned by you" });
    }

    // check plan exists
    const plan = await Subscription.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    // calculate expiry
    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate);
    expiryDate.setMonth(expiryDate.getMonth() + plan.durationInMonths);

    // deactivate old active subscriptions of this library
    await LibrarySubscription.updateMany(
      { library: libraryId, isActive: true },
      { $set: { isActive: false } }
    );

    // create new subscription
    const newSub = await LibrarySubscription.create({
      library: libraryId,
      subscriptionPlan: planId,
      purchaseDate,
      expiryDate,
      isActive: true,
    });

    return res.status(201).json({
      message: "Subscription purchased successfully",
      subscription: newSub,
    });
  } catch (error) {
    console.error("Purchase error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

//  Get Active Subscription of a Library
export const getActiveSubscription = async (req, res) => {
  try {
    const { libraryId } = req.params;

    const subscription = await LibrarySubscription.findOne({
      library: libraryId,
      isActive: true,
      expiryDate: { $gte: new Date() },
    })
      .populate("subscriptionPlan")
      .populate("library");

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    return res.json(subscription);
  } catch (error) {
    console.error("Get active sub error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

//  List All Subscriptions of a Library
export const getLibrarySubscriptions = async (req, res) => {
  try {
    const { libraryId } = req.params;

    const subscriptions = await LibrarySubscription.find({ library: libraryId })
      .populate("subscriptionPlan")
      .sort({ createdAt: -1 });

    return res.json(subscriptions);
  } catch (error) {
    console.error("Get library subs error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
