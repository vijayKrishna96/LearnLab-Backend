const express = require('express');
const { getAllUsers, registerUser, updateUser, deleteUser,  userProfile, checkUser, getUserById, } = require('../controllers/userController');
const { protect, admin } = require('../middleware/Protected');
const { authUser } = require('../middleware/userAuth');
const { upload } = require('../middleware/fileUpload');
const router = express.Router();


router.get ('/profile' ,authUser,  userProfile);

router.get('/users' , getAllUsers)

router.get('/checkUser' ,authUser, checkUser)

router.get('/:userId' , getUserById);

router.get('/user/:userId', getUserById)

router.post('/register' , registerUser);

router.patch('/update/:userId' ,upload.single("images"), updateUser);

router.delete('/delete/:userId', deleteUser);


module.exports = router;
