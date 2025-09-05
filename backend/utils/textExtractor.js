import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isScannedPdf = (text) => {
    return !text || text.trim().length < 100;
};

// Create temp directory
const createTempDir = () => {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
};

// Try using Poppler's pdfimages or pdftoppm (if available)
const convertPdfWithPoppler = async (pdfBuffer) => {
    const tempDir = createTempDir();
    const pdfPath = path.join(tempDir, `input_${Date.now()}.pdf`);
    const outputPrefix = path.join(tempDir, `page_${Date.now()}`);
    
    try {
        // Write PDF to temp file
        fs.writeFileSync(pdfPath, pdfBuffer);
        
        // Try pdftoppm command (part of poppler-utils)
        await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`);
        
        // Find generated images
        const files = fs.readdirSync(tempDir);
        const imageFiles = files.filter(f => f.includes(path.basename(outputPrefix)) && f.endsWith('.png'));
        
        const images = [];
        for (const imageFile of imageFiles.slice(0, 15)) { // Limit to 15 pages
            const imagePath = path.join(tempDir, imageFile);
            const imageBuffer = fs.readFileSync(imagePath);
            images.push(imageBuffer);
            
            // Clean up
            try {
                fs.unlinkSync(imagePath);
            } catch (e) {}
        }
        
        // Clean up PDF
        try {
            fs.unlinkSync(pdfPath);
        } catch (e) {}
        
        return images;
    } catch (error) {
        console.log('Poppler pdftoppm not available:', error.message);
        
        // Clean up on error
        try {
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        } catch (e) {}
        
        return [];
    }
};

// Try using ImageMagick
const convertPdfWithImageMagick = async (pdfBuffer) => {
    const tempDir = createTempDir();
    const pdfPath = path.join(tempDir, `input_${Date.now()}.pdf`);
    
    try {
        // Write PDF to temp file
        fs.writeFileSync(pdfPath, pdfBuffer);
        
        const images = [];
        
        // Convert up to 15 pages
        for (let i = 0; i < 15; i++) {
            const outputPath = path.join(tempDir, `page_${Date.now()}_${i}.png`);
            
            try {
                // Use ImageMagick convert command
                await execAsync(`magick convert "${pdfPath}[${i}]" -density 150 -quality 100 "${outputPath}"`);
                
                if (fs.existsSync(outputPath)) {
                    const imageBuffer = fs.readFileSync(outputPath);
                    images.push(imageBuffer);
                    
                    // Clean up
                    try {
                        fs.unlinkSync(outputPath);
                    } catch (e) {}
                } else {
                    // No more pages
                    break;
                }
            } catch (pageError) {
                // No more pages or conversion failed
                break;
            }
        }
        
        // Clean up PDF
        try {
            fs.unlinkSync(pdfPath);
        } catch (e) {}
        
        return images;
    } catch (error) {
        console.log('ImageMagick convert not available:', error.message);
        
        // Clean up on error
        try {
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        } catch (e) {}
        
        return [];
    }
};

// Simple PDF text extraction using basic PDF.js (text only, no rendering)
const extractBasicPdfText = async (pdfBuffer) => {
    try {
        // Dynamic import to avoid issues
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            disableFontFace: true,
            disableStream: true,
            disableAutoFetch: true,
            useSystemFonts: false,
        });
        
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        let allText = '';
        
        for (let i = 1; i <= numPages; i++) {
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                allText += pageText + '\n';
            } catch (pageError) {
                console.warn(`Failed to extract text from page ${i}`);
            }
        }
        
        return { text: allText.trim(), numPages };
    } catch (error) {
        console.error('PDF.js text extraction failed:', error);
        return { text: '', numPages: 0 };
    }
};

// Perform OCR on image buffers
const performOCR = async (images) => {
    if (images.length === 0) {
        return '';
    }
    
    console.log(`Starting OCR on ${images.length} images...`);
    
    const worker = await createWorker('eng', 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
        }
    });
    
    let allText = '';
    
    for (let i = 0; i < images.length; i++) {
        try {
            console.log(`Processing image ${i + 1}/${images.length} with OCR...`);
            const { data } = await worker.recognize(images[i]);
            allText += `--- Page ${i + 1} ---\n${data.text}\n\n`;
        } catch (ocrError) {
            console.warn(`OCR failed for image ${i + 1}:`, ocrError.message);
            allText += `--- Page ${i + 1} ---\n[OCR failed for this page]\n\n`;
        }
    }
    
    await worker.terminate();
    console.log('OCR processing complete.');
    
    return allText;
};

// Main extraction function
export const extractText = async (file) => {
    try {
        console.log(`Processing file: ${file.originalname}, Type: ${file.mimetype}, Size: ${file.size} bytes`);

        // Handle image files
        if (file.mimetype.startsWith('image/')) {
            console.log('Image file detected. Starting OCR...');
            const worker = await createWorker('eng');
            const { data: { text } } = await worker.recognize(file.buffer);
            await worker.terminate();
            console.log('OCR extraction from image complete.');
            return text.trim() || 'No text could be extracted from this image.';
        }

        // Handle PDF files
        if (file.mimetype === 'application/pdf') {
            console.log('PDF file detected. Attempting text extraction...');
            
            // First try basic text extraction
            const { text: basicText, numPages } = await extractBasicPdfText(file.buffer);
            console.log(`Basic text extraction: ${basicText.length} characters from ${numPages} pages`);
            
            if (!isScannedPdf(basicText)) {
                console.log('PDF has extractable text. Using basic extraction.');
                return basicText;
            }
            
            console.log('PDF appears to be scanned. Attempting OCR with external tools...');
            
            // Try different conversion methods
            let images = [];
            
            // Method 1: Try Poppler pdftoppm
            console.log('Trying Poppler pdftoppm...');
            images = await convertPdfWithPoppler(file.buffer);
            
            // Method 2: If Poppler failed, try ImageMagick
            if (images.length === 0) {
                console.log('Trying ImageMagick convert...');
                images = await convertPdfWithImageMagick(file.buffer);
            }
            
            if (images.length === 0) {
                return basicText || `This PDF appears to be scanned but could not be processed for OCR. 
                
To enable OCR for scanned PDFs, please install one of these tools on your system:
1. Poppler utils: Contains pdftoppm command
   - Windows: Download from https://poppler.freedesktop.org/
   - Ubuntu/Debian: sudo apt-get install poppler-utils
   - macOS: brew install poppler

2. ImageMagick: Contains convert command  
   - Windows: Download from https://imagemagick.org/
   - Ubuntu/Debian: sudo apt-get install imagemagick
   - macOS: brew install imagemagick

Alternatively, you can upload individual pages as image files (PNG/JPG) for OCR processing.`;
            }
            
            // Perform OCR on converted images
            console.log(`Successfully converted ${images.length} pages to images. Starting OCR...`);
            const ocrText = await performOCR(images);
            
            // Combine basic text (if any) with OCR text
            const combinedText = (basicText + '\n\n' + ocrText).trim();
            return combinedText || 'No text could be extracted from this PDF.';
        }

        // Handle DOCX files
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log('DOCX file detected. Extracting text...');
            const { value } = await mammoth.extractRawText({ buffer: file.buffer });
            console.log('DOCX extraction complete.');
            return value.trim() || 'No text found in DOCX file.';
        }

        // Handle TXT files
        if (file.mimetype === 'text/plain') {
            console.log('TXT file detected. Extracting text...');
            const text = file.buffer.toString('utf8');
            console.log('TXT extraction complete.');
            return text.trim() || 'TXT file appears to be empty.';
        }

        throw new Error(`Unsupported file type: ${file.mimetype}`);

    } catch (error) {
        console.error('Text extraction failed:', error.message);
        throw error;
    }
};