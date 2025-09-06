import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import { createCanvas, Image } from 'canvas';
import sharp from 'sharp';

// Simple fix for the worker issue - just specify any valid string
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';

// A helper factory that mocks the browser's canvas creation for pdf.js
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

// Heuristic to determine if a PDF is scanned based on its text content
const isPdfScanned = (text) => {
    return !text || text.trim().length < 150;
};

// Fixed rendering that avoids the Image constructor issue
const renderPageToImage = async (page) => {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvasFactory = new NodeCanvasFactory();
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
    
    // Minimal render context - avoid all problematic options
    const renderContext = {
        canvasContext: context,
        viewport,
        canvasFactory
    };
    
    try {
        await page.render(renderContext).promise;
        return canvas.toBuffer('image/png');
    } catch (renderError) {
        console.warn('Page rendering failed:', renderError.message);
        // Create white canvas as fallback
        context.fillStyle = 'white';
        context.fillRect(0, 0, viewport.width, viewport.height);
        context.fillStyle = 'black';
        context.font = '20px Arial';
        context.fillText('Rendering failed', 50, viewport.height / 2);
        return canvas.toBuffer('image/png');
    }
};

// Performs OCR on an image buffer, with image optimization
const performOcrOnImage = async (imageBuffer) => {
    const worker = await createWorker('eng');
    const optimizedImage = await sharp(imageBuffer).greyscale().normalize().sharpen().toBuffer();
    const { data: { text } } = await worker.recognize(optimizedImage);
    await worker.terminate();
    return text;
};

export const extractText = (file) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { mimetype, buffer, originalname } = file;
            console.log(`📄 Processing: ${originalname}`);

            if (mimetype.startsWith('image/')) {
                console.log('🖼️  Image file detected, starting OCR...');
                const ocrText = await performOcrOnImage(buffer);
                console.log('✅ OCR extraction from image complete.');
                resolve(ocrText);
                return;
            }

            if (mimetype === 'application/pdf') {
                console.log('📑 PDF file detected. Checking for embedded text...');
                
                try {
                    const loadingTask = pdfjsLib.getDocument(new Uint8Array(buffer));
                    const pdf = await loadingTask.promise;
                    const numPages = pdf.numPages;
                    let embeddedText = '';

                    for (let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        embeddedText += textContent.items.map(item => item.str).join(' ');
                    }

                    if (!isPdfScanned(embeddedText)) {
                        console.log('✅ Standard text extraction successful.');
                        resolve(embeddedText);
                    } else {
                        console.log('📸 PDF appears to be scanned. Converting pages for OCR...');
                        let ocrText = '';
                        for (let i = 1; i <= numPages; i++) {
                            const page = await pdf.getPage(i);
                            const imageBuffer = await renderPageToImage(page);
                            const pageOcrText = await performOcrOnImage(imageBuffer);
                            ocrText += `--- Page ${i} ---\n${pageOcrText}\n\n`;
                        }
                        console.log('✅ PDF OCR extraction complete.');
                        resolve(ocrText);
                    }
                } catch (pdfError) {
                    console.error('PDF processing failed:', pdfError.message);
                    resolve(`Error: Could not process PDF - ${pdfError.message}`);
                }
                return;
            }

            if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                console.log('📝 DOCX file detected...');
                const { value } = await mammoth.extractRawText({ buffer });
                resolve(value);
            } else if (mimetype === 'text/plain') {
                console.log('📄 TXT file detected...');
                resolve(buffer.toString('utf8'));
            } else {
                reject(new Error(`Unsupported file type: ${mimetype}`));
            }
        } catch (error) {
            console.error('Text extraction failed:', error);
            reject(error);
        }
    });
};