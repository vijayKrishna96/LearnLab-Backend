const express = require("express");
const router = express.Router();
// const auth = require("../middleware/auth");
const { checkout } = require("../controllers/checkoutController");
const { addToCart, removeFromCart, getCart } = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");


// const { checkout } = require("../controllers/checkoutController");

router.post("/add/:courseId", authMiddleware,  addToCart);
router.delete("/remove/:courseId", authMiddleware,  removeFromCart);
router.get("/",authMiddleware,  getCart);
router.post("/checkout",  checkout);

module.exports = router;
