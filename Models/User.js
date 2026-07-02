const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    ownerName: {
        type: String,
        required: true
    },
    businessName: {
        type: String,
        required: false
    },
    phone: {
        type: String,
        required: false
    },
    address: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: true,
        unique: true
    }
});

module.exports = mongoose.model('User', UserSchema);

