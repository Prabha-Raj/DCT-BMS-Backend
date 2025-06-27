import axios from "axios";

export const getLatLngFromPostalCode = async (postalCode) => {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=India&format=json`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'YourAppName/1.0 (your@email.com)' } // Required by OSM
    });

    if (response.data.length === 0) {
      console.log("No location found for postal code");
      return;
    }

    const location = response.data[0];
    console.log("Latitude:", location.lat);
    console.log("Longitude:", location.lon);
  } catch (error) {
    console.error("Error:", error.message);
  }
};


export const getAddressFromPostalCode = async (postalCode) => {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=India&format=json&addressdetails=1`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'BookMySpace/1.0 (your@email.com)'
      }
    });

    if (response.data.length === 0) {
      console.log("❌ No address found for this postal code");
      return;
    }

    const location = response.data[0];

    console.log("✅ Latitude:", location.lat);
    console.log("✅ Longitude:", location.lon);

    // Now log full address
    const address = location.display_name;
    console.log("📍 Address:", address);

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};


// Haversine Formula for distance in KM
 const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

 export const findDistanceBetweenLatAndLon = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get lat/lng from pin code
const getLatLng = async (pinCode) => {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${pinCode}&country=India&format=json&addressdetails=1`;
  
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'BookMySpace/1.0 (email@domain.com)' }
  });

  if (!response.data.length) {
    throw new Error(`No location found for PIN: ${pinCode}`);
  }

  const location = response.data[0];
  return {
    lat: parseFloat(location.lat),
    lon: parseFloat(location.lon),
    address: location.display_name
  };
};

// Main controller
export const findDistanceBetweenPins = async (pin1, pin2) => {
//   const { pin1, pin2 } = req.query;

  if (!pin1 || !pin2) {
    return res.status(400).json({ error: "Both pin1 and pin2 are required" });
  }

  try {
    const loc1 = await getLatLng(pin1);
    const loc2 = await getLatLng(pin2);

    const distance = calculateDistance(loc1.lat, loc1.lon, loc2.lat, loc2.lon);

    return distance.toFixed(2);
    // return({
    //   from: { pin: pin1, address: loc1.address },
    //   to: { pin: pin2, address: loc2.address },
    //   distanceInKm: distance.toFixed(2)
    // });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};




export const getLatLngFromAddress = async (fullAddress) => {
    console.log("f",fullAddress)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&addressdetails=1`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'BookMySpace/1.0 (your@email.com)'
      }
    });

    if (!response.data.length) {
      console.log("❌ No coordinates found for the address.");
      return null;
    }

    const location = response.data[0];

    console.log("✅ Address:", location.display_name);
    console.log("📍 Latitude:", location.lat);
    console.log("📍 Longitude:", location.lon);

    return {
      lat: parseFloat(location.lat),
      lon: parseFloat(location.lon),
      display_name: location.display_name,
    };

  } catch (error) {
    console.error("❌ Error fetching coordinates:", error.message);
    return null;
  }
};

