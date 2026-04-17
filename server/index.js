require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const serverless = require('serverless-http');
const File = require('./models/File');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        if (!process.env.MONGO_URI) {
            console.error('CRITICAL: MONGO_URI is not defined in environment variables');
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
};

// Ensure uploads directory exists
let uploadDir;
try {
    uploadDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (e) {
    console.error('Failed to create upload directory, falling back to /tmp');
    uploadDir = '/tmp';
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } 
}).single('file');

// Routes
app.get("/", (req, res) => {
  res.send("DropShare API is working 🚀");
});

// 1. Upload File
app.post('/upload', async (req, res) => {
    await connectDB();
    upload(req, res, async (err) => {
        if (err) return res.status(500).json({ error: 'Upload error: ' + err.message });
        if (!req.file) return res.status(400).json({ error: 'Please upload a file' });

        try {
            const { password } = req.body;
            let hashedPassword = null;
            if (password && password.trim() !== "") {
                hashedPassword = await bcrypt.hash(password, 10);
            }

            const fileData = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                path: req.file.filename,
                password: hashedPassword || "none",
                size: req.file.size,
                type: req.file.mimetype
            };

            const file = await File.create(fileData);
            
            // Check if BASE_URL has protocol, if not add it
            let baseUrl = process.env.BASE_URL || "";
            if (baseUrl && !baseUrl.startsWith('http')) {
                baseUrl = `https://${baseUrl}`;
            }

            res.status(200).json({ 
                message: 'File uploaded successfully',
                file: {
                    id: file._id,
                    name: file.originalName,
                    downloadLink: `${baseUrl}/download/${file._id}`
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Database error: ' + error.message });
        }
    });
});

// 2. Get All Files
app.get('/files', async (req, res) => {
    try {
        await connectDB();
        const files = await File.find().sort({ uploadDate: -1 });
        
        let baseUrl = process.env.BASE_URL || "";
        if (baseUrl && !baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }

        const fileList = files.map(file => ({
            id: file._id,
            name: file.originalName,
            size: file.size,
            uploadDate: file.uploadDate,
            downloadCount: file.downloadCount,
            downloadLink: `${baseUrl}/download/${file._id}`,
            hasPassword: file.password !== "none"
        }));
        res.status(200).json(fileList);
    } catch (error) {
        res.status(500).json({ error: 'Fetch error: ' + error.message });
    }
});

// 3. Download File
app.get('/download/:id', async (req, res) => {
    try {
        await connectDB();
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const fullPath = path.join(uploadDir, file.filename);
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found on storage' });
        }

        file.downloadCount++;
        await file.save();

        res.setHeader('Content-Type', file.type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
        res.download(fullPath, file.originalName);
    } catch (error) {
        res.status(500).json({ error: 'Download error: ' + error.message });
    }
});

// 4. Delete File
app.delete('/delete/:id', async (req, res) => {
    try {
        await connectDB();
        const { password } = req.body;
        const file = await File.findById(req.params.id);

        if (!file) return res.status(404).json({ error: 'File not found' });
        if (password !== "123") {
            return res.status(401).json({ error: 'Incorrect Global Password' });
        }

        const fullPath = path.join(uploadDir, file.filename);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        
        await File.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Delete error: ' + error.message });
    }
});

module.exports = app;
module.exports.handler = serverless(app);

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
