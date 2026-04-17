require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const File = require('./models/File');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
}).single('file');

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes

// 1. Upload File
app.post('/upload', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Please upload a file' });
        }

        try {
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const fileData = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                path: req.file.path,
                password: hashedPassword,
                size: req.file.size,
                type: req.file.mimetype
            };

            const file = await File.create(fileData);
            
            res.status(200).json({ 
                message: 'File uploaded successfully',
                file: {
                    id: file._id,
                    name: file.originalName,
                    downloadLink: `${process.env.BASE_URL}/download/${file._id}`
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

// 2. Get All Files (Metadata)
app.get('/files', async (req, res) => {
    try {
        const files = await File.find().sort({ uploadDate: -1 });
        const fileList = files.map(file => ({
            id: file._id,
            name: file.originalName,
            size: file.size,
            uploadDate: file.uploadDate,
            downloadCount: file.downloadCount,
            downloadLink: `${process.env.BASE_URL}/download/${file._id}`
        }));
        res.status(200).json(fileList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Download File
app.get('/download/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment download count
        file.downloadCount++;
        await file.save();

        res.download(file.path, file.originalName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Delete File
app.delete('/delete/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Password is required to delete' });
        }

        const isMatch = await bcrypt.compare(password, file.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Delete from local storage
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // Delete from database
        await File.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
