import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryKnowledgeBase, addDocumentToStore, initializeDocumentStore } from './knowledgeBaseService.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const cleanJsonResponse = (responseText) => {
    if (!responseText) {
        throw new Error('Empty response received');
    }
    
    let cleaned = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*[\r\n]+/gm, '')
        .trim();
    
    cleaned = cleaned
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') 
        .replace(/\\/g, '\\\\') 
        .replace(/"/g, '\\"') 
        .replace(/\\"/g, '"') 
        .replace(/\\\\/g, '\\'); 
    
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    
    return cleaned;
};

const createSafeAnalysisResult = (documentText, errorMessage = '') => {
    return {
        summary: {
            simple: errorMessage ? `Analysis incomplete: ${errorMessage}` : "Document analysis completed with limited results",
            professional: errorMessage ? `Technical limitations prevented full analysis: ${errorMessage}` : "Legal document analysis performed with basic structure identification"
        },
        overallRisk: "Medium",
        originalText: documentText || '',
        clauses: [{
            clauseText: "Analysis incomplete",
            risk: "Medium",
            explanation: errorMessage || "Technical issues prevented detailed clause analysis",
            suggestion: "Please try again with a smaller document or consult legal counsel for manual review"
        }]
    };
};

export async function processDocumentForAnalysis(documentText, filename) {
    try {
        console.log("Processing document for analysis...");
        
        if (!documentText || typeof documentText !== 'string') {
            throw new Error('Invalid document text provided for processing');
        }
        
        if (documentText.trim().length === 0) {
            console.warn("Document appears to be empty");
            return {
                success: false,
                message: 'Document is empty',
                chunksProcessed: 0,
                totalChunks: 0,
                originalSize: 0
            };
        }
        
        await initializeDocumentStore();
        
        const result = await addDocumentToStore(documentText, {
            source: filename || 'uploaded_document',
            uploadedAt: new Date().toISOString(),
            type: 'user_document'
        });
        
        console.log("Document processing result:", result);
        return result;
        
    } catch (error) {
        console.error("Document processing failed:", error);
        throw error;
    }
}

export async function analyzeTransactionalDocument(documentText, optionalUserPrompt, mode) {
    try {
        console.log("Starting document analysis...");
        console.log(`Document length: ${documentText.length} characters`);
        
        if (!documentText || typeof documentText !== 'string') {
            throw new Error('Invalid document text provided for analysis');
        }
        
        if (documentText.trim().length < 50) {
            console.warn("Document seems too short for meaningful analysis");
            return createSafeAnalysisResult(documentText, "Document too short for analysis");
        }
        
        try {
            await processDocumentForAnalysis(documentText, 'analysis_document');
        } catch (procError) {
            console.warn("Document processing failed, continuing with analysis:", procError.message);
        }
        
        let contextFromKB = '';
        try {
            const relevantIdealClauses = await queryKnowledgeBase(
                documentText.substring(0, 1000), 
                3 // Reduce number of results
            );
            contextFromKB = relevantIdealClauses
                .map(doc => doc.pageContent)
                .join('\n---\n')
                .substring(0, 2000); 
        } catch (kbError) {
            console.warn('Knowledge base query failed:', kbError.message);
            contextFromKB = '';
        }

        const modeInstruction = mode === 'simple'
            ? "Use simple, clear language that anyone can understand. Avoid legal jargon."
            : "Provide detailed analysis with appropriate legal terminology.";

        const userPromptInstruction = optionalUserPrompt
            ? `User focus: "${optionalUserPrompt}". Address this specifically.`
            : "";

        const maxAnalysisLength = 25000; 
        let analysisText = documentText;
        
        if (documentText.length > maxAnalysisLength) {
            console.log(`Document truncated for analysis: ${documentText.length} -> ${maxAnalysisLength} chars`);
            analysisText = documentText.substring(0, maxAnalysisLength) + 
                         "\n\n[Document truncated for analysis]";
        }

        const prompt = `Analyze this legal document and respond with a valid JSON object.

${modeInstruction}
${userPromptInstruction}
${contextFromKB ? `Reference context: ${contextFromKB}` : ''}

Required JSON structure:
{
  "summary": { 
    "simple": "Brief summary in plain English", 
    "professional": "Detailed professional summary" 
  },
  "overallRisk": "Low|Medium|High",
  "clauses": [
    {
      "clauseText": "Exact clause text from document",
      "risk": "Low|Medium|High",
      "explanation": "What this clause means",
      "suggestion": "Recommendation for improvement"
    }
  ]
}

Document to analyze:
${analysisText}`;

        let retries = 3;
        let lastError = '';
        
        while (retries > 0) {
            try {
                console.log(`Calling Gemini API (${4 - retries}/3 attempts)...`);
                
                const model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash", 
                    generationConfig: {
                        temperature: 0.1,
                        topP: 0.8,
                        topK: 40,
                        maxOutputTokens: 4096,
                    },
                });

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                if (!responseText || responseText.trim().length === 0) {
                    throw new Error('Empty response from Gemini API');
                }

                console.log("Received response, parsing JSON...");
                
                try {
                    const cleanedJson = cleanJsonResponse(responseText);
                    const parsedResult = JSON.parse(cleanedJson);

                    if (!parsedResult.summary) {
                        parsedResult.summary = {
                            simple: "Document analysis completed",
                            professional: "Legal document analysis performed"
                        };
                    }
                    
                    if (!parsedResult.overallRisk || !['Low', 'Medium', 'High'].includes(parsedResult.overallRisk)) {
                        parsedResult.overallRisk = 'Medium';
                    }
                    
                    if (!parsedResult.clauses || !Array.isArray(parsedResult.clauses)) {
                        parsedResult.clauses = [];
                    }

                    parsedResult.clauses = parsedResult.clauses.filter(clause => 
                        clause && 
                        typeof clause === 'object' && 
                        clause.clauseText && 
                        clause.risk && 
                        clause.explanation
                    ).map(clause => ({
                        clauseText: String(clause.clauseText).substring(0, 500),
                        risk: ['Low', 'Medium', 'High'].includes(clause.risk) ? clause.risk : 'Medium',
                        explanation: String(clause.explanation || 'Analysis provided').substring(0, 300),
                        suggestion: String(clause.suggestion || 'Review recommended').substring(0, 300)
                    }));

                    parsedResult.originalText = documentText;

                    console.log("Analysis completed successfully");
                    return parsedResult;

                } catch (jsonError) {
                    console.error("JSON Parse Error:", jsonError.message);
                    console.error("Response preview:", responseText.substring(0, 200));
                    lastError = `JSON parsing failed: ${jsonError.message}`;
                    
                    if (retries === 1) {
                        try {
                            const fallbackResult = createSafeAnalysisResult(documentText, lastError);
                            
                            const summaryMatch = responseText.match(/"simple":\s*"([^"]+)"/);
                            if (summaryMatch) {
                                fallbackResult.summary.simple = summaryMatch[1];
                            }
                            
                            return fallbackResult;
                        } catch (fallbackError) {
                            console.error("Fallback extraction failed:", fallbackError);
                        }
                    }
                }

            } catch (error) {
                console.error(`Analysis attempt ${4 - retries} failed:`, error.message);
                lastError = error.message;
                
                if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
                    console.log("Content safety issue, trying with sanitized text...");
                    analysisText = analysisText
                        .replace(/[^\w\s.,;:()\-'"]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                } else if (error.message.includes('quota') || error.message.includes('rate')) {
                    const waitTime = (4 - retries) * 2000;
                    console.log(`Rate limit hit, waiting ${waitTime}ms...`);
                    await delay(waitTime);
                } else if (error.message.includes('payload') || error.message.includes('too large')) {
                    analysisText = analysisText.substring(0, analysisText.length * 0.7);
                    console.log(`Reducing text size to ${analysisText.length} characters`);
                }
                
                retries--;
                
                if (retries > 0) {
                    await delay(1000);
                } else {
                    console.error("All analysis attempts failed");
                    return createSafeAnalysisResult(documentText, lastError);
                }
            }
        }

        return createSafeAnalysisResult(documentText, 'Analysis failed after all attempts');

    } catch (error) {
        console.error("Document analysis failed:", error);
        return createSafeAnalysisResult(documentText || '', error.message);
    }
}

export function getAnalysisStats() {
    return {
        timestamp: new Date().toISOString(),
        service: 'analysis',
        status: 'active'
    };
}