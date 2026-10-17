import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const testUploadDir = path.join(os.tmpdir(), `gpt-uploads-test-${process.pid}`);

jest.mock('../../../config', () => ({
  config: {
    uploadPath: testUploadDir,
    maxFileSize: 10485760,
  },
}));

import { fileUploadService } from '../../../services/fileUploadService';

describe('FileUploadService', () => {
  const mockFile = {
    originalname: 'test-document.pdf',
    mimetype: 'application/pdf',
    size: 1024000,
    buffer: Buffer.from('test file content')
  } as Express.Multer.File;

  afterAll(async () => {
    await fs.rm(testUploadDir, { recursive: true, force: true });
  });

  describe('validateFile', () => {
    it('should validate file successfully', () => {
      const result = fileUploadService.validateFile(mockFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject file that is too large', () => {
      const largeFile = { ...mockFile, size: 20 * 1024 * 1024 };
      const result = fileUploadService.validateFile(largeFile, 10485760);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds maximum allowed size');
    });

    it('should reject unsupported file type', () => {
      const unsupportedFile = { ...mockFile, mimetype: 'application/x-executable' };
      const result = fileUploadService.validateFile(unsupportedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File type not allowed');
    });
  });

  describe('uploadFile', () => {
    it('should store file on disk and return a relative path', async () => {
      const result = await fileUploadService.uploadFile(
        mockFile,
        'REPORT' as any,
        'user-123',
        'project-123'
      );

      expect(result.originalName).toBe('test-document.pdf');
      expect(result.fileSize).toBe(mockFile.size);
      expect(result.mimeType).toBe(mockFile.mimetype);
      expect(result.filePath).toMatch(/^private\/report\/projects\/project-123\//);

      const absolute = fileUploadService.resolvePath(result.filePath);
      const content = await fs.readFile(absolute);
      expect(content.toString()).toBe('test file content');
    });

    it('should store public files under the public folder', async () => {
      const result = await fileUploadService.uploadFile(
        mockFile,
        'OTHER' as any,
        'user-123',
        undefined,
        undefined,
        true
      );
      expect(result.filePath).toMatch(/^public\//);
    });
  });

  describe('resolvePath', () => {
    it('should reject directory traversal', () => {
      expect(() => fileUploadService.resolvePath('../outside.txt')).toThrow('Invalid file path');
      expect(() => fileUploadService.resolvePath('../../etc/passwd')).toThrow('Invalid file path');
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      const result = await fileUploadService.uploadFile(mockFile, 'OTHER' as any, 'user-123');
      const absolute = fileUploadService.resolvePath(result.filePath);
      await fileUploadService.deleteFile(result.filePath);
      await expect(fs.access(absolute)).rejects.toThrow();
    });

    it('should not throw for a missing file', async () => {
      await expect(
        fileUploadService.deleteFile('private/other/does-not-exist.pdf')
      ).resolves.not.toThrow();
    });
  });
});
