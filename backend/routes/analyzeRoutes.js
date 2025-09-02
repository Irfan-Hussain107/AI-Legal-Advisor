import express from 'express';
import multer from 'multer';
import { handleAnalysis, handleChat } from '../controllers/analyzeControllers.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/analyze', upload.single('document'), handleAnalysis);
router.post('/chat', handleChat);

export default router;