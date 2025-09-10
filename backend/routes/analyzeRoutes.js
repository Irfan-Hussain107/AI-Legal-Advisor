import express from 'express';
import multer from 'multer';
import { handleAnalysis, handleChat, getAnalysisStatus, handleStatusCheck } from '../controllers/analyzeControllers.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/analyze', upload.single('document'), handleAnalysis);
router.post('/chat', handleChat);
router.get('/status', getAnalysisStatus);

router.get('/status-check', handleStatusCheck);

export default router;