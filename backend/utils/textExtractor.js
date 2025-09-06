import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import { fileURLToPath } from 'url';

const execFilePromise = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTextSparse = (text) => {
  if (!text) return true;
  const trimmedText = text.trim();
  const meaningfulChars = trimmedText.replace(/[\s\n\r\t\u00A0\u2000-\u200B\u2028-\u2029]/g, '').length;
  return meaningfulChars < 50;
};

const performOcrOnImage = async (imageBuffer, pageNum, originalname = '') => {
  if (!imageBuffer || imageBuffer.length === 0) {
    console.warn(`[OCR] Empty image buffer for page ${pageNum}`);
    return '';
  }

  console.log(`[OCR] Starting OCR for page ${pageNum}...`);
  let worker = null;

  try {
    const optimizedImageBuffer = await sharp(imageBuffer)
      .resize({ 
        width: 2480,
        height: 3508, 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.2 })
      .modulate({ brightness: 1.1, contrast: 1.2 })
      .png({ quality: 100, compressionLevel: 0 })
      .toBuffer();

    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR-Page-${pageNum}] Progress: ${(m.progress * 100).toFixed(1)}%`);
        }
      },
    });

    await worker.setParameters({
      tessedit_pageseg_mode: '1',
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '',
      tessedit_ocr_engine_mode: '1',
    });

    const { data: { text, confidence } } = await worker.recognize(optimizedImageBuffer);
    
    console.log(`[OCR] Page ${pageNum} completed. Text length: ${text.length}, Confidence: ${confidence.toFixed(2)}%`);
    
    return text || `[No text found on page ${pageNum}]`;
    
  } catch (error) {
    console.error(`[OCR] Failed for page ${pageNum}: ${error.message}`);
    return `[OCR Error on page ${pageNum}: ${error.message}]`;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn(`[OCR] Worker cleanup failed: ${e.message}`);
      }
    }
  }
};

const extractTextWithPdftotext = async (buffer) => {
  const tempPdfPath = `./temp_pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
  let extractedText = '';
  
  try {
    await fs.writeFile(tempPdfPath, buffer);
    const { stdout } = await execFilePromise(
      'pdftotext',
      ['-raw', '-enc', 'UTF-8', '-eol', 'unix', tempPdfPath, '-'],
      { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }
    );
    extractedText = stdout;
    console.log(`[pdftotext] Extraction successful. Length: ${extractedText.length} chars`);
  } catch (error) {
    console.warn(`[pdftotext] Failed: ${error.message}`);
  } finally {
    try {
      await fs.unlink(tempPdfPath);
    } catch (cleanupError) {
      console.warn(`[pdftotext] Cleanup failed: ${cleanupError.message}`);
    }
  }
  return extractedText;
};

const convertPdfToImages = async (buffer, originalname) => {
  const tempPdfPath = `./temp_pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
  const outputDir = `./temp_images_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await fs.writeFile(tempPdfPath, buffer);
    
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log(`[PDF to Images] Converting PDF to images using pdftoppm...`);
    
    await execFilePromise(
      'pdftoppm',
      [
        '-png',           
        '-r', '200',      
        tempPdfPath,      
        path.join(outputDir, 'page') 
      ],
      { maxBuffer: 100 * 1024 * 1024, timeout: 180000 }
    );
    
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(file => file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    
    console.log(`[PDF to Images] Converted ${imageFiles.length} pages to images`);
    
    const imageBuffers = [];
    for (const imageFile of imageFiles) {
      const imagePath = path.join(outputDir, imageFile);
      const imageBuffer = await fs.readFile(imagePath);
      imageBuffers.push(imageBuffer);
    }
    
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.unlink(tempPdfPath);
    
    return imageBuffers;
    
  } catch (error) {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.unlink(tempPdfPath);
    } catch (cleanupError) {
      console.warn(`[PDF to Images] Cleanup failed: ${cleanupError.message}`);
    }
    
    throw new Error(`PDF to images conversion failed: ${error.message}`);
  }
};

