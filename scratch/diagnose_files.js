const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const File = require('./server/models/File');
require('dotenv').config({ path: './server/.env' });

async function checkFiles() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const files = await File.find().sort({ uploadDate: -1 }).limit(5);
        console.log(`Found ${files.length} recent files in DB.\n`);

        const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'server', 'uploads');
        console.log(`Current uploadDir: ${uploadDir}`);
        console.log(`Exists: ${fs.existsSync(uploadDir)}\n`);

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
