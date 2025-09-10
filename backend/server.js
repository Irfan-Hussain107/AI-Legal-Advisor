import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyzeRoutes.js';
import { initializeKnowledgeBase } from './services/knowledgeBaseService.js';

const app = express();
const PORT = process.env.PORT || 5001;

const corsOptions = {
  origin: 'https://legalallyai.vercel.app',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

app.use('/api', analyzeRoutes);

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    initializeKnowledgeBase();
});