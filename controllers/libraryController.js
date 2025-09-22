import Library from "../model/LibraryModel.js";
import User from "../model/User.js";
import bcrypt from "bcryptjs";
import fs, { stat } from 'fs';
import path from 'path';
import { findDistanceBetweenLatAndLon, findDistanceBetweenPins, getLatLngFromAddress } from "../services/locationService.js";
import { generateQRCode } from "../utils/qrCodeHelper.js";
import Seat from "../model/Seat.js";
import TimeSlot from "../model/TimeSlot.js";
import Booking from "../model/Booking.js";
import MonthlyBooking from "../model/MonthlyBooking.js";


export const createLibrary = async (req, res) => {
  try {   
    // Destructure all fields from the request body
    const {
      librarianName, librarianEmail, librarianMobile, password,
      libraryName, libraryType, description, location,  pinCode,
      latitude, longitude, contactNumber, email, timingFrom,
      timingTo, services, totalBooks, userMotions
    } = req.body;
  //  console.log(latitude, longitude, location, pinCode)
    // Validate required fields
    if (!librarianName || !librarianEmail || !password || !libraryName || !libraryType || !pinCode || !latitude || !longitude) {
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
  coordinates: {
    lat: latitude,
    lng: longitude
  },
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


export const getAllLibrariesForAdmin = async (req, res) => {
  try {
    // First get all libraries with populated data
    const libraries = await Library.find()
      .populate("librarian")
      .populate("libraryType")
      .populate("services")
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain JavaScript objects

    const total = libraries.length;

    if (total > 0) {
      // Get seat counts for all libraries in one query
      const seatCounts = await Seat.aggregate([
        { $match: { isActive: true } }, // Only count active seats
        {
          $group: {
            _id: "$library",
            totalSeats: { $sum: 1 }
          }
        }
      ]);

      // Get booking counts for all libraries in one query
      const bookingCounts = await Booking.aggregate([
        {
          $group: {
            _id: "$library",
            totalBookings: { $sum: 1 }
          }
        }
      ]);

      // Create maps for quick lookup
      const seatCountMap = seatCounts.reduce((map, item) => {
        map[item._id.toString()] = item.totalSeats;
        return map;
      }, {});

      const bookingCountMap = bookingCounts.reduce((map, item) => {
        map[item._id.toString()] = item.totalBookings;
        return map;
      }, {});

      // Add counts to each library while preserving all existing fields
      const librariesWithCounts = libraries.map(library => {
        return {
          ...library,
          totalSeats: seatCountMap[library._id.toString()] || 0,
          totalBookings: bookingCountMap[library._id.toString()] || 0
        };
      });

      return res.status(200).json({
        libraries: librariesWithCounts,
        total,
        success: true
      });
    }

    // If no libraries found
    res.status(200).json({
      libraries: [],
      total: 0,
      success: true
    });

  } catch (error) {
    console.error('Admin Library Fetch Error:', error);
    res.status(500).json({ 
      message: "Failed to fetch libraries", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
        { description: { $regex: search, $options: 'i' } },
        { pinCode: { $regex: search, $options: 'i' } },
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

export const getAllLibrariesWithSeatAndTimeSloteForStudents = async (req, res) => {
  try {
    const { search = '', libraryType, services } = req.query;
    
    const query = { 
      isBlocked: false,
      status: "approved",
      coordinates: { $exists: true, $ne: null }
    };
    
    if (search) {
      query.$or = [
        { libraryName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { pinCode: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (libraryType) {
      query.libraryType = libraryType;
    }
    
    if (services) {
      query.services = { $in: Array.isArray(services) ? services : [services] };
    }
    
    // First get all approved, unblocked libraries with coordinates
    const libraries = await Library.find(query)
      .populate('libraryType')
      .populate('services')
      .lean(); // Use lean() for better performance

    const enrichedLibraries = [];
    const libraryIds = libraries.map(lib => lib._id);

    // Get all seats and timeslots in bulk for better performance
    const [seats, timeSlots] = await Promise.all([
      Seat.find({ 
        library: { $in: libraryIds },
        isActive: true 
      }).lean(),
      TimeSlot.find({
        library: { $in: libraryIds },
        isActive: true
      })
      .populate('seats')
      .lean()
    ]);

    // Group seats by library
    const seatsByLibrary = {};
    seats.forEach(seat => {
      if (!seatsByLibrary[seat.library]) {
        seatsByLibrary[seat.library] = [];
      }
      seatsByLibrary[seat.library].push(seat);
    });

    // Group timeslots by library
    const timeSlotsByLibrary = {};
    timeSlots.forEach(slot => {
      if (!timeSlotsByLibrary[slot.library]) {
        timeSlotsByLibrary[slot.library] = [];
      }
      timeSlotsByLibrary[slot.library].push(slot);
    });

    for (const library of libraries) {
      try {
        // Get seats and timeslots for this library
        const librarySeats = seatsByLibrary[library._id] || [];
        const libraryTimeSlots = timeSlotsByLibrary[library._id] || [];

        // For each seat, find all assigned timeslots
        const seatsWithSlots = librarySeats.map(seat => {
          const availableSlots = libraryTimeSlots
            .filter(slot => 
              slot.seats.some(s => s._id.toString() === seat._id.toString())
            )
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(slot => ({
              _id: slot._id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              price: slot.price
            }));

          return {
            ...seat,
            availableSlots
          };
        }).filter(seat => seat.availableSlots.length > 0);

        if (seatsWithSlots.length > 0) {
          enrichedLibraries.push({
            ...library,
            seats: seatsWithSlots
          });
        }

      } catch (err) {
        console.warn(`Skipping library [${library.libraryName}] due to error:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      libraries: enrichedLibraries
    });

  } catch (error) {
    console.error('❌ Error in fetching libraries:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch libraries',
      error: error.message
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
console.log(updateData.hourlyFee)
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
      message: `Library marked as ${library.isPopular ? 'popular' : 'not popular'}.`,
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

// update library status like ["pending", "in_review", "approved", "rejected"],

export const updateLibraryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const library = await Library.findById(id);
    
    if (!library) {
      return res.status(404).json({
        message: "Library not found",
        success: false
      });
    }
    
    if(!status){
      return res.status(404).json({
        success:false,
        message:"Please provide a status which you wants to update"
      })
    }

    library.status = status;

    await library.save();
    
    res.status(200).json({
      message: `Library status marked as ${library.status}.`,
      isPopular: library.isPopular,
      success: true
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update library status",
      error: error.message,
      success: false
    });
  }
};


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

export const getLibrariesByAddress = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ 
        success: false,
        message: 'Address query is required' 
      });
    }

    const libraries = await Library.find({
      location: { $regex: address, $options: 'i' },
      status: "approved",
      isBlocked: false
    })
    .populate('libraryType')
    .populate('services')
    .lean();

    if (!libraries.length) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const libraryIds = libraries.map(lib => lib._id);

    const allSeats = await Seat.find({ 
      library: { $in: libraryIds },
      isActive: true 
    }).lean();

    const allTimeSlots = await TimeSlot.find({
      library: { $in: libraryIds },
      isActive: true
    }).populate('seats').lean();

    const response = libraries.map(library => {
      const librarySeats = allSeats.filter(seat => seat.library.toString() === library._id.toString());
      
      return {
        ...library,
        distanceInKm: 0,
        seats: librarySeats.map(seat => {
          const availableSlots = allTimeSlots
            .filter(slot => 
              slot.library.toString() === library._id.toString() &&
              slot.seats.some(s => s._id.toString() === seat._id.toString())
            )
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(slot => ({
              _id: slot._id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              price: slot.price
            }));

          return {
            ...seat,
            availableSlots
          };
        })
      };
    });

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getNearestLibrariesByPinCode = async (req, res) => {
  const { pincode } = req.params;
  const userPinCode = pincode;

  if (!userPinCode) {
    return res.status(400).json({ 
      success: false,
      message: 'User PIN code is required' 
    });
  }

  try {
    const libraries = await Library.find({ 
      status: "approved", 
      isBlocked: false 
    })
    .populate('libraryType')
    .populate('services');

    const enrichedLibraries = [];

    for (const library of libraries) {
      if (!library.pinCode) continue;

      try {
        const distance = await findDistanceBetweenPins(userPinCode, library.pinCode);
        
        const seats = await Seat.find({ 
          library: library._id,
          isActive: true 
        });

        const timeSlots = await TimeSlot.find({
          library: library._id,
          isActive: true
        }).populate('seats');

        const seatsWithSlots = seats.map(seat => {
          const availableSlots = timeSlots
            .filter(slot => slot.seats.some(s => s._id.toString() === seat._id.toString()))
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(slot => ({
              _id: slot._id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              price: slot.price
            }));

          return {
            ...seat.toObject(),
            availableSlots
          };
        });

        enrichedLibraries.push({
          ...library._doc,
          distanceInKm: distance,
          seats: seatsWithSlots
        });

      } catch (err) {
        console.warn(`Skipping library with pin ${library.pinCode}:`, err.message);
      }
    }

    enrichedLibraries.sort((a, b) => a.distanceInKm - b.distanceInKm);

    res.status(200).json({
      success: true,
      data: enrichedLibraries
    });

  } catch (error) {
    console.error('Error in nearest libraries:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch nearby libraries',
      error: error.message
    });
  }
};

export const getNearestLibrariesByLatLon = async (req, res) => {
  let { userLat, userLon } = req.body;

  userLat = parseFloat(userLat);
  userLon = parseFloat(userLon);
  const MAX_DISTANCE_KM = 20; // 20km radius

  if (!userLat || !userLon) {
    return res.status(400).json({ 
      success: false,
      message: 'User latitude and longitude are required' 
    });
  }

  try {
    // First get all approved, unblocked libraries
    const libraries = await Library.find({ 
      status: "approved", 
      isBlocked: false 
    })
    .populate('libraryType')
    .populate('services');

    const enrichedLibraries = [];

    for (const library of libraries) {
      try {
        let libLat, libLon;
        
        // 1. First try to parse coordinates from the coordinates field
        if (library.coordinates) {
          try {
            // Handle both stringified JSON and proper object
            const coords = typeof library.coordinates === 'string' 
              ? JSON.parse(library.coordinates)
              : library.coordinates;
            
            if (coords.lat && coords.lng) {
              libLat = parseFloat(coords.lat);
              libLon = parseFloat(coords.lng);
            }
          } catch (parseError) {
            console.warn(`Error parsing coordinates for library ${library.libraryName}:`, parseError.message);
          }
        }
        
        // 2. If still no coordinates, try geocoding
        if ((!libLat || !libLon) && library.location) {
          try {
            const libLocation = await getLatLngFromAddress(library.location);
            if (libLocation && libLocation.lat && libLocation.lon) {
              libLat = libLocation.lat;
              libLon = libLocation.lon;
              
              // Update library with coordinates for future use
              await Library.findByIdAndUpdate(library._id, {
                coordinates: JSON.stringify({
                  lat: libLat,
                  lng: libLon
                })
              });
            }
          } catch (geocodeError) {
            console.warn(`Geocoding failed for ${library.libraryName}:`, geocodeError.message);
            continue; // Skip this library if we can't get coordinates
          }
        }
        
        // Skip if still no coordinates
        if (!libLat || !libLon) {
          console.warn(`No coordinates for library: ${library.libraryName}`);
          continue;
        }

        // Calculate distance
        const distance = await findDistanceBetweenLatAndLon(
          userLat, userLon, 
          libLat, libLon
        );

        // Skip libraries beyond 20km radius
        if (distance > MAX_DISTANCE_KM) {
          continue;
        }

        // Get all active seats for this library
        const seats = await Seat.find({ 
          library: library._id,
          isActive: true 
        });

        // Get all active time slots for this library
        const timeSlots = await TimeSlot.find({
          library: library._id,
          isActive: true
        }).populate('seats');

        // For each seat, find all assigned timeslots
        const seatsWithSlots = seats.map(seat => {
          const availableSlots = timeSlots
            .filter(slot => 
              slot.seats.some(s => s._id.toString() === seat._id.toString())
            )
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(slot => ({
              _id: slot._id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              price: slot.price
            }));

          return {
            ...seat.toObject(),
            availableSlots
          };
        });

        enrichedLibraries.push({
          ...library._doc,
          distanceInKm: Number(distance.toFixed(2)),
          seats: seatsWithSlots
        });

      } catch (err) {
        console.warn(`Skipping library [${library.libraryName}] due to error:`, err.message);
      }
    }

    // Sort by distance (nearest first)
    enrichedLibraries.sort((a, b) => a.distanceInKm - b.distanceInKm);

    res.status(200).json({
      success: true,
      data: enrichedLibraries
    });

  } catch (error) {
    console.error('❌ Error in nearest libraries:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch nearby libraries',
      error: error.message
    });
  }
};

export const getNearestLibrariesByLatLonV1 = async (req, res) => {
    let { userLat, userLon } = req.body;

    userLat = parseFloat(userLat);
    userLon = parseFloat(userLon);
    const MAX_DISTANCE_KM = 20; // 20km radius

    if (!userLat || !userLon) {
      return res.status(400).json({ 
        success: false,
        message: 'User latitude and longitude are required' 
      });
    }

    try {
      // First get all approved, unblocked libraries with coordinates
      const libraries = await Library.find({ 
        status: "approved", 
        isBlocked: false,
        coordinates: { $exists: true, $ne: null } // Only libraries with coordinates
      })
      .populate('libraryType')
      .populate('services')
      .lean(); // Use lean() for better performance

      const enrichedLibraries = [];
      const libraryIds = libraries.map(lib => lib._id);

      // Get all seats and timeslots in bulk for better performance
      const [seats, timeSlots] = await Promise.all([
        Seat.find({ 
          library: { $in: libraryIds },
          isActive: true 
        }).lean(),
        TimeSlot.find({
          library: { $in: libraryIds },
          isActive: true
        })
        .populate('seats')
        .lean()
      ]);

      // Group seats by library
      const seatsByLibrary = {};
      seats.forEach(seat => {
        if (!seatsByLibrary[seat.library]) {
          seatsByLibrary[seat.library] = [];
        }
        seatsByLibrary[seat.library].push(seat);
      });

      // Group timeslots by library
      const timeSlotsByLibrary = {};
      timeSlots.forEach(slot => {
        if (!timeSlotsByLibrary[slot.library]) {
          timeSlotsByLibrary[slot.library] = [];
        }
        timeSlotsByLibrary[slot.library].push(slot);
      });

      for (const library of libraries) {
        try {
          let libLat, libLon;
          const coords = library.coordinates;
          
          // Extract coordinates
          if (coords) {
            if (typeof coords === 'string') {
              try {
                const cleanedString = coords.replace(/\\"/g, '"');
                const parsedCoords = JSON.parse(cleanedString);
                
                if (parsedCoords.lat !== undefined && parsedCoords.lng !== undefined) {
                  libLat = parseFloat(parsedCoords.lat);
                  libLon = parseFloat(parsedCoords.lng);
                } else if (parsedCoords.lat !== undefined && parsedCoords.lon !== undefined) {
                  libLat = parseFloat(parsedCoords.lat);
                  libLon = parseFloat(parsedCoords.lon);
                }
              } catch (parseError) {
                continue; // Skip this library if coordinates can't be parsed
              }
            } else if (typeof coords === 'object') {
              if (coords.lat !== undefined && coords.lng !== undefined) {
                libLat = parseFloat(coords.lat);
                libLon = parseFloat(coords.lng);
              } else if (coords.lat !== undefined && coords.lon !== undefined) {
                libLat = parseFloat(coords.lat);
                libLon = parseFloat(coords.lon);
              }
            }
          }

          if (!libLat || !libLon) {
            continue;
          }

          // Calculate distance
          const distance = findDistanceBetweenLatAndLon(
            userLat, userLon, 
            libLat, libLon
          );

          if (distance > MAX_DISTANCE_KM) {
            continue;
          }

          // Get seats and timeslots for this library
          const librarySeats = seatsByLibrary[library._id] || [];
          const libraryTimeSlots = timeSlotsByLibrary[library._id] || [];

          // For each seat, find all assigned timeslots
          const seatsWithSlots = librarySeats.map(seat => {
            const availableSlots = libraryTimeSlots
              .filter(slot => 
                slot.seats.some(s => s._id.toString() === seat._id.toString())
              )
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(slot => ({
                _id: slot._id,
                startTime: slot.startTime,
                endTime: slot.endTime,
                price: slot.price
              }));

            return {
              ...seat,
              availableSlots
            };
          }).filter(seat => seat.availableSlots.length > 0);

          if (seatsWithSlots.length > 0) {
            enrichedLibraries.push({
              ...library,
              distanceInKm: Number(distance.toFixed(2)),
              seats: seatsWithSlots
            });
          }

        } catch (err) {
          console.warn(`Skipping library [${library.libraryName}] due to error:`, err.message);
        }
      }

      // Sort by distance (nearest first)
      enrichedLibraries.sort((a, b) => a.distanceInKm - b.distanceInKm);

      res.status(200).json({
        success: true,
        data: enrichedLibraries
      });

    } catch (error) {
      console.error('❌ Error in nearest libraries:', error.message);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch nearby libraries',
        error: error.message
      });
    }
  };
  
export const getAllLibrariesForMonthlyBooking = async (req, res) => {
  try {
    const { search = '', libraryType, services } = req.query;
    
    // Base query - only unblocked libraries with monthlyFee > 0
    const query = {
      isBlocked: false,
      status:"approved",
      monthlyFee: { $gt: 0 } // Only libraries that offer monthly booking
    };
    
    // Add search filters
    if (search) {
      query.$or = [
        { libraryName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { pinCode: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (libraryType) {
      query.libraryType = libraryType;
    }
    
    if (services) {
      query.services = { $in: Array.isArray(services) ? services : [services] };
    }
    
    // Find libraries that match the criteria
    const libraries = await Library.find(query)
      .populate("libraryType")
      .populate("services");
    
    // Get library IDs for seat query
    const libraryIds = libraries.map(lib => lib._id);
    
    // Find all active monthly booking seats for these libraries
    const monthlySeats = await Seat.find({
      library: { $in: libraryIds },
      seatFor: "monthly-booking",
      isActive: true
    })
    
    // Get all seat IDs to check for bookings
    const seatIds = monthlySeats.map(seat => seat._id);
    
    // Find all active bookings for these seats
    const existingBookings = await MonthlyBooking.find({
      seat: { $in: seatIds },
      status: { $in: ["confirmed", "pending"] } // Only consider active bookings
    }).sort({ startDate: 1 }); // Sort by start date
    
    // Create a map of seat bookings { seatId: [bookings] }
    const seatBookingsMap = existingBookings.reduce((map, booking) => {
      const seatId = booking.seat.toString();
      if (!map[seatId]) {
        map[seatId] = [];
      }
      map[seatId].push({
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status
      });
      return map;
    }, {});
    
    // Enhance seats with booking information
    const seatsWithBookingInfo = monthlySeats.map(seat => {
      const seatId = seat._id.toString();
      const bookings = seatBookingsMap[seatId] || [];
      
      return {
        ...seat.toObject(),
        isAvailable: bookings.length === 0,
        bookings: bookings.map(b => ({
          from: b.startDate,
          to: b.endDate,
          status: b.status
        })),
        nextAvailableDate: bookings.length > 0 
          ? new Date(Math.max(...bookings.map(b => new Date(b.endDate).getTime()))) 
          : null
      };
    });
    
    // Group seats by library
    const seatsByLibrary = seatsWithBookingInfo.reduce((acc, seat) => {
      const libId = seat.library._id.toString();
      if (!acc[libId]) {
        acc[libId] = [];
      }
      acc[libId].push(seat);
      return acc;
    }, {});
    
    // Enhance libraries with seat information and monthly fee
    const librariesWithSeats = libraries.map(library => {
      const libraryId = library._id.toString();
      const seats = seatsByLibrary[libraryId] || [];
      
      return {
        ...library.toObject(),
        monthlyFee: library.monthlyFee,
        seats: seats,
        availableSeatsCount: seats.filter(s => s.isAvailable).length,
        totalSeatsCount: seats.length
      };
    });
    
    res.status(200).json({
      libraries: librariesWithSeats,
      success: true
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch libraries for monthly booking", 
      error: error.message,
      success: false
    });
  }
};

export const getNearMeLibrariesForMonthlyBookingLatLon = async (req, res) => {
  let { userLat, userLon } = req.body;

  userLat = parseFloat(userLat);
  userLon = parseFloat(userLon);
  const MAX_DISTANCE_KM = 20; // 20km radius

  if (!userLat || !userLon) {
    return res.status(400).json({ 
      success: false,
      message: 'User latitude and longitude are required' 
    });
  }

  try {
    // First get all approved, unblocked libraries with monthly booking and coordinates
    const libraries = await Library.find({ 
      status: "approved", 
      isBlocked: false,
      monthlyFee: { $gt: 0 }, // Only libraries that offer monthly booking
      coordinates: { $exists: true, $ne: null } // Only libraries with coordinates
    })
    .populate('libraryType')
    .populate('services')
    .lean(); // Use lean for better performance

    const enrichedLibraries = [];
    const libraryIds = libraries.map(lib => lib._id);

    // Get all monthly booking seats in bulk
    const monthlySeats = await Seat.find({
      library: { $in: libraryIds },
      seatFor: "monthly-booking",
      isActive: true
    }).lean();

    // Get seat IDs to check for bookings
    const seatIds = monthlySeats.map(seat => seat._id);

    // Find all active bookings for these seats in bulk
    const existingBookings = await MonthlyBooking.find({
      seat: { $in: seatIds },
      status: { $in: ["confirmed", "pending"] } // Only consider active bookings
    }).sort({ startDate: 1 }).lean();

    // Create a map of seat bookings { seatId: [bookings] }
    const seatBookingsMap = existingBookings.reduce((map, booking) => {
      const seatId = booking.seat.toString();
      if (!map[seatId]) {
        map[seatId] = [];
      }
      map[seatId].push({
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status
      });
      return map;
    }, {});

    // Group seats by library
    const seatsByLibrary = monthlySeats.reduce((map, seat) => {
      const libraryId = seat.library.toString();
      if (!map[libraryId]) {
        map[libraryId] = [];
      }
      map[libraryId].push(seat);
      return map;
    }, {});

    for (const library of libraries) {
      try {
        let libLat, libLon;
        const coords = library.coordinates;
        
        // Extract coordinates
        if (coords) {
          if (typeof coords === 'string') {
            try {
              const cleanedString = coords.replace(/\\"/g, '"');
              const parsedCoords = JSON.parse(cleanedString);
              
              if (parsedCoords.lat !== undefined && parsedCoords.lng !== undefined) {
                libLat = parseFloat(parsedCoords.lat);
                libLon = parseFloat(parsedCoords.lng);
              } else if (parsedCoords.lat !== undefined && parsedCoords.lon !== undefined) {
                libLat = parseFloat(parsedCoords.lat);
                libLon = parseFloat(parsedCoords.lon);
              }
            } catch (parseError) {
              continue; // Skip this library if coordinates can't be parsed
            }
          } else if (typeof coords === 'object') {
            if (coords.lat !== undefined && coords.lng !== undefined) {
              libLat = parseFloat(coords.lat);
              libLon = parseFloat(coords.lng);
            } else if (coords.lat !== undefined && coords.lon !== undefined) {
              libLat = parseFloat(coords.lat);
              libLon = parseFloat(coords.lon);
            }
          }
        }

        if (!libLat || !libLon) {
          continue;
        }

        // Calculate distance
        const distance = findDistanceBetweenLatAndLon(
          userLat, userLon, 
          libLat, libLon
        );

        if (distance > MAX_DISTANCE_KM) {
          continue;
        }

        // Get monthly seats for this library
        const librarySeats = seatsByLibrary[library._id.toString()] || [];
        
        // Enhance seats with booking information
        const seatsWithBookingInfo = librarySeats.map(seat => {
          const seatId = seat._id.toString();
          const bookings = seatBookingsMap[seatId] || [];
          
          // CUSTOM LOGIC: Determine seat availability based on booking dates
          const now = new Date();
          const activeBookings = bookings.filter(booking => 
            new Date(booking.endDate) >= now
          );
          
          const isAvailable = activeBookings.length === 0;
          
          // Find the next available date (if booked)
          let nextAvailableDate = null;
          if (!isAvailable && activeBookings.length > 0) {
            // Sort by end date descending and take the latest end date
            const sortedBookings = [...activeBookings].sort((a, b) => 
              new Date(b.endDate) - new Date(a.endDate)
            );
            nextAvailableDate = sortedBookings[0].endDate;
          }
          
          // Calculate booking occupancy percentage
          const occupancyPercentage = activeBookings.length > 0 ? 100 : 0;
          
          return {
            ...seat,
            isAvailable,
            bookings: activeBookings.map(b => ({
              from: b.startDate,
              to: b.endDate,
              status: b.status
            })),
            nextAvailableDate,
            occupancyPercentage,
            bookingCount: activeBookings.length
          };
        });

        // Calculate library-level statistics
        const availableSeats = seatsWithBookingInfo.filter(s => s.isAvailable);
        const occupiedSeats = seatsWithBookingInfo.filter(s => !s.isAvailable);
        
        const availabilityPercentage = librarySeats.length > 0 
          ? Math.round((availableSeats.length / librarySeats.length) * 100)
          : 0;

        // Only include libraries that have monthly seats
        if (seatsWithBookingInfo.length > 0) {
          enrichedLibraries.push({
            ...library,
            distanceInKm: Number(distance.toFixed(2)),
            monthlyFee: library.monthlyFee,
            seats: seatsWithBookingInfo,
            availableSeatsCount: availableSeats.length,
            totalSeatsCount: librarySeats.length,
            occupiedSeatsCount: occupiedSeats.length,
            availabilityPercentage,
            // CUSTOM FEATURES:
            isHighlyAvailable: availabilityPercentage >= 70,
            isLowAvailability: availabilityPercentage <= 30,
            priceRange: {
              min: library.monthlyFee,
              max: library.monthlyFee * 1.2, // Assuming some seats might have premium pricing
              average: library.monthlyFee
            },
            recommended: availableSeats.length > 0 && availabilityPercentage >= 50
          });
        }

      } catch (err) {
        console.warn(`Skipping library [${library.libraryName}] due to error:`, err.message);
      }
    }

    // Custom sorting: First by distance, then by availability percentage
    enrichedLibraries.sort((a, b) => {
      // Primary sort by distance
      if (a.distanceInKm !== b.distanceInKm) {
        return a.distanceInKm - b.distanceInKm;
      }
      // Secondary sort by availability (higher first)
      return b.availabilityPercentage - a.availabilityPercentage;
    });

    res.status(200).json({
      success: true,
      data: enrichedLibraries,
      summary: {
        totalLibraries: enrichedLibraries.length,
        totalAvailableSeats: enrichedLibraries.reduce((sum, lib) => sum + lib.availableSeatsCount, 0),
        totalSeats: enrichedLibraries.reduce((sum, lib) => sum + lib.totalSeatsCount, 0),
        averageAvailability: enrichedLibraries.length > 0 
          ? Math.round(enrichedLibraries.reduce((sum, lib) => sum + lib.availabilityPercentage, 0) / enrichedLibraries.length)
          : 0,
        highlyAvailableLibraries: enrichedLibraries.filter(lib => lib.isHighlyAvailable).length,
        recommendedLibraries: enrichedLibraries.filter(lib => lib.recommended).length
      }
    });

  } catch (error) {
    console.error('❌ Error in nearest monthly booking libraries:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch nearby libraries for monthly booking',
      error: error.message
    });
  }
};

// new

export const getNearestLibrariesForMonthlyBooking = async (req, res) => {
  let { search = "", libraryType, services } = req.query;
  let { userLat, userLon } = req.body;

  userLat = parseFloat(userLat);
  userLon = parseFloat(userLon);
  const MAX_DISTANCE_KM = 20; // 20km radius

  if (!userLat || !userLon) {
    return res.status(400).json({
      success: false,
      message: "User latitude and longitude are required",
    });
  }

  try {
    // ✅ Base query
    const query = {
      isBlocked: false,
      status: "approved",
      monthlyFee: { $gt: 0 },
      coordinates: { $exists: true, $ne: null },
    };

    if (search) {
      query.$or = [
        { libraryName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { pinCode: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (libraryType) query.libraryType = libraryType;
    if (services)
      query.services = { $in: Array.isArray(services) ? services : [services] };

    // ✅ Find libraries
    const libraries = await Library.find(query)
      .populate("libraryType")
      .populate("services")
      .lean();

    if (!libraries.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const libraryIds = libraries.map((lib) => lib._id);

    // ✅ Get seats
    const monthlySeats = await Seat.find({
      library: { $in: libraryIds },
      seatFor: "monthly-booking",
      isActive: true,
    }).lean();

    const seatIds = monthlySeats.map((s) => s._id);

    // ✅ Get active bookings
    const activeBookings = await MonthlyBooking.find({
      seat: { $in: seatIds },
      status: { $in: ["confirmed", "pending"] },
    })
      .sort({ startDate: 1 })
      .lean();

    // 🔗 Map bookings by seat
    const seatBookingsMap = activeBookings.reduce((map, booking) => {
      const sid = booking.seat.toString();
      if (!map[sid]) map[sid] = [];
      map[sid].push({
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status,
      });
      return map;
    }, {});

    // ✅ Fetch slots linked to seats
    const slots = await TimeSlot.find({
      library: { $in: libraryIds },
      seats: { $in: seatIds },
      isActive: true,
      slotType: "monthly-booking",
    })
      .select("slotTitle startTime endTime price slotType seats")
      .lean();

    // 🔗 Map slots by seat
    const slotMap = {};
    slots.forEach((slot) => {
      slot.seats.forEach((seatId) => {
        const sid = seatId.toString();
        if (!slotMap[sid]) slotMap[sid] = [];
        slotMap[sid].push({
          slotTitle: slot.slotTitle,
          from: slot.startTime,
          to: slot.endTime,
          price: slot.price,
          slotType: slot.slotType,
        });
      });
    });

    // 🔗 Group seats by library
    const seatsByLibrary = {};
    monthlySeats.forEach((seat) => {
      const bookings = seatBookingsMap[seat._id.toString()] || [];

      const nextAvailableDate =
        bookings.length > 0
          ? new Date(
              Math.max(...bookings.map((b) => new Date(b.endDate).getTime()))
            )
          : null;

      const seatWithInfo = {
        _id: seat._id,
        seatNumber: seat.seatNumber,
        isAvailable: bookings.length === 0,
        bookings: bookings.map((b) => ({
          from: b.startDate,
          to: b.endDate,
          status: b.status,
        })),
        nextAvailableDate,
        availableSlots: slotMap[seat._id.toString()] || [],
      };

      if (!seatsByLibrary[seat.library.toString()]) {
        seatsByLibrary[seat.library.toString()] = [];
      }
      seatsByLibrary[seat.library.toString()].push(seatWithInfo);
    });

    // ✅ Enrich libraries
    const enrichedLibraries = [];
    for (const library of libraries) {
      try {
        let libLat, libLon;
        const coords = library.coordinates;

        if (coords) {
          if (typeof coords === "string") {
            try {
              const parsed = JSON.parse(coords.replace(/\\"/g, '"'));
              libLat = parseFloat(parsed.lat);
              libLon = parseFloat(parsed.lng ?? parsed.lon);
            } catch {
              continue;
            }
          } else if (typeof coords === "object") {
            libLat = parseFloat(coords.lat);
            libLon = parseFloat(coords.lng ?? coords.lon);
          }
        }

        if (!libLat || !libLon) continue;

        const distance = findDistanceBetweenLatAndLon(
          userLat,
          userLon,
          libLat,
          libLon
        );
        if (distance > MAX_DISTANCE_KM) continue;

        const librarySeats = seatsByLibrary[library._id.toString()] || [];

        if (librarySeats.length > 0) {
          const nextAvailableForLibrary =
            librarySeats
              .map((s) => s.nextAvailableDate)
              .filter(Boolean)
              .sort((a, b) => a - b)[0] || null;

          enrichedLibraries.push({
            ...library,
            distanceInKm: Number(distance.toFixed(2)),
            monthlyFee: library.monthlyFee,
            seats: librarySeats,
            availableSeatsCount: librarySeats.filter((s) => s.isAvailable)
              .length,
            totalSeatsCount: librarySeats.length,
            nextAvailableFor: nextAvailableForLibrary,
          });
        }
      } catch (err) {
        console.warn(
          `Skipping library [${library.libraryName}] due to error:`,
          err.message
        );
      }
    }

    // ✅ Sort by nearest first
    enrichedLibraries.sort((a, b) => a.distanceInKm - b.distanceInKm);

    res.status(200).json({ success: true, data: enrichedLibraries });
  } catch (error) {
    console.error("❌ Error in nearest monthly libraries:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly booking libraries",
      error: error.message,
    });
  }
};

export const newGetAllLibrariesForMonthlyBooking = async (req, res) => {
  try {
    let { search = "", libraryType, services } = req.query;

    // ✅ Base query
    const query = {
      isBlocked: false,
      status: "approved",
      monthlyFee: { $gt: 0 },
      coordinates: { $exists: true, $ne: null },
    };

    if (search) {
      query.$or = [
        { libraryName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { pinCode: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (libraryType) query.libraryType = libraryType;
    if (services)
      query.services = { $in: Array.isArray(services) ? services : [services] };

    // ✅ Find libraries
    const libraries = await Library.find(query)
      .populate("libraryType")
      .populate("services")
      .lean();

    if (!libraries.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const libraryIds = libraries.map((lib) => lib._id);

    // ✅ Get seats
    const monthlySeats = await Seat.find({
      library: { $in: libraryIds },
      seatFor: "monthly-booking",
      isActive: true,
    }).lean();

    const seatIds = monthlySeats.map((s) => s._id);

    // ✅ Get active bookings
    const activeBookings = await MonthlyBooking.find({
      seat: { $in: seatIds },
      status: { $in: ["confirmed", "pending"] },
    })
      .sort({ startDate: 1 })
      .lean();

    // 🔗 Map bookings by seat
    const seatBookingsMap = activeBookings.reduce((map, booking) => {
      const sid = booking.seat.toString();
      if (!map[sid]) map[sid] = [];
      map[sid].push({
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status,
      });
      return map;
    }, {});

    // ✅ Fetch slots linked to seats
    const slots = await TimeSlot.find({
      library: { $in: libraryIds },
      seats: { $in: seatIds },
      isActive: true,
      slotType: "monthly-booking",
    })
      .select("slotTitle startTime endTime price slotType seats")
      .lean();

    // 🔗 Map slots by seat
    const slotMap = {};
    slots.forEach((slot) => {
      slot.seats.forEach((seatId) => {
        const sid = seatId.toString();
        if (!slotMap[sid]) slotMap[sid] = [];
        slotMap[sid].push({
          slotTitle: slot.slotTitle,
          from: slot.startTime,
          to: slot.endTime,
          price: slot.price,
          slotType: slot.slotType,
        });
      });
    });

    // 🔗 Group seats by library
    const seatsByLibrary = {};
    monthlySeats.forEach((seat) => {
      const bookings = seatBookingsMap[seat._id.toString()] || [];

      const nextAvailableDate =
        bookings.length > 0
          ? new Date(
              Math.max(...bookings.map((b) => new Date(b.endDate).getTime()))
            )
          : null;

      const seatWithInfo = {
        _id: seat._id,
        seatNumber: seat.seatNumber,
        seatFor:seat.seatFor,
        isAvailable: bookings.length === 0,
        bookings: bookings.map((b) => ({
          from: b.startDate,
          to: b.endDate,
          status: b.status,
        })),
        nextAvailableDate,
        availableSlots: slotMap[seat._id.toString()] || [],
      };

      if (!seatsByLibrary[seat.library.toString()]) {
        seatsByLibrary[seat.library.toString()] = [];
      }
      seatsByLibrary[seat.library.toString()].push(seatWithInfo);
    });

    // ✅ Enrich libraries
    const enrichedLibraries = libraries.map((library) => {
      const librarySeats = seatsByLibrary[library._id.toString()] || [];

      if (!librarySeats.length) return null;

      const nextAvailableForLibrary =
        librarySeats
          .map((s) => s.nextAvailableDate)
          .filter(Boolean)
          .sort((a, b) => a - b)[0] || null;

      return {
        ...library,
        monthlyFee: library.monthlyFee,
        seats: librarySeats,
        availableSeatsCount: librarySeats.filter((s) => s.isAvailable).length,
        totalSeatsCount: librarySeats.length,
        nextAvailableFor: nextAvailableForLibrary,
      };
    }).filter(Boolean);

    res.status(200).json({ success: true, data: enrichedLibraries });
  } catch (error) {
    console.error("❌ Error in all monthly libraries:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly booking libraries",
      error: error.message,
    });
  }
};
