import Library from "../model/LibraryModel.js";
import User from "../model/User.js";
import bcrypt from "bcryptjs";

export const createLibrary = async (req, res) => {
  try {   
    // Destructure all fields from the request body
    const {
      librarianName, librarianEmail, librarianMobile, password,
      libraryName, libraryType, description, location,
      contactNumber, email, timingFrom,
      timingTo, services, totalBooks, userMotions
    } = req.body;
   
    // Process uploaded files
    const logo = req.files["logo"]?.[0]?.filename || null;
    const images = req.files["images"]?.map(file => file.filename) || [];

    // Check if user already exists
    const existingUser = await User.findOne({ email: librarianEmail });
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
      name: librarianName,
      email: librarianEmail,
      mobile: librarianMobile,
      password: hashedPassword,
      role: "librarian"
    });

    const savedUser = await newUser.save();

    // Create new library
    const newLibrary = new Library({
      librarian: savedUser._id,
      libraryName, 
      libraryType, 
      description, 
      location,
      contactNumber, 
      email, 
      timingFrom,
      timingTo, 
      services: JSON.parse(services),
      totalBooks,
      userMotions,
      logo, 
      images
    });

    await newLibrary.save();
    
    res.status(201).json({ 
      message: "Library created successfully", 
      data: newLibrary,
      success: true
    });
  } catch (error) {
    console.error("Error creating library:", error);
    res.status(500).json({ 
      message: "Failed to create library", 
      error: error.message,
      success: false
    });
  }
};

// READ ALL
export const getAllLibraries = async (req, res) => {
  try {
    const libraries = await Library.find();
    res.status(200).json({libraries ,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch libraries", error: error.message ,success:false});
  }
};

// READ ONE
export const getLibraryById = async (req, res) => {
  try {
    const library = await Library.findById(req.params.id);
    if (!library) return res.status(404).json({ message: "Library not found" });
    res.status(200).json({library,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch library", error: error.message ,success:false });
  }
};

// UPDATE
export const updateLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find the existing library first
    const existingLibrary = await Library.findById(id);
    if (!existingLibrary) {
      return res.status(404).json({ message: "Library not found", success: false });
    }

    // Handle logo update
    if (req.files["logo"]) {
      updateData.logo = req.files["logo"][0].filename;
      // TODO: Delete old logo file from server if needed
    }

    // Handle images - combine existing and new images
    let updatedImages = [...existingLibrary.images];
    
    // Add new images
    if (req.files["images"]) {
      const newImages = req.files["images"].map(file => file.filename);
      updatedImages = [...updatedImages, ...newImages];
    }

    // Remove deleted images
    if (updateData.imagesToDelete) {
      const imagesToDelete = JSON.parse(updateData.imagesToDelete);
      updatedImages = updatedImages.filter(
        img => !imagesToDelete.includes(img)
      );
      // TODO: Delete the image files from server
    }

    updateData.images = updatedImages;

    // Handle services if provided
    if (updateData.services) {
      updateData.services = JSON.parse(updateData.services);
    }

    const library = await Library.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.status(200).json({ 
      message: "Library updated successfully", 
      data: library,
      success: true 
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to update library", 
      error: error.message,
      success: false 
    });
  }
};

// DELETE
export const deleteLibrary = async (req, res) => {
  try {
    const deleted = await Library.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Library not found" });
    res.status(200).json({ message: "Library deleted" ,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to delete library", error: error.message ,success:false});
  }
};
