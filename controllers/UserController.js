import Library from "../model/LibraryModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Wallet from "../model/Wallet.js";
import User from "../model/User.js";

export const createUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: role || "student" // Default to student if role not provided
    });

    const savedUser = await newUser.save();

    // Create wallet only if user is a student
    if (savedUser.role === "student") {
      const newWallet = new Wallet({
        user: savedUser._id,
        balance: 0 // Default balance
      });
      await newWallet.save();
    }

    // Remove password from response
    const { password: _, ...userResponse } = savedUser.toObject();

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message
    });
  }
};

const STATIC_OTP = "123456";
export const loginUser = async (req, res) => {
  const { email, password, role } = req.body;
  console.log(email, password, role)
  try {
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password and role are required",
      });
    }

    const user = await User.findOne({email});
    console.log(user)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "user na hai",
      });
    }

    if (user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Invalid role for this user. Expected ${user.role}`,
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked. Please contact administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: _, ...userResponse } = user.toObject();

    let libraryResponse = null;
    if (user.role == "librarian") {
      const library = await Library.findOne({ librarian: user._id });
      if (library) {
        libraryResponse = {
          _id: library._id,
          libraryName: library.libraryName,
        };
      }
    }

    res.status(200).json({
      success: true,
      message: "Login successful. Please verify OTP to continue.",
      token,
      user: userResponse,
      library: libraryResponse,
      otp: STATIC_OTP, // Send the static OTP here
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const verifyOtp = async (req, res) => {
  const { otp } = req.body;

  try {
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    if (otp !== "123456") { // Compare with static OTP
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });

  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;

    let filter = {};

    if (role) {
      const rolesArray = role.split(",").map(r => r.trim().toLowerCase());
      filter.role = { $in: rolesArray };
    } else {
      // Default to student and librarian if no query provided
      filter.role = { $in: ["student", "librarian"] };
    }

    const users = await User.find(filter).select("-password"); // Exclude password

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving users",
      error: error.message,
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving user",
      error: error.message,
    });
  }
};

// Update user by ID
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If email is being updated, check if it's already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another user",
        });
      }
    }

    // Prepare update object
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Hash password if provided
    if (password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// Toggle block/unblock user by ID
export const toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Toggle the isBlocked value
    user.isBlocked = !user.isBlocked;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User has been ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
      data: { id: user._id, isBlocked: user.isBlocked },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling user block status",
      error: error.message,
    });
  }
};

// Delete user by ID
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: { id: deletedUser._id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

