import multer from 'multer';
import { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new ApiError(400, 'Validation failed', [
          'Image must be jpeg, png, webp, or gif',
        ])
      );
      return;
    }
    cb(null, true);
  },
});

/**
 * Accept a single image field named `image`.
 */
export const uploadProductImage: RequestHandler = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof ApiError) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new ApiError(400, 'Validation failed', [
            'Image must be at most 5 MB',
          ])
        );
        return;
      }
      next(new ApiError(400, 'Validation failed', [error.message]));
      return;
    }

    next(error);
  });
};
