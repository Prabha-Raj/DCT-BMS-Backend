import Facility from "../model/Facility.js";

// CREATE - Add new facility
export const createFacility = async (req, res) => {
  try {
    const { facility } = req.body;

    // Check if facility already exists
    const existingFacility = await Facility.findOne({ facility });
    if (existingFacility) {
      return res.status(400).json({
        success: false,
        message: "Facility already exists",
      });
    }

    const newFacility = new Facility({ facility });
    await newFacility.save();

    res.status(201).json({
      success: true,
      message: "Facility created successfully",
      data: newFacility,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create facility",
      error: error.message,
    });
  }
};

// READ - Get all active facilities
export const getAllFacilities = async (req, res) => {
  try {
    const facilities = await Facility.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: facilities.length,
      data: facilities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch facilities",
      error: error.message,
    });
  }
};

// READ - Get all facilities (including inactive - for admin)
export const getAllFacilitiesAdmin = async (req, res) => {
  try {
    const facilities = await Facility.find();
    res.status(200).json({
      success: true,
      count: facilities.length,
      data: facilities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch facilities",
      error: error.message,
    });
  }
};

// READ - Get single facility by ID
export const getFacilityById = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }
    res.status(200).json({
      success: true,
      data: facility,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch facility",
      error: error.message,
    });
  }
};

// UPDATE - Update facility
export const updateFacility = async (req, res) => {
  try {
    const { id } = req.params;
    const { facility, isActive } = req.body;

    const updatedFacility = await Facility.findByIdAndUpdate(
      id,
      { facility, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedFacility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Facility updated successfully",
      data: updatedFacility,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update facility",
      error: error.message,
    });
  }
};

// TOGGLE - Activate/Deactivate facility
export const toggleFacilityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const facility = await Facility.findById(id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    const updatedFacility = await Facility.findByIdAndUpdate(
      id,
      { isActive: !facility.isActive },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Facility ${updatedFacility.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedFacility,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle facility status",
      error: error.message,
    });
  }
};

// DELETE - Permanently delete facility
export const deleteFacility = async (req, res) => {
  try {
    const deletedFacility = await Facility.findByIdAndDelete(req.params.id);

    if (!deletedFacility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Facility deleted permanently",
      data: deletedFacility,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete facility",
      error: error.message,
    });
  }
};