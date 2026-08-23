const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the typical upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/shops');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage logic natively
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, 'shop-' + uniqueSuffix + ext);
    }
});

// Configure file filtering securely
const fileFilter = (req, file, cb) => {
    console.log('\n--- MULTER FILE INGESTION ---');
    console.log(file);
    console.log('-----------------------------\n');
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

    if (allowedMimeTypes.includes(file.mimetype) || (file.mimetype === 'application/octet-stream' && allowedExtensions.includes(ext))) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: fileFilter
});

module.exports = upload;
