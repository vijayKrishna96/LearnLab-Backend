const bcrypt = require("bcryptjs");
const { User } = require("../models/userModel");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} = require("../utils/generateToken");
const { path } = require("..");

const isProduction = process.env.NODE_ENV === "production";

// Centralize cookie options to avoid this mistake repeating
const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  ...(isProduction && { domain: "learnlab-backend.onrender.com" }),
  path: "/",
  maxAge,
});

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.active) return res.status(403).json({ message: "User is not active" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({
      success: true,
      message: `${user.role} login successful`,
      user: { id: user._id, role: user.role, email: user.email, name: user.name },
    });
  } catch (err) {
    return res.status(500).json({ message: "Error logging in", error: err.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const decoded = verifyToken(token, process.env.REFRESH_TOKEN_SECRET);
    if (!decoded) return res.status(401).json({ message: "Invalid refresh token" });

    const user = await User.findById(decoded.id);
    if (!user || !user.active) return res.status(403).json({ message: "User inactive" });

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // ✅ Fixed: was using sameSite: "strict" before
    res.cookie("accessToken", newAccessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", newRefreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: "Refresh failed", error: err.message });
  }
};

const logout = (req, res) => {
  try {
    res.clearCookie("accessToken", cookieOptions(0));   // reuse same options
    res.clearCookie("refreshToken", cookieOptions(0));
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Error logging out", error: err.message });
  }
};

const verifyLogin = async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(200).json({ loggedIn: false, user: null });
    }

    const decoded = verifyToken(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(200).json({ loggedIn: false, user: null });
    }

    // Fetch user from DB
    const user = await User.findById(decoded.id);
    if (!user || !user.active) {
      return res.status(200).json({ loggedIn: false, user: null });
    }

    return res.status(200).json({
      loggedIn: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        profilePicture: user.profilePicture || "",
      },
    });
  } catch (err) {
    return res.status(500).json({
      loggedIn: false,
      message: "Error verifying login",
      error: err.message,
    });
  }
};

module.exports = {
  loginUser,
  refreshToken,
  logout,
  verifyLogin,
};
