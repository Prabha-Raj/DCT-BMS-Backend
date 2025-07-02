import Library from "../model/LibraryModel.js";
import User from "../model/User.js";
import bcrypt from "bcryptjs";
import fs from 'fs';
import path from 'path';
import { findDistanceBetweenLatAndLon, findDistanceBetweenPins, getLatLngFromAddress } from "../services/locationService.js";
import { generateQRCode } from "../utils/qrCodeHelper.js";


export const createLibrary = async (req, res) => {
  try {   
    // Destructure all fields from the request body
    const {
      librarianName, librarianEmail, librarianMobile, password,
      libraryName, libraryType, description, location,  pinCode,
      contactNumber, email, timingFrom,
      timingTo, services, totalBooks, userMotions
    } = req.body;
   
    // Validate required fields
    if (!librarianName || !librarianEmail || !password || !libraryName || !libraryType || !pinCode) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing"
      });
    }

    // Process uploaded files
    const logo = req.files["logo"]?.[0]?.filename || null;
    const images = req.files["images"]?.map(file => file.filename) || [];

    // Check if user already exists
    const existingUser = await User.findOne({ email: librarianEmail });
    if (existingUser) {
      // Clean up uploaded files if user exists
      if (logo) {
        fs.unlinkSync(path.join('uploads', logo));
      }
      images.forEach(image => {
        fs.unlinkSync(path.join('uploads', image));
      });
      
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
      pinCode,
      contactNumber, 
      email, 
      timingFrom,
      timingTo, 
      services: services ? JSON.parse(services) : [],
      totalBooks: totalBooks || 0,
      userMotions: userMotions || [],
      logo, 
      images
    });

    // Generate QR code data
    const qrCodeData = JSON.stringify({
      libraryId: newLibrary._id,
      libraryName,
      contactNumber,
      email,
      location
    });

    // Generate and save QR code
    const qrCodePath = await generateQRCode(qrCodeData, newLibrary._id);
    newLibrary.qrCode = qrCodePath;

    await newLibrary.save();
    
    res.status(201).json({ 
      message: "Library created successfully", 
      data: newLibrary,
      success: true
    });
  } catch (error) {
    // Clean up uploaded files if error occurs
    if (req.files["logo"]?.[0]?.filename) {
      fs.unlinkSync(path.join('uploads', req.files["logo"][0].filename));
    }
    if (req.files["images"]) {
      req.files["images"].forEach(file => {
        fs.unlinkSync(path.join('uploads', file.filename));
      });
    }
    
    console.error("Error creating library:", error);
    res.status(500).json({ 
      message: "Failed to create library", 
      error: error.message,
      success: false
    });
  }
};

// READ ALL for admin without pagination and filtering
export const getAllLibrariesForAdmin = async (req, res) => {
  try {
    const libraries = await Library.find({})
      .populate("librarian")
      .populate("libraryType")
      .populate("services")
      .sort({ createdAt: -1 });

    const total = await Library.countDocuments();

    res.status(200).json({
      libraries,
      total,
      success: true
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch libraries", 
      error: error.message,
      success: false
    });
  }
};



// get all libraries for students with filtering
export const getAllLibrariesForStudents = async (req, res) => {
  try {
    const { search = '', libraryType, services } = req.query;
    
    const query = { isBlocked: false };
    
    if (search) {
      query.$or = [
        { libraryName: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (libraryType) {
      query.libraryType = libraryType;
    }
    
    if (services) {
      query.services = { $in: Array.isArray(services) ? services : [services] };
    }
    
    const libraries = await Library.find(query)
      .populate("libraryType")
      .populate("services");
      
    res.status(200).json({
      libraries,
      success: true
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch libraries", 
      error: error.message,
      success: false
    });
  }
};

// READ ONE with detailed population
export const getLibraryById = async (req, res) => {
  try {
    const library = await Library.findById(req.params.id)
      .populate("librarian")
      .populate("libraryType")
      .populate("services");
      
    if (!library) {
      return res.status(404).json({ 
        message: "Library not found",
        success: false
      });
    }
    
    res.status(200).json({
      library,
      success: true
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch library", 
      error: error.message,
      success: false
    });
  }
};


export const getMyLibrary = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: No user ID found in request",
        success: false,
      });
    }

    const library = await Library.findOne({ librarian: userId })
      .populate("librarian", "-password") // don't return password
      .populate("libraryType")
      .populate("services");

    if (!library) {
      return res.status(404).json({
        message: "Library not found",
        success: false,
      });
    }

    return res.status(200).json({
      library,
      success: true,
    });
  } catch (error) {
    console.error("getMyLibrary error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch library",
      error: error.message,
      success: false,
    });
  }
};


