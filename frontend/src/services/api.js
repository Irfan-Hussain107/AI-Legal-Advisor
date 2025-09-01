import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export const analyzeDocumentApi = async (file, mode, userPrompt) => {
    // FormData is necessary for sending files
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
        return response.data; // This will be the structured JSON from your backend
    } catch (error) {
        // Handle errors gracefully
        console.error('Error uploading and analyzing document:', error);
        throw error.response?.data?.error || 'An unknown error occurred';
    }
};