const convertPdfToImagesImageMagick = async (buffer, originalname) => {
  const tempPdfPath = `./temp_pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
  const outputDir = `./temp_images_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await fs.writeFile(tempPdfPath, buffer);
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log(`[PDF to Images] Converting PDF using ImageMagick...`);
    
    await execFilePromise(
      'convert',
      [
        '-density', '200',           
        '-quality', '100',           
        tempPdfPath,                 
        path.join(outputDir, 'page-%03d.png') 
      ],
      { maxBuffer: 100 * 1024 * 1024, timeout: 180000 }
    );
    
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(file => file.endsWith('.png'))
      .sort();
    
    console.log(`[PDF to Images] ImageMagick converted ${imageFiles.length} pages`);
    
    const imageBuffers = [];
    for (const imageFile of imageFiles) {
      const imagePath = path.join(outputDir, imageFile);
      const imageBuffer = await fs.readFile(imagePath);
      imageBuffers.push(imageBuffer);
    }
    
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.unlink(tempPdfPath);
    
    return imageBuffers;
    
  } catch (error) {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.unlink(tempPdfPath);
    } catch {}
    
    throw new Error(`ImageMagick PDF conversion failed: ${error.message}`);
  }
};

const processPdfWithOcr = async (buffer, originalname) => {
  console.log(`[PDF Processing] Starting PDF processing for: ${originalname}`);
  
  try {
    const pdftotextOutput = await extractTextWithPdftotext(buffer);
    if (!isTextSparse(pdftotextOutput)) {
      console.log(`[PDF Processing] pdftotext successful, using extracted text`);
      return pdftotextOutput;
    }

    console.log(`[PDF Processing] pdftotext output sparse, falling back to OCR`);

    let imageBuffers = [];
    
    try {
      imageBuffers = await convertPdfToImages(buffer, originalname);
    } catch (pdftoppmError) {
      console.warn(`[PDF Processing] pdftoppm failed, trying ImageMagick: ${pdftoppmError.message}`);
      try {
        imageBuffers = await convertPdfToImagesImageMagick(buffer, originalname);
      } catch (imageMagickError) {
        throw new Error(`Both pdftoppm and ImageMagick failed. pdftoppm: ${pdftoppmError.message}, ImageMagick: ${imageMagickError.message}`);
      }
    }
    
    if (imageBuffers.length === 0) {
      throw new Error('No images were generated from PDF');
    }
    
    console.log(`[PDF Processing] Generated ${imageBuffers.length} images from PDF`);

    let fullText = '';
    
    for (let i = 0; i < imageBuffers.length; i++) {
      const pageNum = i + 1;
      console.log(`[PDF Processing] Processing page ${pageNum}/${imageBuffers.length}`);
      
      try {
        const textContent = await performOcrOnImage(imageBuffers[i], pageNum, originalname);
        fullText += `\n--- Page ${pageNum} ---\n${textContent}\n`;
        
        if (pageNum % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (pageError) {
        console.error(`[PDF Processing] Failed to process page ${pageNum}: ${pageError.message}`);
        fullText += `\n--- Page ${pageNum} ---\n[Error processing page: ${pageError.message}]\n`;
      }
    }

    console.log(`[PDF Processing] Completed. Total text length: ${fullText.length}`);
    return fullText;

  } catch (error) {
    console.error(`[PDF Processing] Fatal error: ${error.message}`);
    throw new Error(`PDF processing failed: ${error.message}`);
  }
};

export const extractText = async (file) => {
  try {
    const { buffer, originalname, mimetype: fileMimetype } = file;
    const fileType = await fileTypeFromBuffer(buffer);
    const mimetype = fileType ? fileType.mime : fileMimetype;

    console.log(`📄 Processing: ${originalname} (MIME: ${mimetype}, Size: ${buffer.length} bytes)`);

    if (mimetype && mimetype.startsWith('image/')) {
      console.log(`[Main] Processing image file`);
      const ocrText = await performOcrOnImage(buffer, 1, originalname);
      return ocrText;
    }

    if (mimetype === 'application/pdf') {
      console.log(`[Main] Processing PDF file`);
      return await processPdfWithOcr(buffer, originalname);
    }

    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log(`[Main] Processing Word document`);
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }

    if (mimetype === 'text/plain') {
      console.log(`[Main] Processing text file`);
      return buffer.toString('utf8');
    }

    throw new Error(`Unsupported file type: ${mimetype || 'unknown'}`);
    
  } catch (error) {
    console.error(`[Text Extraction] Error processing file: ${error.message}`);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
};