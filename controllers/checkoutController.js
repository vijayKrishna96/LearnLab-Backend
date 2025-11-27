

const Course = require("../models/courseModel");
const { User } = require("../models/userModel");

exports.checkout = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);

        if (user.cart.length === 0)
            return res.status(400).json({ message: "Cart is empty" });

        // Move items to purchasedCourses
        const purchased = user.cart.map(courseId => ({
            course: courseId,
            purchasedAt: new Date()
        }));

        // Push purchased courses
        user.purchasedCourses.push(...purchased);

        // Add student to course
        await Course.updateMany(
            { _id: { $in: user.cart } },
            { $push: { students: userId } }
        );

        // Clear cart
        user.cart = [];
        await user.save();

        res.json({ message: "Checkout successful" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
