import * as dotenv from 'dotenv';
dotenv.config();
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

let knowledgeBaseStore;
let documentStore;

const embeddings = new GoogleGenerativeAIEmbeddings({ 
    apiKey: process.env.GEMINI_API_KEY,
    model: "embedding-001" 
});

const getTextSizeInBytes = (text) => {
    return Buffer.byteLength(text, 'utf8');
};

export const chunkText = (text, maxChunkSize = 15000, overlap = 300) => {
    if (!text || typeof text !== 'string') {
        console.warn('Invalid text input for chunking');
        return [''];
    }
    
    if (text.length <= maxChunkSize) {
        const byteSize = getTextSizeInBytes(text);
        if (byteSize <= 30000) { 
            return [text];
        }
    }

    console.log(`Chunking text: ${text.length} characters → ${maxChunkSize} max per chunk`);
    
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + maxChunkSize;
        
        if (endIndex < text.length) {
            const pageBreak = text.lastIndexOf('--- Page', endIndex);
            if (pageBreak > startIndex + maxChunkSize * 0.5) {
                endIndex = pageBreak;
            } else {
                const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
                if (paragraphBreak > startIndex + maxChunkSize * 0.7) {
                    endIndex = paragraphBreak + 2;
                } else {
                    const sentenceBreak = text.lastIndexOf('. ', endIndex);
                    if (sentenceBreak > startIndex + maxChunkSize * 0.8) {
                        endIndex = sentenceBreak + 2;
                    }
                }
            }
        }

        let chunk = text.slice(startIndex, endIndex).trim();
        
        let byteSize = getTextSizeInBytes(chunk);
        while (byteSize > 30000 && chunk.length > 1000) {
            const reduceBy = Math.ceil(chunk.length * 0.1);
            chunk = chunk.slice(0, -reduceBy).trim();
            byteSize = getTextSizeInBytes(chunk);
        }

        if (chunk.length > 0 && byteSize <= 30000) {
            chunks.push(chunk);
            console.log(`   Chunk ${chunks.length}: ${chunk.length} characters (${(byteSize/1024).toFixed(1)}KB)`);
        } else if (byteSize > 30000) {
            console.warn(`   Skipped oversized chunk: ${(byteSize/1024).toFixed(1)}KB`);
        }

        startIndex = endIndex - overlap;
        if (startIndex >= endIndex) {
            startIndex = endIndex;
        }
    }

    console.log(`Created ${chunks.length} chunks`);
    return chunks.length > 0 ? chunks : [''];
};

export async function initializeKnowledgeBase() {
    if (knowledgeBaseStore) {
        console.log("Knowledge base already initialized.");
        return;
    }
        
    try {
        console.log("Initializing knowledge base...");
        
        const loader = new JSONLoader('./data/knowledge_base.json');
        const docs = await loader.load();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunkedDocs = await textSplitter.splitDocuments(docs);
                
        knowledgeBaseStore = await MemoryVectorStore.fromDocuments(chunkedDocs, embeddings);
        console.log("Knowledge base initialized successfully");
        
    } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
        throw error;
    }
}

export async function initializeDocumentStore() {
    if (!documentStore) {
        console.log("Initializing document store...");
        documentStore = new MemoryVectorStore(embeddings);
        console.log("Document store initialized");
    }
    return documentStore;
}

