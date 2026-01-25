const { User, Student, Instructor, Admin } = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { generateUserToken } = require('../utils/generateToken');
const { uploadCloudinary } = require('../utils/uploadCloudinary');
const validators = require('../utils/validators');


const getAllUsers = async (req, res) => {
  try {
    const {
      role,
      page = 1,
      limit = 10,
      search = "",
      sortField = "name",
      sortOrder = "asc",
    } = req.query;

    const sort = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    const query = {};
    if (role) query.role = role;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    let Model;
    let populateOptions = [];

    /* ================= ROLE-BASED MODEL & POPULATE ================= */

    if (role === "student") {
      Model = Student;
      populateOptions = [
        { path: "purchasedCourses", select: "-__v" },
        { path: "wishlistDetails" },
        { path: "purchasedCourseDetails" },
      ];
    } 
    else if (role === "instructor") {
      Model = Instructor;
      populateOptions = [
        {
          path: "courses",
          select: "title price category enrolledStudents",
        },
      ];
    } 
    else if (role === "admin") {
      Model = Admin;
    } 
    else {
      Model = User; // fallback
    }

    /* ================= QUERY ================= */

    const users = await Model.find(query)
      .select("-password -refreshToken")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate(populateOptions);

    const total = await Model.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
};



const getUserById = async (req, res) => {
    try {
        const id = req.params.userId;

        let user =
            (await Student.findById(id)) ||
            (await Instructor.findById(id)) ||
            (await Admin.findById(id));

        if (!user) return res.status(404).json({ message: "User Not Found" });

        res.status(200).json(user);

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const registerUser = async (req, res) => {
  try {
    console.log("Registration request:", req.body);
    
    const { name, email, password, role } = req.body;

    // ✅ Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required" 
      });
    }

    // Email validation
    if (!validators.isValidEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid email format" 
      });
    }

    // Password strength
    if (!validators.isStrongPassword(password)) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be 8+ chars with uppercase, lowercase, number, and special character" 
      });
    }

    // Role validation
    const validRoles = ["student", "instructor", "admin"];
    if (!validators.isValidEnum(role, validRoles)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid role",
        validRoles 
      });
    }

    // Check if user already exists
    const exists = await Student.findOne({ email }) || 
                  await Instructor.findOne({ email }) || 
                  await Admin.findOne({ email });
    
    if (exists) {
        return res.status(400).json({ 
            success: false,
            message: "User with this email already exists" 
        });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user based on role
    const userData = {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role
    };

    let user;
    
    if (role === "student") {
        user = await Student.create(userData);
    } else if (role === "instructor") {
        user = await Instructor.create(userData);
    } else if (role === "admin") {
        user = await Admin.create(userData);
    }

    // Return success WITHOUT token
    return res.status(201).json({
        success: true,
        message: `${role} registered successfully!`,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            verified: user.verified,
            createdAt: user.createdAt
        }
        // NO TOKEN HERE
    });

  } catch (error) {
    console.error("Registration error:", error);
    
    // Handle specific errors
    if (error.code === 11000) {
        return res.status(400).json({ 
            success: false,
            message: "Email already exists" 
        });
    }
    
    if (error.name === 'ValidationError') {
        return res.status(400).json({ 
            success: false,
            message: "Validation error",
            error: error.message 
        });
    }
    
    return res.status(500).json({ 
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateUser = async (req, res) => {
    try {
        let updateData = { ...req.body };

        // File upload → cloudinary
        if (req.file) {
            const upload = await uploadCloudinary(req.file.path, `users/${req.params.userId}`);
            if (upload) updateData.profilePicture = upload.url;
        }

        const id = req.params.userId;

        const updated =
            (await Student.findByIdAndUpdate(id, updateData, { new: true })) ||
            (await Instructor.findByIdAndUpdate(id, updateData, { new: true })) ||
            (await Admin.findByIdAndUpdate(id, updateData, { new: true }));

        if (!updated) return res.status(404).json({ message: "User not found" });

        res.json({ message: "Updated successfully", updated });

    } catch (err) {
        res.status(500).json({ message: "Error updating user", error: err.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const id = req.params.userId;

        let user =
            (await Student.findByIdAndDelete(id)) ||
            (await Instructor.findByIdAndDelete(id)) ||
            (await Admin.findByIdAndDelete(id));

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ message: "User deleted", user });

    } catch (error) {
        res.status(500).json({ message: "Error deleting user", error: error.message });
    }
};

const userProfile = async (req, res) => {
    try {
        const { email, role } = req.user;

        let Model = role === "student" ? Student :
                    role === "instructor" ? Instructor :
                    Admin;

        const user = await Model.findOne({ email }).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ success: true, data: user });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


const checkUser = async (req, res) => {
    try {
        const user = req.user;

        if (!user) return res.status(401).json({ message: "User is not authenticated" });

        res.json({
            success: true,
            message: `${user.role} authenticated`,
            role: user.role,
            userId: user.userId
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



module.exports = {
  getAllUsers,
  getUserById,
  registerUser,
  updateUser,
  deleteUser,
  checkUser,
  userProfile,
  getUserById,
};
