const { User } = require("../models/userModel");

const addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const user = await User.findById(userId);

        if (!user.cart.includes(courseId)) {
            user.cart.push(courseId);
            await user.save();
        }

        res.json({ message: "Added to cart", cart: user.cart });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const user = await User.findById(userId);

        user.cart = user.cart.filter(id => id.toString() !== courseId);
        await user.save();

        res.json({ message: "Removed from cart", cart: user.cart });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCart = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).populate("cart");

        res.json(user.cart);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
  addToCart,
  removeFromCart,
  getCart
}