// UPDATE with proper file handling
export const updateLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find the existing library first
    const existingLibrary = await Library.findById(id);
    if (!existingLibrary) {
      return res.status(404).json({ 
        message: "Library not found", 
        success: false 
      });
    }

    // Handle logo update
    if (req.files["logo"]) {
      // Delete old logo if exists
      if (existingLibrary.logo) {
        try {
          fs.unlinkSync(path.join('uploads', existingLibrary.logo));
        } catch (err) {
          console.error("Error deleting old logo:", err);
        }
      }
      updateData.logo = req.files["logo"][0].filename;
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
      // Delete files from server
      imagesToDelete.forEach(image => {
        try {
          fs.unlinkSync(path.join('uploads', image));
        } catch (err) {
          console.error("Error deleting image:", err);
        }
      });
      updatedImages = updatedImages.filter(
        img => !imagesToDelete.includes(img)
      );
    }

    updateData.images = updatedImages;

    // Handle services if provided
    if (updateData.services) {
      updateData.services = JSON.parse(updateData.services);
    }

    // Handle library name update
    if (updateData.libraryName) {
      updateData.libraryName = updateData.libraryName.trim();
    }

    const library = await Library.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("librarian libraryType services");

    res.status(200).json({ 
      message: "Library updated successfully", 
      data: library,
      success: true 
    });
  } catch (error) {
    // Clean up uploaded files if error occurs
    if (req.files["logo"]?.[0]?.filename) {
      fs.unlinkSync(path.join('uploads', req.files["logo"][0].filename));
    }
    if (req.files["images"]) {
      req.files["images"].forEach(file => {
        fs.unlinkSync(path.join('uploads', file.filename));
      });
    }
    
    res.status(500).json({ 
      message: "Failed to update library", 
      error: error.message,
      success: false 
    });
  }
};

// DELETE with cleanup
export const deleteLibrary = async (req, res) => {
  try {
    const library = await Library.findById(req.params.id);
    if (!library) {
      return res.status(404).json({ 
        message: "Library not found",
        success: false
      });
    }

    // Delete associated user
    await User.findByIdAndDelete(library.librarian);

    // Delete logo file if exists
    if (library.logo) {
      try {
        fs.unlinkSync(path.join('uploads', library.logo));
      } catch (err) {
        console.error("Error deleting logo:", err);
      }
    }

    // Delete image files
    library.images.forEach(image => {
      try {
        fs.unlinkSync(path.join('uploads', image));
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    });

    // Delete the library
    await Library.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      message: "Library and associated user deleted successfully",
      success: true
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to delete library", 
      error: error.message,
      success: false
    });
  }
};

