import { GoogleGenAI } from "@google/genai";
import { queryKnowledgeBase } from './knowledgeBaseService.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeTransactionalDocument(documentText, optionalUserPrompt, mode) {
    
    const relevantIdealClauses = await queryKnowledgeBase(documentText, 5);
    const contextFromKB = relevantIdealClauses.map(doc => doc.pageContent).join('\n\n---\n\n');

    const modeInstruction = mode === 'simple'
        ? "Explain everything in simple, plain English."
        : "Provide a detailed, technical analysis.";

    const userPromptInstruction = optionalUserPrompt
        ? `The user has a specific focus: '${optionalUserPrompt}'`
        : "";

    const systemInstruction = `
        You are LegalAlly, an AI expert in analyzing Indian transactional legal documents.
        Analyze the user's document by comparing it against the provided 'Ideal Clauses Context'.
        ${modeInstruction}
        ${userPromptInstruction}

        Ideal Clauses Context:
        ${contextFromKB}

        Analyze the user's document below. Respond ONLY with a valid JSON object.
        The JSON object must follow this structure:
        {
          "summary": { "simple": "...", "professional": "..." },
          "overallRisk": "Low | Medium | High",
          "originalText": "The full original document text.",
          "clauses": [ { "clauseText": "...", "risk": "...", "explanation": "...", "suggestion": "..." } ]
        }
        
        CRITICAL: You must respond with a single, complete, and valid JSON object containing the summary, overallRisk, and clauses fields. Do not truncate the response.
    `;

    let retries = 3;
    while (retries > 0) {
        try {
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: documentText }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                },
                config: {
                    systemInstruction: systemInstruction,
                },
            });

            const responseText = result.text;
            
            let cleanedJsonString = responseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .replace(/^\s*[\r\n]+/gm, '') 
                .trim();

            try {
                const parsedResult = JSON.parse(cleanedJsonString);
                
                parsedResult.originalText = documentText;
                
                if (!parsedResult.summary || !parsedResult.overallRisk || !parsedResult.clauses) {
                    throw new Error("Missing required fields in response");
                }

                return parsedResult;
                
            } catch (jsonError) {
                console.error("JSON Parse Error:", jsonError);
                console.error("Raw Response:", responseText.substring(0, 500));
                
                
                cleanedJsonString = cleanedJsonString
                    .replace(/([^\\])"/g, '$1\\"') 
                    .replace(/\n/g, '\\n') 
                    .replace(/\r/g, '\\r') 
                    .replace(/\t/g, '\\t'); 
                
                try {
                    const parsedResult = JSON.parse(cleanedJsonString);
                    parsedResult.originalText = documentText;
                    return parsedResult;
                } catch (secondError) {
                    throw new Error(`JSON parsing failed: ${secondError.message}`);
                }
            }

        } catch (error) {
            if (error.status === 503 && retries > 1) {
                console.log(`Model is overloaded. Retrying in ${4 - retries} seconds...`);
                await delay((4 - retries) * 1000);
                retries--;
            } else {
                console.error("Error during Gemini API call:", error);
                
                if (retries > 1) {
                    console.log("Retrying with simplified prompt...");
                    retries--;
                } else {
                    throw new Error("Failed to analyze the document after multiple attempts.");
                }
            }
        }
    }
}