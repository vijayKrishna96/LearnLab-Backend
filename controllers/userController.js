const { User, Student, Instructor, Admin } = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { generateUserToken } = require('../utils/generateToken');
const { uploadCloudinary } = require('../utils/uploadCloudinary');


const getAllUsers = async (req, res) => {
    try {
        const { role, page = 1, limit = 10, search = '', sortField = 'name', sortOrder = 'asc' } = req.query;

        const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
        const query = role ? { role } : {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (page - 1) * limit;

        let Model =
            role === "student" ? Student :
            role === "instructor" ? Instructor :
            role === "admin" ? Admin :
            User; // fallback

        const users = await Model.find(query)
            .select("-password -refreshToken")
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit, 10))
            .populate([
                { path: "courses", select: "-__v" },
                { path: "wishlistDetails" },
                { path: "purchasedCourseDetails" }
            ]);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total: users.length
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
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
        const { name, email, password, role } = req.body;

        const exists =
            (await Student.findOne({ email })) ||
            (await Instructor.findOne({ email })) ||
            (await Admin.findOne({ email }));

        if (exists) return res.status(400).json({ message: "User already exists" });

        const hashed = await bcrypt.hash(password, 10);

        let user;

        if (role === "student") user = await Student.create({ ...req.body, password: hashed });
        else if (role === "instructor") user = await Instructor.create({ ...req.body, password: hashed });
        else if (role === "admin") user = await Admin.create({ ...req.body, password: hashed });
        else return res.status(400).json({ message: "Invalid role" });

        const token = generateUserToken(email, role);

        res.status(201).json({
            message: `${role} registered successfully`,
            user,
            token,
            success: true
        });

    } catch (error) {
        res.status(500).json({ message: "Error registering user", error: error.message });
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
