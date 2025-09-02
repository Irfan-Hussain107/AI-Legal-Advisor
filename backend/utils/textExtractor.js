import PDFParser from "pdf2json";
import mammoth from 'mammoth';

export const extractText = (file) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (file.mimetype === 'application/pdf') {
                const pdfParser = new PDFParser(this, 1);

                pdfParser.on("pdfParser_dataError", errData => {
                    reject(new Error(errData.parserError));
                });

                pdfParser.on("pdfParser_dataReady", () => {
                    const rawText = pdfParser.getRawTextContent();
                    resolve(rawText);
                });

                pdfParser.parseBuffer(file.buffer);

            } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const { value } = await mammoth.extractRawText({ buffer: file.buffer });
                resolve(value);
            } else if (file.mimetype === 'text/plain') {
                resolve(file.buffer.toString('utf8'));
            }
            else {
                reject(new Error('Unsupported file type'));
            }
        } catch (error) {
            reject(error);
        }
    });
};
