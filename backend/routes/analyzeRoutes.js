import express from 'express';
import multer from 'multer';
import { handleAnalysis } from '../controllers/analyzeController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// This defines the endpoint: POST /api/analyze
// It uses multer middleware to handle a single file upload with the field name 'document'
router.post('/analyze', upload.single('document'), handleAnalysis);

export default router;