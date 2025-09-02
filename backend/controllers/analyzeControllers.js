import { extractText } from '../utils/textExtractor.js';
import { analyzeTransactionalDocument } from '../services/analysisService.js';
import { createDocumentIndex, handleChatMessage } from '../services/chatbotService.js';

let documentVectorStore = null;
let currentAnalysisResult = null;

export const handleAnalysis = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded.' });
        }

        const { mode, userPrompt } = req.body;
        
        console.log('Starting document analysis...');
        const startTime = Date.now();
        
        const documentText = await extractText(req.file);
        console.log(`Text extraction completed in ${Date.now() - startTime}ms`);
        
        const vectorStorePromise = createDocumentIndex(documentText);
        
        const analysisResult = await analyzeTransactionalDocument(documentText, userPrompt, mode);
        console.log(`Analysis completed in ${Date.now() - startTime}ms`);
        
        documentVectorStore = await vectorStorePromise;
        currentAnalysisResult = analysisResult;
        
        console.log(`Total processing time: ${Date.now() - startTime}ms`);
        res.json(analysisResult);
        
    } catch (error) {
        console.error('Analysis pipeline error:', error);
        
        if (error.message?.includes('GEMINI_API_KEY')) {
            res.status(500).json({ error: 'API configuration error. Please check server settings.' });
        } else if (error.message?.includes('quota')) {
            res.status(429).json({ error: 'API quota exceeded. Please try again later.' });
        } else if (error.message?.includes('Unsupported file type')) {
            res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.' });
        } else {
            res.status(500).json({ error: 'An error occurred during analysis. Please try again.' });
        }
    }
};

export const handleChat = async (req, res) => {
    try {
        const { question, history } = req.body;
        
        if (!documentVectorStore) {
            return res.status(400).json({ 
                error: "Please analyze a document first to enable the chatbot." 
            });
        }

        if (!question || question.trim().length === 0) {
            return res.status(400).json({ 
                error: "Please provide a question." 
            });
        }

        console.log('Processing chat message...');
        const startTime = Date.now();
        
        const result = await handleChatMessage(
            question, 
            history, 
            documentVectorStore,
            currentAnalysisResult
        );
        
        console.log(`Chat response generated in ${Date.now() - startTime}ms`);
        res.json(result);
        
    } catch (error) {
        console.error('Chat pipeline error:', error);
        
        // Provide specific error messages
        if (error.message?.includes('quota')) {
            res.status(429).json({ error: 'API quota exceeded. Please try again later.' });
        } else if (error.message?.includes('network')) {
            res.status(503).json({ error: 'Network error. Please check your connection.' });
        } else {
            res.status(500).json({ error: 'An error occurred during the chat session. Please try again.' });
        }
    }
};

export const getAnalysisStatus = async (req, res) => {
    res.json({
        hasDocument: !!documentVectorStore,
        hasAnalysis: !!currentAnalysisResult,
        documentTitle: currentAnalysisResult?.documentType || null
    });
};