export async function addDocumentToStore(documentText, metadata = {}) {
    try {
        if (!documentStore) {
            await initializeDocumentStore();
        }

        if (!documentText || typeof documentText !== 'string') {
            throw new Error('Invalid document text provided');
        }

        const textSizeKB = getTextSizeInBytes(documentText) / 1024;
        console.log(`Document size: ${textSizeKB.toFixed(2)} KB`);
        
        if (textSizeKB > 15) {
            console.log("Large document detected, chunking...");
            
            const chunks = chunkText(documentText, 15000, 200);
            
            if (chunks.length === 0) {
                throw new Error('Document chunking failed - no valid chunks created');
            }
            
            const documents = chunks.map((chunk, index) => ({
                pageContent: chunk,
                metadata: {
                    ...metadata,
                    source: metadata.source || `document_chunk_${index + 1}`,
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    chunkSize: chunk.length,
                    chunkSizeKB: (getTextSizeInBytes(chunk) / 1024).toFixed(2),
                    originalSize: textSizeKB
                }
            }));
            
            console.log(`Adding ${documents.length} chunks to vector store...`);
            
            const batchSize = 1; 
            let processed = 0;
            let errors = 0;
            
            for (let i = 0; i < documents.length; i++) {
                try {
                    const doc = documents[i];
                    const docByteSize = getTextSizeInBytes(doc.pageContent);
                    
                    if (docByteSize > 30000) {
                        console.warn(`Skipping chunk ${i + 1}: too large (${(docByteSize/1024).toFixed(1)}KB)`);
                        errors++;
                        continue;
                    }
                    
                    await documentStore.addDocuments([doc]);
                    processed++;
                    console.log(`   Processed ${processed}/${documents.length} chunks`);
                    
                    if (i < documents.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    
                } catch (batchError) {
                    console.error(`Failed chunk ${i + 1}:`, batchError.message);
                    errors++;
                    
                    if (batchError.message.includes('payload') || batchError.message.includes('bytes')) {
                        try {
                            const smallerChunk = documents[i].pageContent.substring(0, 10000);
                            if (getTextSizeInBytes(smallerChunk) <= 25000) {
                                await documentStore.addDocuments([{
                                    ...documents[i],
                                    pageContent: smallerChunk,
                                    metadata: {
                                        ...documents[i].metadata,
                                        reduced: true
                                    }
                                }]);
                                processed++;
                                errors--;
                                console.log(`   Recovered with smaller chunk ${i + 1}`);
                            }
                        } catch (recoveryError) {
                            console.error(`   Recovery failed for chunk ${i + 1}:`, recoveryError.message);
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            return {
                success: processed > 0,
                message: `Document processed: ${processed}/${chunks.length} chunks successful`,
                chunksProcessed: processed,
                totalChunks: chunks.length,
                originalSize: textSizeKB,
                errors: errors
            };
            
        } else {
            console.log("Processing as single document...");
            
            const docByteSize = getTextSizeInBytes(documentText);
            if (docByteSize > 30000) {
                throw new Error(`Document too large: ${(docByteSize/1024).toFixed(1)}KB exceeds 30KB limit`);
            }
            
            const document = {
                pageContent: documentText,
                metadata: {
                    ...metadata,
                    source: metadata.source || 'single_document',
                    size: textSizeKB,
                    sizeKB: textSizeKB.toFixed(2),
                    chunked: false
                }
            };
            
            await documentStore.addDocuments([document]);
            
            return {
                success: true,
                message: 'Document processed successfully',
                chunksProcessed: 1,
                totalChunks: 1,
                originalSize: textSizeKB
            };
        }
        
    } catch (error) {
        console.error('Failed to add document to store:', error);
        
        if (error.message.includes('payload') || error.message.includes('bytes') || error.message.includes('36000')) {
            console.log("Attempting recovery with micro-chunks...");
            try {
                return await addDocumentWithMicroChunks(documentText, metadata);
            } catch (fallbackError) {
                throw new Error(`Document too large for processing: ${fallbackError.message}`);
            }
        }
        
        throw error;
    }
}

const addDocumentWithMicroChunks = async (documentText, metadata = {}) => {
    try {
        const chunks = chunkText(documentText, 8000, 50); 
        console.log(`Using micro-chunks: ${chunks.length} pieces`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < chunks.length; i++) {
            try {
                const chunk = chunks[i];
                if (!chunk || chunk.trim().length === 0) {
                    continue;
                }
                
                const byteSize = getTextSizeInBytes(chunk);
                if (byteSize > 25000) {
                    console.warn(`Skipping micro-chunk ${i + 1}: still too large (${(byteSize/1024).toFixed(1)}KB)`);
                    failCount++;
                    continue;
                }
                
                const document = {
                    pageContent: chunk,
                    metadata: {
                        ...metadata,
                        source: `micro_chunk_${i + 1}`,
                        chunkIndex: i,
                        totalChunks: chunks.length,
                        chunkSize: chunk.length,
                        microChunk: true
                    }
                };
                
                await documentStore.addDocuments([document]);
                successCount++;
                console.log(`   Micro-chunk ${i + 1}/${chunks.length} (${(byteSize/1024).toFixed(1)}KB)`);
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (chunkError) {
                failCount++;
                console.error(`Failed micro-chunk ${i + 1}:`, chunkError.message);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        return {
            success: successCount > 0,
            message: `Processed ${successCount}/${chunks.length} micro-chunks`,
            chunksProcessed: successCount,
            totalChunks: chunks.length,
            failed: failCount
        };
        
    } catch (error) {
        console.error('Micro-chunk processing failed:', error);
        throw error;
    }
};

// Query functions with improved error handling
export async function queryKnowledgeBase(query, k = 3) {
    if (!knowledgeBaseStore) {
        throw new Error("Knowledge base is not initialized.");
    }
    
    try {
        const queryByteSize = getTextSizeInBytes(query);
        if (queryByteSize > 30000) {
            console.warn(`Query too large (${(queryByteSize/1024).toFixed(1)}KB), truncating...`);
            query = query.substring(0, 15000);
        }
        
        return await knowledgeBaseStore.similaritySearch(query, k);
    } catch (error) {
        console.error('Knowledge base query failed:', error);
        return [];
    }
}

export async function queryDocumentStore(query, k = 5) {
    if (!documentStore) {
        throw new Error("Document store is not initialized.");
    }
    
    try {
        const queryByteSize = getTextSizeInBytes(query);
        if (queryByteSize > 30000) {
            console.warn(`Query too large (${(queryByteSize/1024).toFixed(1)}KB), truncating...`);
            query = query.substring(0, 15000);
        }
        
        return await documentStore.similaritySearch(query, k);
    } catch (error) {
        console.error('Document store query failed:', error);
        return [];
    }
}

export function getStoreStats() {
    return {
        knowledgeBaseInitialized: !!knowledgeBaseStore,
        documentStoreInitialized: !!documentStore,
        timestamp: new Date().toISOString()
    };
}