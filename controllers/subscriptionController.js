import Subscription from "../model/Subscription.js";

export const createSubscription = async (req, res) => {
  try {
    const { city, planName, price, durationInMonths, features } = req.body;

    if (!city || !planName || !price || !durationInMonths) {
      return res.status(400).json({
        success: false,
        message: "City, Plan Name, Price and Duration are required",
      });
    }

    const subscription = await Subscription.create({
      city,
      planName,
      price,
      durationInMonths,
      features,
    });

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: subscription,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getSubscriptions = async (req, res) => {
  try {
    const { city } = req.query;
    let filter = {isActive:true};

    if (city) {
      filter.city = { $regex: new RegExp(`^${city}$`, "i") };
    }

    const subscriptions = await Subscription.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getSubscriptionById = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleActiveStatus = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Invalid Subcription Id, Subscription not found" });
    }

    subscription.isActive = !subscription.isActive
    await subscription.save();

    res.status(200).json({
      success: true,
      message: `Subscription has been ${subscription.isActive ? "Activated" : "Deactivated"} successfully`,
      subscription
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllSubscriptionsForAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { city, isActive, planName, minPrice, maxPrice, minDuration, maxDuration, search } = req.query;
    let filter = {};

    // City filter (case-insensitive)
    if (city) {
      filter.city = { $regex: new RegExp(`^${city}$`, "i") };
    }
    
    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Plan name filter (case-insensitive partial match)
    if (planName) {
      filter.planName = { $regex: new RegExp(planName, "i") };
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    // Duration range filter
    if (minDuration || maxDuration) {
      filter.durationInMonths = {};
      if (minDuration) filter.durationInMonths.$gte = parseInt(minDuration);
      if (maxDuration) filter.durationInMonths.$lte = parseInt(maxDuration);
    }
    
    // Search filter (searches in both city and planName fields)
    if (search) {
      filter.$or = [
        { city: { $regex: new RegExp(search, "i") } },
        { planName: { $regex: new RegExp(search, "i") } }
      ];
    }

    const subscriptions = await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Subscription.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        current: page,
        total: totalPages,
        count: subscriptions.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};