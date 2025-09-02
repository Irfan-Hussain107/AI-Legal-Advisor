import * as dotenv from 'dotenv';
dotenv.config();
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

let knowledgeBaseStore;
const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY });

export async function initializeKnowledgeBase() {
    if (knowledgeBaseStore) {
        console.log("Knowledge base already initialized.");
        return;
    }
    
    try {
        const loader = new JSONLoader('./data/knowledge_base.json');
        const docs = await loader.load();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunkedDocs = await textSplitter.splitDocuments(docs);
        
        knowledgeBaseStore = await MemoryVectorStore.fromDocuments(chunkedDocs, embeddings);
        console.log("In-memory knowledge base has been initialized.");
    } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
    }
}

export async function queryKnowledgeBase(query, k = 3) {
    if (!knowledgeBaseStore) {
        throw new Error("Knowledge base is not initialized.");
    }
    return await knowledgeBaseStore.similaritySearch(query, k);
}