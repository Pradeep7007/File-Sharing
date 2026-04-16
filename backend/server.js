const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const File = require('./models/File');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Create uploads directory if it doesn't exist
// VERCEL HACK: Use /tmp if running on Vercel (read-only filesystem)
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const uploadDir = isVercel 
    ? path.join('/tmp', 'uploads')
    : path.resolve(__dirname, process.env.UPLOAD_DIR || 'uploads');

try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log(`✅ Uploads directory (${isVercel ? 'Vercel Temp' : 'Absolute'}):`, uploadDir);
    if (isVercel) {
        console.warn('⚠️ WARNING: Using ephemeral /tmp storage. Files WILL BE DELETED after execution.');
    }
} catch (err) {
    console.warn('⚠️ Could not create uploads directory:', err.message);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const fileId = crypto.randomBytes(16).toString('hex');
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9\.\-]/g, '_');
        cb(null, `${fileId}_${sanitizedName}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Database Connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
    console.error('❌ CRITICAL: MONGODB_URI is not defined! Falling back to localhost (this will fail in production).');
}

console.log('📡 DB Status: Initializing connection...');

mongoose.connect(mongoUri || 'mongodb://localhost:27017/fileshare')
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        if (!process.env.VERCEL) process.exit(1);
    });

// Debug Endpoint (Temporary)
app.get('/debug-db', (req, res) => {
    res.json({
        hasUri: !!process.env.MONGODB_URI,
        uriPrefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.split(':')[0] + '://' + (process.env.MONGODB_URI.split('@')[1] || '').split('.')[0] : 'none',
        connectionState: mongoose.connection.readyState,
        env: process.env.NODE_ENV || 'development',
        isVercel: !!process.env.VERCEL
    });
});

// Middleware to check DB connection
app.use((req, res, next) => {
    const state = mongoose.connection.readyState;
    const states = { 
        0: 'disconnected', 
        1: 'connected', 
        2: 'connecting', 
        3: 'disconnecting' 
    };

    // If connected, proceed
    if (state === 1) return next();

    // Log the issue for Vercel logs
    console.error(`⚠️ DB Connection Check: Current state is "${states[state]}"`);

    // Return a descriptive error
    return res.status(503).json({ 
        error: 'Database not ready.', 
        currentState: states[state] || 'unknown',
        message: 'The backend is running but cannot connect to MongoDB.',
        troubleshooting: [
            '1. Ensure MONGODB_URI is set in Vercel Environment Variables.',
            '2. Ensure your IP (0.0.0.0/0) is whitelisted in MongoDB Atlas Network Access.',
            '3. Check Vercel Logs for the specific connection error message.'
        ]
    });
});

// Utility: Hash Password
const hashPassword = (password) => {
    if (!password) return null;
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Routes

// 1. Upload File
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please select a file to upload.' });
        }

        const { password, expiryHours } = req.body;
        const fileId = req.file.filename.split('_')[0]; 

        const fileData = {
            fileId,
            originalFilename: req.file.originalname,
            storedFilename: req.file.filename,
            uploadTime: new Date(),
            passwordHash: hashPassword(password)
        };

        if (expiryHours && parseInt(expiryHours) > 0) {
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + parseInt(expiryHours));
            fileData.expiryTime = expiryDate;
        }

        const newFile = new File(fileData);
        await newFile.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const fileDownloadUri = `${frontendUrl}/?id=${fileId}`;

        console.log(`File uploaded: ${fileId} -> ${req.file.originalname}`);

        res.json({
            success: true,
            id: fileId,
            url: fileDownloadUri,
            filename: req.file.originalname
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ 
            error: 'Could not store file.', 
            details: error.message 
        });
    }
});

// 2. Get File Info
app.get('/api/info/:fileId', async (req, res) => {
    try {
        const file = await File.findOne({ fileId: req.params.fileId });
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (file.expiryTime && new Date() > file.expiryTime) {
            return res.status(410).json({ error: 'Link has expired' });
        }

        res.json({
            filename: file.originalFilename,
            requiresPassword: !!file.passwordHash,
            uploadTime: file.uploadTime
        });

    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Download File
app.get('/download/:fileId', async (req, res) => {
    try {
        const { password } = req.query;
        const file = await File.findOne({ fileId: req.params.fileId });

        if (!file) {
            return res.status(404).send('File not found');
        }

        if (file.expiryTime && new Date() > file.expiryTime) {
            return res.status(410).send('This link has expired');
        }

        if (file.passwordHash) {
            if (!password) {
                return res.status(401).send('Password required to download this file.');
            }
            if (file.passwordHash !== hashPassword(password)) {
                return res.status(401).send('Incorrect password');
            }
        }

        const filePath = path.join(uploadDir, file.storedFilename);
        console.log(`[DOWNLOAD] Request for ID: ${req.params.fileId}`);
        console.log(`[DOWNLOAD] Looking for file at: ${filePath}`);
        
        if (fs.existsSync(filePath)) {
            res.download(filePath, file.originalFilename, (err) => {
                if (err) console.error('[DOWNLOAD] Stream Error:', err);
            });
        } else {
            console.error(`[DOWNLOAD] File not found on disk: ${filePath}`);
            // Log directory content for debugging
            try {
                const files = fs.readdirSync(uploadDir);
                console.log(`[DEBUG] Directory ${uploadDir} contains:`, files);
            } catch (dirErr) {
                console.error(`[DEBUG] Could not read directory ${uploadDir}:`, dirErr.message);
            }
            res.status(404).send('File missing on server. It may have been deleted or the server storage was reset.');
        }

    } catch (error) {
        res.status(500).send('Server error');
    }
});

// 4. List All Files
app.get('/api/files', async (req, res) => {
    try {
        const files = await File.find().sort({ uploadTime: -1 });
        
        // Filter out expired files
        const now = new Date();
        const activeFiles = files.filter(f => !f.expiryTime || f.expiryTime > now);

        res.json(activeFiles.map(f => ({
            fileId: f.fileId,
            filename: f.originalFilename,
            uploadTime: f.uploadTime,
            requiresPassword: !!f.passwordHash
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// 5. Delete File
app.delete('/api/files/:fileId', async (req, res) => {
    try {
        const { deletePassword } = req.body;
        
        // Security Check: Hardcoded Global Delete Password
        if (deletePassword !== '123@#') {
            return res.status(403).json({ error: 'Incorrect delete password' });
        }

        const file = await File.findOne({ fileId: req.params.fileId });
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // 1. Delete physical file
        const filePath = path.join(uploadDir, file.storedFilename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 2. Delete DB record
        await File.deleteOne({ fileId: req.params.fileId });

        console.log(`✅ File deleted: ${req.params.fileId}`);
        res.json({ success: true, message: 'File deleted successfully' });

    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete file', details: error.message });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File is too large! Max limit is 500MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 5000;
// We only skip app.listen if we are strictly on Vercel's serverless platform
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`✅ Server is live and listening on port ${PORT}`);
    });
}

module.exports = app;
