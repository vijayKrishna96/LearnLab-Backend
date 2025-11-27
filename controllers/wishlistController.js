
const Course = require("../models/courseModel");
const { User } = require("../models/userModel");

// ⭐ Add item to wishlist
const addToWishlist = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found" });

        // Prevent duplicate wishlist entries
        if (!user.wishlist.includes(courseId)) {
            user.wishlist.push(courseId);
            await user.save();
        }

        res.json({ message: "Added to wishlist", wishlist: user.wishlist });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ⭐ Remove item from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const user = await User.findById(userId);

        user.wishlist = user.wishlist.filter(id => id.toString() !== courseId);
        await user.save();

        res.json({ message: "Removed from wishlist", wishlist: user.wishlist });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ⭐ Get wishlist (populated)
const getWishlist = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId)
            .populate("wishlist");

        res.json(user.wishlist);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    addToWishlist,
    removeFromWishlist,
    getWishlist
}