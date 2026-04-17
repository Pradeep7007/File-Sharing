const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const File = require('./models/File');
require('dotenv').config();

async function checkFiles() {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const files = await File.find().sort({ uploadDate: -1 }).limit(10);
        console.log(`Found ${files.length} recent files in DB.\n`);

        const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'uploads');
        console.log(`Current uploadDir: ${uploadDir}`);
        console.log(`Exists: ${fs.existsSync(uploadDir)}\n`);

        if (fs.existsSync(uploadDir)) {
            const diskFiles = fs.readdirSync(uploadDir);
            console.log(`Files on disk in uploads folder (${diskFiles.length}):`);
            diskFiles.forEach(f => console.log(` - ${f}`));
            console.log('');
        }

        for (const file of files) {
            const fullPath = path.join(uploadDir, file.filename);
            const exists = fs.existsSync(fullPath);
            console.log(`File: ${file.originalName}`);
            console.log(`DB Filename: ${file.filename}`);
            console.log(`Expected Path: ${fullPath}`);
            console.log(`Status: ${exists ? 'EXISTS' : 'MISSING'}`);
            console.log('---');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkFiles();
