import Library from "../model/LibraryModel.js";
import User from "../model/User.js"; // Adjust path as needed
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// Create a new user
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
      role: role || "student" // Use provided role or default to student
    });

    const savedUser = await newUser.save();

    // Remove password from response
    const { password: _, ...userResponse } = savedUser.toObject();

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password and role are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check role match
    if (user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Invalid role for this user. Expected ${user.role}`,
      });
    }

    // Check if account is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked. Please contact administrator.",
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Remove password from response
    const { password: _, ...userResponse } = user.toObject();

    let libraryResponse = null;
    
    // If user is librarian, find their library
    if (user.role == "librarian") {
      const library = await Library.findOne({ librarian: user._id });
      if (library) {
        libraryResponse = {
          _id: library._id,
          libraryName: library.libraryName,
          // include any other library fields you want to send
        };
      }
    }
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
      library: libraryResponse // will be null if not librarian or library not found
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
// Get all users
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

