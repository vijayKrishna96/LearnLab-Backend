const express = require("express");
const { addToCart, removeFromCart, getCart } = require("../controllers/cartController");
const { checkout } = require("../controllers/checkoutController");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/add/:courseId",authMiddleware, addToCart);
router.delete("/remove/:courseId",authMiddleware,  removeFromCart);
router.get("/",authMiddleware, getCart);
router.post("/checkout",  checkout);

module.exports = router;
