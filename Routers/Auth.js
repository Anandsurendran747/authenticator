const express = require('express');
const router = express.Router();
const Login = require('../Models/Login');
const User = require('../Models/User');
const Sheets = require('../Models/Sheets');


router.post('/login', async (req, res) => {
    const { username, password, uuID } = req.body;
    console.log('Login request received:', { username, uuID });
    try {
        const user = await Login.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Authentication failed. User not found.' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Authentication failed. Wrong password.' });
        }
        console.log(user)

        if (user.uuID && user.uuID !== uuID) {
            return res.status(401).json({ message: 'Already logged in on another device.' });
        }
        const updatedUser = await Login.findOneAndUpdate({ _id: user._id }, { uuID }, { new: true });

        const userDetails = await User.findById(updatedUser.userId).select('-__v');
        if (!userDetails) {
            return res.status(404).json({ message: 'User details not found.' });
        }

        res.json({ message: 'Login successful', user: userDetails });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});




router.post('/register', async (req, res) => {

    const { ownerName, businessName, phone, address, email, username, password } = req.body;
    try {
        const existingUser = await Login.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        const user = new User({ ownerName, businessName, phone, address, email });
        await user.save();
        const newUser = new Login({ username, password, userId: user._id });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
        console.error('Error during registration:', err);
    }
});

router.post('/logout', async (req, res) => {
    const { userId } = req.body;
    console.log('Logout request received:', { userId });
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await Login.findOneAndUpdate({ userId }, { uuID: null });
        res.json({ message: 'Logout successful' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});


router.post('/create-sheet', async (req, res) => {
    const { userId, sheetId } = req.body;
    try {
        const existingSheet = await Sheets.findOne({ userId });
        if (existingSheet) {
            return res.status(400).json({ message: 'Sheet already exists for this user' });
        }
        const newSheet = new Sheets({ userId, sheetId });
        await newSheet.save();
        res.status(201).json({ message: 'Sheet created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});




module.exports = router;