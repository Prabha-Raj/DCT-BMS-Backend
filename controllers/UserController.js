import Library from "../model/LibraryModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Wallet from "../model/Wallet.js";
import User from "../model/User.js";

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const createUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role, gender} = req.body;

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

    if(gender) newUser.gender = gender;
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

  try {
    // Input validation
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password and role are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid email || Please enter a registered email id",
      });
    }

    // Role validation
    if (user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Invalid credentials for this user.`,
      });
    }

    // Account status check
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked. Please contact administrator.",
      });
    }

    // Password validation
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Token generation - FIRST save the user, THEN generate token
    // user.tokenVersion += 1;
    await user.save(); // Save the incremented version first

    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        // tokenVersion: user.tokenVersion 
        // Use the updated version
      },
      process.env.JWT_SECRET,
      { expiresIn: "100000d" }
    );

    const { password: _, ...userResponse } = user.toObject();

    // Library handling (unchanged)
    let libraryResponse = null;
    if (user.role == "librarian") {
      const library = await Library.findOne({ librarian: user._id });
      if (!library) {
        return res.status(404).json({
          success: false,
          message: `Library is not found for this email ${email}`
        });
      }
      if (library.isBlocked) {
        return res.status(400).json({
          success: false,
          message: `Your Library has been blocked by admin.`,
          suggestion: `For activation of your library contact to bookmyspace.today.`
        });
      }
      libraryResponse = {
        _id: library._id,
        libraryName: library.libraryName,
      };
    }

    res.status(200).json({
      success: true,
      message: "Login successful. Please verify OTP to continue.",
      token,
      user: userResponse,
      ...(libraryResponse && { library: libraryResponse }),
      otp: STATIC_OTP,
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



// it for only those libraries can login which are approved or active/not-blocked

// const STATIC_OTP = "123456";
// export const loginUser = async (req, res) => {
//   const { email, password, role } = req.body;

//   try {
//     // 1. Validate Input
//     if (!email || !password || !role) {
//       return res.status(400).json({
//         success: false,
//         message: "Email, password, and role are required.",
//       });
//     }

//     // 2. Check if user exists
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "Email not registered. Please check or sign up first.",
//       });
//     }

//     // 3. Role validation
//     if (user.role !== role) {
//       return res.status(403).json({
//         success: false,
//         message: "Invalid credencials for this user.",
//       });
//     }

//     // 4. Block check
//     if (user.isBlocked) {
//       return res.status(403).json({
//         success: false,
//         message: "Your account has been blocked. Please contact support.",
//       });
//     }

//     // 5. Password validation
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid password.",
//       });
//     }

//     // 6. JWT Token
//     const token = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     const { password: _, ...userResponse } = user.toObject();

//     // 7. Librarian-specific library checks
//     let libraryResponse = null;

//     if (user.role === "librarian") {
//       const library = await Library.findOne({ librarian: user._id });

//       if (!library) {
//         return res.status(404).json({
//           success: false,
//           message: `No library found for email: ${email}.`,
//         });
//       }

//       if (library.isBlocked) {
//         return res.status(403).json({
//           success: false,
//           message: "Your library has been blocked by the admin.",
//           suggestion: "Please contact bookmyspace.today for more information.",
//         });
//       }

//       const statusMessages = {
//         pending: {
//           message: "Your library is still pending approval.",
//           suggestion: "Admin will review and approve it shortly.",
//         },
//         in_review: {
//           message: "Your library is currently under review.",
//           suggestion: "Please wait while the admin completes the review.",
//         },
//         rejected: {
//           message: "Your library has been rejected by the admin.",
//           suggestion: "Contact bookmyspace.today for more details or appeal.",
//         },
//       };

//       if (statusMessages[library.status]) {
//         return res.status(403).json({
//           success: false,
//           message: statusMessages[library.status].message,
//           suggestion: statusMessages[library.status].suggestion,
//         });
//       }

//       libraryResponse = {
//         _id: library._id,
//         libraryName: library.libraryName,
//       };
//     }

//     // 8. Single Response for All Roles
//     return res.status(200).json({
//       success: true,
//       message: "Login successful. OTP sent for verification.",
//       token,
//       user: userResponse,
//       ...(libraryResponse && { library: libraryResponse }),
//       otp: STATIC_OTP, // ⚠️ Only for testing – never send in production
//     });

//   } catch (error) {
//     console.error(`Login error for email: ${email}`, error);
//     return res.status(500).json({
//       success: false,
//       message: "Something went wrong during login.",
//       error: error.message,
//     });
//   }
// };

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
        message: "Invalid OTP || So you can't login",
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

// google login
export const googleLogin = async (req, res) => {
  const { firebaseToken } = req.body;

  try {
    // 🔍 Verify token from Firebase
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    const { email, name, uid } = decodedToken;

    if (!email) {
      return res.status(400).json({ success: false, message: "Invalid Google user" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // 🆕 Auto-register Google users (optional or you can reject unknowns)
      user = await User.create({
        name,
        email,
        role: "student", // Or use custom logic
        authProvider: "google",
        password: "firebase", // dummy value
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Account is blocked" });
    }

    // 🛡️ Issue JWT (same as email login)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: _, ...userData } = user.toObject();

    res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Google Login Error:", error.message);
    res.status(401).json({ success: false, message: "Firebase token invalid" });
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

export const getUserProfile = async (req, res) => {
  try {
    const id = req.user._id;
    console.log(id)

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

// Update user user profile
export const updateUser = async (req, res) => {
  try {
    const id = req.user._id;
    const { name, email, mobile, gender, age, city, preparingFor } = req.body;

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
    if (mobile) updateData.mobile = mobile;
    if (gender) updateData.gender = gender;
    if (age) updateData.age = age;
    if (city) updateData.city = city;
    if (preparingFor) updateData.preparingFor = preparingFor;


    if (req.file) {
      // Save new profile image path
      updateData.profileImage = req.file.filename;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (req.file && updatedUser) {
      
      // Delete old profile image if it exists
      if (user.profileImage) {
        // const oldImagePath = path.join(__dirname, '..', 'public', 'uploads', user.profileImage);
        const oldImagePath = path.join(__dirname, 'uploads', user.profileImage);

        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating profile.",
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

