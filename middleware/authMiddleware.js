import jwt from "jsonwebtoken";
import User from "../model/User.js";


// ✅ Protect: Token Validator Middleware
export const protect = async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      req.user = user;
      // console.log("protect user++++++++++++++++++++++++", user.role, user._id)
      next();
    } else {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

// ✅ Admin Only Middleware
export const adminOnly = (req, res, next) => {
  // console.log("only admin user++++++++++++++++++++++++", req.user.role)
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Admins only allow." });
  }
};

// ✅ Teacher Only Middleware (approved teacher)
export const librarianOnly = (req, res, next) => {
  if (req.user && req.user.role === "librarian") {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Librarian only allow." });
  }
};

export const studentOnly = (req, res, next) => {
  if (req.user && req.user.role === "student") {
    next();
  } else {
    res.status(401).json({ message: "Access denied: Student only allow." });
  }
};
