import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyzeRoutes.js';
import { initializeKnowledgeBase } from './services/knowledgeBaseService.js';

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  'https://legalallyai.vercel.app',
  'http://localhost:5173'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', analyzeRoutes);

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    initializeKnowledgeBase();
});