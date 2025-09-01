import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyzeRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Main API Route
app.use('/api', analyzeRoutes);

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});