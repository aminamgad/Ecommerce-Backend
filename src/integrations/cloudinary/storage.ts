import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type UploadedImage = {
  publicId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

function configureCloudinary(): void {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

export async function uploadImageBuffer(
  buffer: Buffer,
  options: { folder: string; mimeType: string }
): Promise<UploadedImage> {
  configureCloudinary();

  if (!ALLOWED_MIME_TYPES.has(options.mimeType)) {
    throw new ApiError(400, 'Validation failed', [
      'Image must be jpeg, png, webp, or gif',
    ]);
  }

  if (buffer.length === 0) {
    throw new ApiError(400, 'Validation failed', ['Empty image file']);
  }

  const folder = `${env.cloudinaryFolder}/${options.folder}`.replace(
    /\/+/g,
    '/'
  );

  try {
    const result = await new Promise<{
      public_id: string;
      secure_url: string;
      width?: number;
      height?: number;
      format?: string;
      bytes?: number;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          overwrite: false,
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(uploaded);
        }
      );
      stream.end(buffer);
    });

    if (!result.public_id?.trim() || !result.secure_url?.trim()) {
      throw new ApiError(502, 'Failed to upload image');
    }

    return {
      publicId: result.public_id,
      url: result.secure_url,
      ...(result.width !== undefined ? { width: result.width } : {}),
      ...(result.height !== undefined ? { height: result.height } : {}),
      ...(result.format !== undefined ? { format: result.format } : {}),
      ...(result.bytes !== undefined ? { bytes: result.bytes } : {}),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Cloudinary upload error');
    throw new ApiError(502, 'Failed to upload image');
  }
}

export async function deleteImage(publicId: string): Promise<void> {
  configureCloudinary();

  if (!publicId || publicId.trim().length === 0) {
    throw new ApiError(400, 'Invalid image publicId');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error('Unexpected Cloudinary destroy result');
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Cloudinary delete error');
    throw new ApiError(502, 'Failed to delete image');
  }
}
