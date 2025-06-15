import LibraryType from "../model/libraryType.js";

// CREATE - Add new library type
export const createLibraryType = async (req, res) => {
  try {
    const { type } = req.body;

    // Check if type already exists
    const existingType = await LibraryType.findOne({ type });
    if (existingType) {
      return res.status(400).json({
        success: false,
        message: "Library type already exists",
      });
    }

    const newLibraryType = new LibraryType({ type });
    await newLibraryType.save();

    res.status(201).json({
      success: true,
      message: "Library type created successfully",
      data: newLibraryType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create library type",
      error: error.message,
    });
  }
};

// READ - Get all active library types
export const getAllLibraryTypes = async (req, res) => {
  try {
    const libraryTypes = await LibraryType.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: libraryTypes.length,
      data: libraryTypes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch library types",
      error: error.message,
    });
  }
};

// READ - Get all library types (including inactive - for admin)
export const getAllLibraryTypesAdmin = async (req, res) => {
  try {
    const libraryTypes = await LibraryType.find();
    res.status(200).json({
      success: true,
      count: libraryTypes.length,
      data: libraryTypes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch library types",
      error: error.message,
    });
  }
};

// READ - Get single library type by ID
export const getLibraryTypeById = async (req, res) => {
  try {
    const libraryType = await LibraryType.findById(req.params.id);
    if (!libraryType) {
      return res.status(404).json({
        success: false,
        message: "Library type not found",
      });
    }
    res.status(200).json({
      success: true,
      data: libraryType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch library type",
      error: error.message,
    });
  }
};

// UPDATE - Update library type
export const updateLibraryType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, isActive } = req.body;

    const updatedLibraryType = await LibraryType.findByIdAndUpdate(
      id,
      { type, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedLibraryType) {
      return res.status(404).json({
        success: false,
        message: "Library type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Library type updated successfully",
      data: updatedLibraryType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update library type",
      error: error.message,
    });
  }
};

// TOGGLE - Activate/Deactivate library type (single endpoint)
export const toggleLibraryTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the library type
    const libraryType = await LibraryType.findById(id);
    
    if (!libraryType) {
      return res.status(404).json({
        success: false,
        message: "Library type not found",
      });
    }

    // Toggle the isActive status
    const updatedLibraryType = await LibraryType.findByIdAndUpdate(
      id,
      { isActive: !libraryType.isActive },
      { new: true, runValidators: true }
    );

    const statusMessage = updatedLibraryType.isActive 
      ? "activated" 
      : "deactivated";

    res.status(200).json({
      success: true,
      message: `Library type ${statusMessage} successfully`,
      data: updatedLibraryType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle library type status",
      error: error.message,
    });
  }
};

// DELETE - Permanently delete library type
export const deleteLibraryType = async (req, res) => {
  try {
    const deletedType = await LibraryType.findByIdAndDelete(req.params.id);

    if (!deletedType) {
      return res.status(404).json({
        success: false,
        message: "Library type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Library type deleted permanently",
      data: deletedType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete library type",
      error: error.message,
    });
  }
};

