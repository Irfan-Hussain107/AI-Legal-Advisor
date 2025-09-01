import { extractText } from '../utils/textExtractor.js';
import { analyzeTransactionalDocument } from '../services/analysisService.js';

export const handleAnalysis = async (req, res) => {
    try {
        // req.file is from multer, req.body has the other form fields
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded.' });
        }

        const { mode, userPrompt } = req.body;
        
        // 1. Extract text from the uploaded document
        const documentText = await extractText(req.file);

        // 2. Call our powerful analysis service
        const analysisResult = await analyzeTransactionalDocument(documentText, userPrompt, mode);

        // 3. Send the structured JSON result back to the frontend
        res.json(analysisResult);

    } catch (error) {
        console.error('Analysis pipeline error:', error);
        res.status(500).json({ error: 'An error occurred during analysis.' });
    }
};