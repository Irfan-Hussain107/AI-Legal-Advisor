import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export const analyzeDocumentApi = async (file, mode, userPrompt) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('mode', mode);
    formData.append('userPrompt', userPrompt);

    try {
        const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading and analyzing document:', error);
        throw error.response?.data?.error || 'An unknown error occurred';
    }
};

export const chatWithDocumentApi = async (question, history) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/chat`, {
            question,
            history
        });
        return response.data;
    } catch (error) {
        console.error('Error chatting with document:', error);
        throw error.response?.data?.error || 'An unknown error occurred';
    }
};