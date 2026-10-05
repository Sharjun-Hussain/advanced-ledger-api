const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the typical upload directory exists (never crash boot on perms).
const uploadDir = path.join(__dirname, '../../uploads/shops');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.error(`[upload] cannot create ${uploadDir}: ${err.message} — file uploads will fail until permissions are fixed`);
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
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

    // Both mimetype AND extension must agree — no octet-stream bypass.
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
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
