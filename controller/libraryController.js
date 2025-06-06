import Library from "../model/LibraryModel.js";

// CREATE
export const createLibrary = async (req, res) => {
  try {
    const {
      libraryName, libraryType, description, location,
      contactNumber, email, password, timingFrom,
      timingTo, services, totalBooks
    } = req.body;

    const logo = req.files["logo"]?.[0]?.filename || null;
    const images = req.files["images"]?.map(file => file.filename) || [];

    const newLibrary = new Library({
      libraryName, libraryType, description, location,
      contactNumber, email, password, timingFrom,
      timingTo, services: JSON.parse(services),
      totalBooks, logo, images
    });

    await newLibrary.save();
    res.status(201).json({ message: "Library created successfully", data: newLibrary ,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to create library", error: error.message ,success:false});
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
    const updateData = req.body;

    if (req.files["logo"]) {
      updateData.logo = req.files["logo"][0].filename;
    }

    if (req.files["images"]) {
      updateData.images = req.files["images"].map(file => file.filename);
    }

    if (updateData.services) {
      updateData.services = JSON.parse(updateData.services);
    }

    const library = await Library.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!library) return res.status(404).json({ message: "Library not found" });

    res.status(200).json({ message: "Library updated", data: library,success:true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update library", error: error.message ,success:false});
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
