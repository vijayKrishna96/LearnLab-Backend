const mongoose = require('mongoose');

const validators = {
  isValidObjectId: (id) => mongoose.Types.ObjectId.isValid(id),
  
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  isStrongPassword: (password) => {
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  },
  
  isValidPrice: (price) => {
    return !isNaN(price) && price >= 0 && Number.isFinite(price);
  },
  
  isValidEnum: (value, enumArray) => enumArray.includes(value),
};

module.exports = validators;