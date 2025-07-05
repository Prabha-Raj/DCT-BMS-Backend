import Setting from "../model/Settings.js";

// ✅ Upsert (Create if none, Update if exists)
export const upsertSetting = async (req, res) => {
  try {
    const { coinPrice, walletCommission, bookingCommission } = req.body;

    let setting = await Setting.findOne();

    if (setting) {
      // Update only provided fields
      if (coinPrice !== undefined) setting.coinPrice = coinPrice;
      if (walletCommission !== undefined) setting.walletCommission = walletCommission;
      if (bookingCommission !== undefined) setting.bookingCommission = bookingCommission;

      await setting.save();
      return res.status(200).json({ message: "Settings updated", setting });
    }

    // Create new with only provided fields
    const newSetting = await Setting.create({
      coinPrice,
      walletCommission,
      bookingCommission,
    });

    return res.status(201).json({ message: "Settings created", setting: newSetting });
  } catch (error) {
    console.error("Settings upsert error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Get current setting
export const getSetting = async (req, res) => {
  try {
    const setting = await Setting.findOne();
    if (!setting) return res.status(404).json({ message: "Settings not found" });

    res.status(200).json(setting);
  } catch (error) {
    console.error("Settings fetch error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
