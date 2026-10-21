import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DocumentCategory } from '../types/domain';
import { config } from '../config';

const uploadRoot = path.resolve(config.uploadPath);

export interface UploadResult {
  fileName: string;
  originalName: string;
  filePath: string; // path relative to the uploads root
  fileSize: number;
  mimeType: string;
}

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export class FileUploadService {
  private sanitizeSegment(segment: string): string {
    return segment
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  // Stored extension is derived from the *validated* MIME type, never from
  // the client-supplied filename — otherwise `evil.html` uploaded as
  // "image/png" would be served as text/html from /uploads/public (XSS).
  private static readonly MIME_EXT: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/quicktime': '.mov',
  };

  private extensionFor(mimeType: string, originalName: string): string {
    if (FileUploadService.MIME_EXT[mimeType]) {
      return FileUploadService.MIME_EXT[mimeType];
    }
    // Unknown type → keep a benign extension only; anything that could be
    // served as active content (.html/.svg/.js…) is dropped entirely.
    const ext = path.extname(originalName).toLowerCase();
    const SAFE = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.mp4', '.avi', '.mov', '.csv']);
    return SAFE.has(ext) ? ext : '';
  }

  private buildFolder(
    isPublic: boolean,
    category: DocumentCategory | string,
    projectId?: string,
    submissionId?: string
  ): string {
    const parts = [isPublic ? 'public' : 'private', this.sanitizeSegment(category.toString())];
    if (projectId) parts.push('projects', this.sanitizeSegment(projectId));
    if (submissionId) parts.push('submissions', this.sanitizeSegment(submissionId));
    return parts.join('/');
  }

  /**
   * Store an uploaded file on local disk under UPLOAD_PATH.
   * Public files land in uploads/public (served statically);
   * everything else lands in uploads/private (authenticated download only).
   */
  async uploadFile(
    file: Express.Multer.File,
    category: DocumentCategory | string,
    _uploadedBy: string,
    projectId?: string,
    submissionId?: string,
    isPublic: boolean = false
  ): Promise<UploadResult> {
    const fileName = `${crypto.randomUUID()}${this.extensionFor(file.mimetype, file.originalname)}`;
    const folder = this.buildFolder(isPublic, category, projectId, submissionId);
    const absoluteDir = path.resolve(uploadRoot, folder);
    if (!absoluteDir.startsWith(uploadRoot + path.sep)) {
      throw new Error('Invalid upload path');
    }
    await ensureDir(absoluteDir);

    const relativePath = `${folder}/${fileName}`;
    await fs.writeFile(path.join(absoluteDir, fileName), file.buffer);

    return {
      fileName,
      originalName: file.originalname,
      filePath: relativePath,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Resolve a stored relative file path to an absolute path,
   * guarding against directory traversal.
   */
  resolvePath(filePath: string): string {
    const absolute = path.resolve(uploadRoot, filePath);
    if (!absolute.startsWith(uploadRoot + path.sep) && absolute !== uploadRoot) {
      throw new Error('Invalid file path');
    }
    return absolute;
  }

  async deleteFile(filePath: string): Promise<void> {
    const absolute = this.resolvePath(filePath);
    await fs.unlink(absolute).catch(() => undefined);
  }

  /**
   * Validate file type and size.
   */
  validateFile(file: Express.Multer.File, maxSize: number = 10485760): { valid: boolean; error?: string } {
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
      };
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
      'video/mp4',
      'video/avi',
      'video/quicktime'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'File type not allowed'
      };
    }

    return { valid: true };
  }
}

export const fileUploadService = new FileUploadService();
