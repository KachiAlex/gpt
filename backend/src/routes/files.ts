import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';
import { DocumentCategory } from '../types/domain';
import { authenticate, AuthUser } from '../middleware/auth';
import { fileUploadService } from '../services/fileUploadService';
import { documentRepository } from '../repositories/documentRepository';
import { contractorRepository } from '../repositories/contractorRepository';
import { query } from '../config/database';
import { CreateDocumentInput, DbDocument } from '../types/models';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize
  }
});

const verifyToken = authenticate;

type DocumentWithUrl = DbDocument & { downloadURL?: string };

const normalizeId = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const getFirstString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
};

const withDownloadUrl = (document: DbDocument): DocumentWithUrl => ({
  ...document,
  downloadURL: `/api/files/download/${document.id}`,
});

const GOV_ROLES = new Set(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']);

/**
 * Read access to a document: public docs are readable by any authenticated
 * user; private docs are limited to the uploader, government/M&E staff, or
 * the contractor assigned to the document's project/submission.
 */
const canAccessDocument = async (user: AuthUser, document: DbDocument): Promise<boolean> => {
  if (document.isPublic) return true;
  if (document.uploadedBy === user.userId) return true;
  if (GOV_ROLES.has(user.role)) return true;
  if (user.role !== 'CONTRACTOR') return false;
  const contractor = await contractorRepository.findByUserId(user.userId);
  if (!contractor) return false;
  if (document.projectId) {
    const r = await query(
      'SELECT 1 FROM projects WHERE id = $1 AND contractor_id = $2',
      [document.projectId, contractor.id]
    );
    if (r.rows.length > 0) return true;
  }
  if (document.submissionId) {
    const r = await query(
      'SELECT 1 FROM submissions WHERE id = $1 AND contractor_id = $2',
      [document.submissionId, contractor.id]
    );
    if (r.rows.length > 0) return true;
  }
  return false;
};

/** Can this user list documents attached to a project? */
const canAccessProjectDocs = async (user: AuthUser, projectId: string): Promise<boolean> => {
  if (GOV_ROLES.has(user.role)) return true;
  if (user.role !== 'CONTRACTOR') return false;
  const contractor = await contractorRepository.findByUserId(user.userId);
  if (!contractor) return false;
  const r = await query(
    'SELECT 1 FROM projects WHERE id = $1 AND contractor_id = $2',
    [projectId, contractor.id]
  );
  return r.rows.length > 0;
};

/** Can this user list documents attached to a submission? */
const canAccessSubmissionDocs = async (user: AuthUser, submissionId: string): Promise<boolean> => {
  if (GOV_ROLES.has(user.role)) return true;
  if (user.role !== 'CONTRACTOR') return false;
  const contractor = await contractorRepository.findByUserId(user.userId);
  if (!contractor) return false;
  const r = await query(
    'SELECT 1 FROM submissions WHERE id = $1 AND contractor_id = $2',
    [submissionId, contractor.id]
  );
  return r.rows.length > 0;
};

// Keep submissions.media_count in step with the documents table.
const incrementMediaCount = (submissionId: string | null) =>
  submissionId
    ? query('UPDATE submissions SET media_count = media_count + 1 WHERE id = $1', [submissionId])
    : Promise.resolve();

const decrementMediaCount = (submissionId: string | null) =>
  submissionId
    ? query('UPDATE submissions SET media_count = GREATEST(media_count - 1, 0) WHERE id = $1', [submissionId])
    : Promise.resolve();

// Write-side authorization: gov staff and the owning contractor may attach
// files to a project/submission; PUBLIC accounts can't upload at all.
const canWriteToTarget = async (
  user: AuthUser,
  projectId: string | null,
  submissionId: string | null,
): Promise<boolean> => {
  if (!GOV_ROLES.has(user.role) && user.role !== 'CONTRACTOR') return false;
  if (submissionId && !(await canAccessSubmissionDocs(user, submissionId))) return false;
  if (projectId && !(await canAccessProjectDocs(user, projectId))) return false;
  return true;
};

/**
 * POST /api/files/upload
 * Upload a single file
 */
router.post('/upload', verifyToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const { category, projectId, submissionId } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'File category is required'
      });
    }
    if (!Object.values(DocumentCategory).includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file category'
      });
    }

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user context'
      });
    }

    const normalizedProjectId = normalizeId(projectId);
    const normalizedSubmissionId = normalizeId(submissionId);

    if (!(await canWriteToTarget(req.user, normalizedProjectId, normalizedSubmissionId))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload to this project or submission'
      });
    }

    // Validate file
    const validation = fileUploadService.validateFile(req.file, config.maxFileSize);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error ?? 'Invalid file upload'
      });
    }

    // Upload file
    const uploadResult = await fileUploadService.uploadFile(
      req.file,
      category as DocumentCategory,
      req.user.userId,
      normalizedProjectId ?? undefined,
      normalizedSubmissionId ?? undefined
    );

    const documentData: CreateDocumentInput = {
      projectId: normalizedProjectId,
      submissionId: normalizedSubmissionId,
      fileName: uploadResult.fileName,
      originalName: uploadResult.originalName,
      filePath: uploadResult.filePath,
      fileSize: uploadResult.fileSize,
      mimeType: uploadResult.mimeType,
      category,
      uploadedBy: req.user.userId,
      isPublic: false,
    };

    const document = await documentRepository.create(documentData);
    await incrementMediaCount(normalizedSubmissionId);

    return res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        document: withDownloadUrl(document)
      }
    });

  } catch (error: any) {
    console.error('File upload error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file'
    });
  }
});

