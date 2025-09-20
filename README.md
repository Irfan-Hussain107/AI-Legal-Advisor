# ⚖️ LegalAlly AI  
**Your Intelligent Partner for Demystifying Legal Documents**  

🔗 **Live Demo:** [https://legalallyai.vercel.app](https://legalallyai.vercel.app)

---

## 📖 About The Project  
LegalAlly AI is a full-stack web application designed to make legal documents understandable for everyone. It leverages the power of **Google's Gemini models** to analyze complex contracts, agreements, and notices, transforming dense legal jargon into clear, actionable intelligence.  

The platform solves the critical problem of **legal inaccessibility**, providing users with an instant, affordable, and insightful review of their documents. This empowers individuals and businesses to identify risks and make informed decisions without the need for expensive, time-consuming legal consultations.  

---

## ✨ Core Features  

- 🤖 **Instant AI Analysis**: Get a comprehensive summary and risk assessment of your legal documents in seconds.  
- 📂 **Multi-Format Support**: Upload and analyze PDFs, DOCX, TXT, and even image files like JPG & PNG.  
- 📸 **OCR for Scanned Documents**: Tesseract-based OCR pipeline extracts text from scanned or photo-based documents.  
- 📊 **Risk Assessment**: Clauses are automatically color-coded as **Low, Medium, or High risk**.  
- 💡 **Actionable Guidance**: Clear explanations and practical suggestions for improvement.  
- 💬 **Interactive Chatbot**: Ask your document-specific questions with a **RAG-powered chatbot**.  
- 🖱️ **Click-to-Highlight**: Instantly locate and highlight risk clauses within the original document preview.  
- 📷 **Camera Capture**: Snap photos of physical documents and combine them into a single PDF for analysis.  

---

## 🛠️ Technology Stack  

**Frontend**  
- React.js (Vite)  
- Axios  
- react-pdf  
- jspdf  

**Backend**  
- Node.js  
- Express.js  

**AI & Embeddings**  
- Google Gemini API (`gemini-1.5-flash`, `embedding-001`)  
- LangChain.js  

**OCR Pipeline**  
- Tesseract  
- Poppler  
- ImageMagick  
- Ghostscript  

**Deployment**  
- Vercel (Frontend)  
- Render (Backend via Docker)  

**Monitoring**  
- UptimeRobot  

---

## 🚀 Getting Started (Local Setup)  

### ✅ Prerequisites  
Make sure you have the following installed:  
- Node.js (v18 or higher)  
- Git  
- OCR Dependencies  

#### Install OCR Dependencies
```bash
# Windows (via Chocolatey in Admin PowerShell)
choco install poppler imagemagick tesseract-ocr ghostscript git nodejs

# macOS (via Homebrew)
brew install poppler imagemagick ghostscript tesseract

# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install -y poppler-utils imagemagick tesseract-ocr ghostscript git nodejs npm


# Clone the repository
git clone https://github.com/your-username/legal-ally-ai.git
cd legal-ally-ai

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Set up environment variables inside backend/.env
echo "GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE" > .env

# Build the knowledge base (one-time setup)
node backend/scripts/createKnowledgeBase.js

# Start Backend Server (Terminal 1)
cd backend
npm start

# Start Frontend Development Server (Terminal 2)
cd frontend
npm run dev


# Frontend → Vercel (static Vite app)
# VITE_API_BASE_URL is set to the live backend URL.

# Backend → Render (Dockerized service)
# Installs OCR dependencies via Dockerfile.
# GEMINI_API_KEY stored as a secret environment variable.
