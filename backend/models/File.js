const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    fileId: { type: String, required: true, unique: true },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    uploadTime: { type: Date, default: Date.now },
    expiryTime: { type: Date },
    passwordHash: { type: String }
});

module.exports = mongoose.model('File', fileSchema);