/**
 * POST /api/files/upload-multiple
 * Upload multiple files
 */
router.post('/upload-multiple', verifyToken, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { category, projectId, submissionId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'File category is required'
      });
    }
    if (!Object.values(DocumentCategory).includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file category'
      });
    }

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user context'
      });
    }

    const normalizedProjectId = normalizeId(projectId);
    const normalizedSubmissionId = normalizeId(submissionId);

    if (!(await canWriteToTarget(req.user, normalizedProjectId, normalizedSubmissionId))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload to this project or submission'
      });
    }

    const uploadResults: DocumentWithUrl[] = [];
    const errors: { fileName: string; error: string }[] = [];

    for (const file of files) {
      try {
        // Validate file
        const validation = fileUploadService.validateFile(file, config.maxFileSize);
        if (!validation.valid) {
          errors.push({
            fileName: file.originalname,
            error: validation.error ?? 'Invalid file upload'
          });
          continue;
        }

        // Upload file
        const uploadResult = await fileUploadService.uploadFile(
          file,
          category as DocumentCategory,
          req.user.userId,
          normalizedProjectId ?? undefined,
          normalizedSubmissionId ?? undefined
        );

        const documentData: CreateDocumentInput = {
          projectId: normalizedProjectId,
          submissionId: normalizedSubmissionId,
          fileName: uploadResult.fileName,
          originalName: uploadResult.originalName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          category,
          uploadedBy: req.user.userId,
          isPublic: false,
        };

        const document = await documentRepository.create(documentData);
        await incrementMediaCount(normalizedSubmissionId);

        uploadResults.push(withDownloadUrl(document));

      } catch (error: any) {
        errors.push({
          fileName: file.originalname,
          error: error?.message ?? 'Unknown upload error'
        });
      }
    }

    return res.json({
      success: true,
      message: `Uploaded ${uploadResults.length} files successfully`,
      data: {
        documents: uploadResults,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error: any) {
    console.error('Multiple file upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload files'
    });
  }
});

/**
 * GET /api/files/:id
 * Get file information
 */
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await documentRepository.findById(id);

    if (!document || !(await canAccessDocument(req.user!, document))) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    return res.json({
      success: true,
      data: {
        document: withDownloadUrl(document)
      }
    });

  } catch (error: any) {
    console.error('Get file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get file information'
    });
  }
});

/**
 * DELETE /api/files/:id
 * Delete file
 */
router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await documentRepository.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user has permission to delete (uploader or admin)
    if (document.uploadedBy !== req.user?.userId && req.user?.role !== 'GOVERNMENT_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this file'
      });
    }

    // Delete file from storage
    await fileUploadService.deleteFile(document.filePath);

    // Delete document record from Postgres
    await documentRepository.delete(id);
    await decrementMediaCount(document.submissionId ?? null);

    return res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

/**
 * GET /api/files/project/:projectId
 * Get all files for a project
 */
router.get('/project/:projectId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { category } = req.query;

    if (!(await canAccessProjectDocs(req.user!, projectId))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view files for this project'
      });
    }

    const categoryFilter = getFirstString(category);
    const documents = await documentRepository.listByProject(projectId, categoryFilter);

    const documentsWithUrls = documents.map(withDownloadUrl);

    return res.json({
      success: true,
      data: {
        documents: documentsWithUrls
      }
    });

  } catch (error: any) {
    console.error('Get project files error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get project files'
    });
  }
});

/**
 * GET /api/files/submission/:submissionId
 * Get all files for a submission
 */
router.get('/submission/:submissionId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (!(await canAccessSubmissionDocs(req.user!, submissionId))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view files for this submission'
      });
    }

    const documents = await documentRepository.listBySubmission(submissionId);

    const documentsWithUrls = documents.map(withDownloadUrl);

    return res.json({
      success: true,
      data: {
        documents: documentsWithUrls
      }
    });

  } catch (error: any) {
    console.error('Get submission files error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submission files'
    });
  }
});

/**
 * GET /api/files/download/:id
 * Download a file. The JWT must arrive via the Authorization header —
 * query-parameter tokens were removed so they can't leak into logs.
 */
router.get('/download/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await documentRepository.findById(id);
    if (!document || !(await canAccessDocument(req.user!, document))) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const absolutePath = fileUploadService.resolvePath(document.filePath);
    return res.download(absolutePath, document.originalName);

  } catch (error: any) {
    console.error('Download file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

export default router;
