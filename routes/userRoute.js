const express = require('express');
const { getAllUsers, registerUser, updateUser, deleteUser,  userProfile, checkUser, getUserById, } = require('../controllers/userController');
const { protect, admin } = require('../middleware/Protected');

const { upload } = require('../middleware/fileUpload');
const userAuth = require('../middleware/userAuth');
const router = express.Router();


router.get ('/profile' ,userAuth,  userProfile);

router.get('/users' , getAllUsers)

router.get('/checkUser' ,userAuth, checkUser)

router.get('/:userId' , getUserById);

router.get('/user/:userId', getUserById)

router.post('/register' , registerUser);

router.patch('/update/:userId' ,upload.single("images"), updateUser);

router.delete('/delete/:userId', deleteUser);


module.exports = router;
