import Transaction from "../model/Transaction.js";
import User from "../model/User.js";
import Wallet from "../model/Wallet.js";


export const addMoneyToWallet = async (req, res) => {
  try {
    const { amount, description } = req.body;
    const userId = req.user._id;
    // 1. Validate input
    if (!userId || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID or amount"
      });
    }

    // 2. Check if user exists and is a student
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can have wallets"
      });
    }

    // 3. Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0
      });
    }

    // 4. Update balance
    wallet.balance += amount;
    await wallet.save();

    // 5. Create transaction
    await Transaction.create({
      wallet: wallet._id,
      user: userId,
      type: "credit",
      amount,
      description: description || "Money added to wallet"
    });

    res.status(200).json({
      success: true,
      message: "Money added successfully",
      balance: wallet.balance
    });

  } catch (err) {
    console.error("Error adding money:", err.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};

export const getMyWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Wallet fetched successfully",
      wallet
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


// @desc Get transaction history
export const getMyTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};