// Toggle block status
export const toggleBlockLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const library = await Library.findById(id);
    
    if (!library) {
      return res.status(404).json({
        message: "Library not found",
        success: false
      });
    }
    
    library.isBlocked = !library.isBlocked;
    await library.save();
    
    res.status(200).json({
      message: `Library ${library.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      isBlocked: library.isBlocked,
      success: true
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to toggle block status",
      error: error.message,
      success: false
    });
  }
};

// Toggle popular status
export const togglePopularLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const library = await Library.findById(id);
    
    if (!library) {
      return res.status(404).json({
        message: "Library not found",
        success: false
      });
    }
    
    library.isPopular = !library.isPopular;
    await library.save();
    
    res.status(200).json({
      message: `Library marked as ${library.isPopular ? 'popular' : 'not popular'} successfully`,
      isPopular: library.isPopular,
      success: true
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to toggle popular status",
      error: error.message,
      success: false
    });
  }
};


// GET /api/libraries/search?address=Delhi
export const getLibrariesByAddress = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ message: 'Address query is required' });
    }

    // Case-insensitive, partial match using regex
    const libraries = await Library.find({
      location: { $regex: address, $options: 'i' }
    }).populate('libraryType').populate('services');

    res.status(200).json(libraries);
  } catch (error) {
    console.error('Error fetching libraries by address:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


export const getNearestLibrariesByPinCode = async (req, res) => {
  const { pincode } = req.params;
  const userPinCode = pincode;

  if (!userPinCode) {
    return res.status(400).json({ message: 'User PIN code is required' });
  }

  try {


    const libraries = await Library.find({ isBlocked: false })
      .populate('libraryType')
      .populate('services');

    const enrichedLibraries = [];

    for (const library of libraries) {
      if (!library.pinCode) continue;

      try {
      //  console.log(userPinCode,library.pinCode)
        const distance = await findDistanceBetweenPins(userPinCode,library.pinCode);
        console.log("dis", distance)
        enrichedLibraries.push({
          ...library._doc,
          distanceInKm: distance,
        });

      } catch (err) {
        console.warn(`Skipping library with pin ${library.pinCode}:`, err.message);
      }
    }

    enrichedLibraries.sort((a, b) => a.distanceInKm - b.distanceInKm);

    res.status(200).json(enrichedLibraries);

  } catch (error) {
    console.error('❌ Error in nearest libraries:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getNearestLibrariesByLatLon = async (req, res) => {
  let { userLat, userLon } = req.body;

  // Convert to number (if sent as string)
  userLat = parseFloat(userLat);
  userLon = parseFloat(userLon);

  if (!userLat || !userLon) {
    return res.status(400).json({ message: 'User latitude and longitude are required' });
  }

  try {
    const libraries = await Library.find({ isBlocked: false })
      .populate('libraryType')
      .populate('services');

    const enrichedLibraries = [];

    for (const library of libraries) {
      if (!library.location) continue;

      try {
        const libLocation = await getLatLngFromAddress(library.location);
        if (!libLocation || !libLocation.lat || !libLocation.lon) {
          console.warn(`No lat/lon for address: ${library.location}`);
          continue;
        }

        const distance = await findDistanceBetweenLatAndLon(userLat, userLon, libLocation.lat, libLocation.lon);

        enrichedLibraries.push({
          ...library._doc,
          distanceInKm: Number(distance.toFixed(2)),
        });

      } catch (err) {
        console.warn(`Skipping library [${library.libraryName}] due to error:`, err.message);
      }
    }

    enrichedLibraries.sort((a, b) => a.distanceInKm - b.distanceInKm);

    res.status(200).json(enrichedLibraries);

  } catch (error) {
    console.error('❌ Error in nearest libraries:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};


// export const getLibraryQRCode = async (req, res) => {
//   try {
//     const id = req.user._id;
  
    
//     const library = await Library.findOne({librarian:id});
//     if (!library) {
//       return res.status(404).json({
//         success: false,
//         message: "Library not found"
//       });
//     }

//     // If QR code doesn't exist, generate it
//     if (!library.qrCode) {
//       const qrCodeData = JSON.stringify({
//         libraryId: library._id,
//         libraryName: library.libraryName,
//         contactNumber: library.contactNumber,
//         email: library.email,
//         location: library.location
//       });

//       const qrCodePath = await generateQRCode(qrCodeData, library._id);
//       library.qrCode = qrCodePath;
//       await library.save();
//     }

//     // Return the QR code path
//     res.status(200).json({
//       success: true,
//       qrCode: library.qrCode
//     });
//   } catch (error) {
//     console.error("Error getting QR code:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get QR code",
//       error: error.message
//     });
//   }
// };

export const getLibraryQRCode = async (req, res) => {
  try {
    // Validate user exists and has librarian role
    if (!req.user || req.user.role !== 'librarian') {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only librarians can access this resource"
      });
    }

    const librarianId = req.user._id;
    
    // Find library with population of useful fields
    const library = await Library.findOne({ librarian: librarianId })
      .select('_id libraryName contactNumber email location qrCode')
      .lean();

    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Library not found for this librarian"
      });
    }

    // Generate new QR code if doesn't exist or is invalid
    if (!library.qrCode || !fs.existsSync(path.join('uploads', library.qrCode))) {
      const qrCodeData = {
        libraryId: library._id,
        libraryName: library.libraryName,
        contactNumber: library.contactNumber,
        email: library.email,
        location: library.location,
        timestamp: new Date().toISOString()
      };

      const qrCodePath = await generateQRCode(JSON.stringify(qrCodeData), library._id);
      
      // Update the library document
      await Library.updateOne(
        { _id: library._id },
        { $set: { qrCode: qrCodePath } }
      );

      library.qrCode = qrCodePath;
    }

    // Construct full URL for the QR code
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const qrCodeUrl = `${baseUrl}/uploads/${library.qrCode}`;

    res.status(200).json({
      success: true,
      data: {
        qrCodePath: library.qrCode,
        qrCodeUrl: qrCodeUrl,
        library: {
          id: library._id,
          name: library.libraryName
        },
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
      },
      message: "QR code retrieved successfully"
    });

  } catch (error) {
    console.error("Error in getLibraryQRCode:", error);
    
    // Differentiate between different types of errors
    let statusCode = 500;
    let errorMessage = "Failed to process QR code request";

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = "Invalid data format";
    } else if (error.code === 'ENOENT') {
      statusCode = 404;
      errorMessage = "QR code file not found";
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

