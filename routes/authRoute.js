const express = require('express');
const { loginUser, verifyLogin, logout, refreshToken } = require('../controllers/authController');

const router = express.Router()

router.post('/login', loginUser)
router.get('/verify' , verifyLogin),
router.post('/logout', logout)
router.post('/refresh', refreshToken);

module.exports = router