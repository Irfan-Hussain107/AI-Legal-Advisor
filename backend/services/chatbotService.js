import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY });

export async function createDocumentIndex(documentText) {
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 150,
    });
    const docs = await textSplitter.createDocuments([documentText]);

    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    console.log("Enhanced vector store created");
    return vectorStore;
}

function extractConversationContext(history, maxMessages = 4) {
    if (!history || history.length === 0) return "";
    
    const recentHistory = history.slice(-maxMessages);
    let context = "";
    
    recentHistory.forEach((msg, index) => {
        const content = msg.parts[0]?.text || '';
        if (content.trim()) {
            if (msg.role === 'user') {
                context += `Previous question: ${content}\n`;
            } else {
                context += `Previous answer: ${content.substring(0, 150)}...\n`;
            }
        }
    });
    
    return context;
}

function enhanceQueryForRAG(originalQuery, conversationContext) {
    const contextualWords = ['that', 'this', 'it', 'above', 'previous', 'earlier', 'before'];
    const hasContextualReference = contextualWords.some(word => 
        originalQuery.toLowerCase().includes(word)
    );
    
    if (hasContextualReference && conversationContext) {
        return `${conversationContext}\n\nCurrent question: ${originalQuery}`;
    }
    
    return originalQuery;
}

export async function handleChatMessage(question, history, vectorStore, analysisResult = null) {
    try {
        const conversationContext = extractConversationContext(history);
        const enhancedQuery = enhanceQueryForRAG(question, conversationContext);
        
        const searchResults = await vectorStore.similaritySearch(enhancedQuery, 4);
        const documentContext = searchResults.map((doc, index) => 
            `[Context ${index + 1}]: ${doc.pageContent}`
        ).join('\n\n');

        const conversationHistory = [
            ...history.slice(-6),
            { role: 'user', parts: [{ text: question }] }
        ];

        const systemPrompt = `You are a legal document analysis assistant. Your role is to help users understand their legal documents clearly and practically.

Key Guidelines:
1. Answer based ONLY on the provided document context
2. Be direct and helpful - avoid mentioning limitations unless absolutely necessary  
3. Reference specific parts of the document when relevant
4. Use simple, clear language for explanations
5. If you need to connect to previous conversation, do so naturally
6. Focus on actionable insights and practical advice
7. Do no use any special characters like **__-- without any reason 

Document Context:
${documentContext}

${analysisResult ? `
Analysis Summary:
- Risk Level: ${analysisResult.overallRisk}
- Key Issues: ${analysisResult.clauses?.length || 0} clauses flagged
- Document Type: Legal contract/agreement
` : ''}

Respond conversationally and helpfully. Only if you absolutely cannot find any relevant information in the document, then briefly mention this and offer general legal guidance if possible.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: conversationHistory,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1000,
            },
            config: {
                systemInstruction: systemPrompt,
            }
        });

        const responseText =
           (response?.response && typeof response.response.text === 'function'
             ? response.response.text()
             : response?.text) || '';
        
        const sanitize = (s) => s.replace(/\*\*(.*?)\*\*/g, '$1')   // remove bold
             .replace(/__(.*?)__/g, '$1')       // remove underline-like
             .replace(/--+/g, '-')              // collapse long dashes
             .trim();
        
        const cleanText = sanitize(responseText);
         if (!responseText) {
           throw new Error('Empty response from model');
         }
        
        const updatedHistory = [
            ...conversationHistory,
            { role: 'model', parts: [{ text: responseText }] }
        ];

        return { 
            responseText: cleanText, 
            updatedHistory: updatedHistory.slice(-8)
        };

    } catch(error) {
        console.error("Chatbot error:", error);
        
        if (error.message?.includes('quota')) {
            throw new Error("Service temporarily unavailable. Please try again in a moment.");
        } else if (error.message?.includes('network')) {
            throw new Error("Connection issue. Please check your internet and try again.");
        } else {
            throw new Error("Unable to process your question right now. Please try rephrasing or try again.");
        }
    }
}