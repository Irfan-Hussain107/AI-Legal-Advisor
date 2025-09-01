import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export const extractText = async (file) => {
    if (file.mimetype === 'application/pdf') {
        const data = await pdf(file.buffer);
        return data.text;
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const { value } = await mammoth.extractRawText({ buffer: file.buffer });
        return value;
    } else {
        throw new Error('Unsupported file type');
    }
};