import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { StorageParams } from '@interfaces/AppCommonInterface';
import ApiException from '@errors/ApiException';

const storage = (params: StorageParams) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const { storagePath, fileType } = params;
      const publicPath = storagePath?.replace(/^\/+|\/+$/g, '');
      let savePath = '';

      if (fileType === 'PRIVATE') {
        // if fileType is PRIVATE, store in __dirname/../../storage + storagePath
        savePath = path.join(__dirname, `../../storage/${publicPath}`);
      } else {
        // if fileType is PUBLIC, store in __dirname/../../public + storagePath
        savePath = path.join(__dirname, `../../public/${publicPath}`);
      }

      if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true });
      }
      cb(null, savePath);
    },
    filename: (req, file, cb) => {
      cb(
        null,
        crypto.randomBytes(16).toString('hex') +
          path.extname(file.originalname),
      );
    },
  });

/**
 * @param storagePath - The path where files should be saved
 * @param fileType - The type of file storage, either "PUBLIC" or "PRIVATE"
 * @param allowedTypes - Array of allowed MIME types (optional) e.g. ['image/jpeg', 'application/pdf']
 * @returns multer middleware
 */
const upload = (
  storagePath: string,
  fileType: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
  allowedTypes: string[] | undefined = undefined,
) =>
  multer({
    storage: storage({ storagePath, fileType }),
    limits: {
      fileSize:
        parseInt(process.env.MAXIMUM_UPLOAD_SIZE ?? '10', 10) * 1024 * 1024, // Limit file size to 10MB
    },
    fileFilter:
      allowedTypes && allowedTypes.length > 0
        ? (req, file, cb) => {
            if (allowedTypes.includes(file.mimetype)) {
              cb(null, true);
            } else {
              cb(
                new Error(
                  `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
                ),
              );
            }
          }
        : undefined,
  });

export default upload;

export async function deleteUploadedFile(
  filePath: string,
  fileType: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
): Promise<boolean> {
  try {
    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    let uploadedFilePath = '';

    if (fileType === 'PRIVATE') {
      uploadedFilePath = path.join(__dirname, '../../storage', cleanPath);
    } else {
      uploadedFilePath = path.join(__dirname, '../../public', cleanPath);
    }

    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
      return true;
    }

    return false; // File didn't exist
  } catch (error) {
    throw new ApiException('Error deleting file', 500, error);
  }
}
