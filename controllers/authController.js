const User = require('../models/userModel')
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken')


const loginUser = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if user exists in any of the roles (Student, Instructor, Admin)
      const user =
        await User.Student.findOne({ email }) ||
        await User.Instructor.findOne({ email }) ||
        await User.Admin.findOne({ email });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Compare the provided password with the stored hashed password
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid password' });
      }
  
      // Generate JWT token
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
  
      // Set token in an HTTP-only cookie
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  
      // Send success response
      res.status(200).json({ message: 'Login successful', user: { id: user._id, role: user.role } });
  
    } catch (error) {
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  };
  
  const verifyLogin = async (req, res) => {
    try {
      if (req.cookies.token) {
        res.status(200).json({ message: 'Logged in' });
      } else {
        res.status(401).json({ message: 'Unauthorized access' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error verifying login', error: error.message });
    }
  };
  
  const logout = async (req, res) => {
    try {
      res.clearCookie('token');
      res.status(200).json({ message: 'Logged out' });
    } catch (error) {
      res.status(500).json({ message: 'Error logging out', error: error.message });
    }
  };

  module.exports = {
    loginUser,
    verifyLogin,
    logout
  }