import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { chatWithDocumentApi } from '../services/api.js';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const ModeSelector = ({ activeMode, setActiveMode }) => {
    return (
        <div className="settings-card animated-card">
            <h3>Analysis Mode</h3>
            <div className="mode-selector">
                <button
                    className={`mode-btn ${activeMode === 'simple' ? 'active' : ''}`}
                    onClick={() => setActiveMode('simple')}
                >Simple Mode</button>
                <button
                    className={`mode-btn ${activeMode === 'pro' ? 'active' : ''}`}
                    onClick={() => setActiveMode('pro')}
                >Professional Mode</button>
            </div>
        </div>
    );
};

const ClauseCard = ({ clause, onCardClick, index }) => {
    const riskColorClass = `risk-text-${clause.risk.toLowerCase()}`;
    return (
        <div className="risk-card animated-card-item interactive-hover" onClick={() => onCardClick(clause, index)}>
            <div className="clause-content">
                <h4>Original Text (Risk: <span className={riskColorClass}>{clause.risk}</span>)</h4>
                <p className="original-text"><em>"{clause.clauseText}"</em></p>
                <h4>Explanation:</h4>
                <p>{clause.explanation}</p>
                <h4>Suggestion:</h4>
                <p className="suggestion">{clause.suggestion}</p>
            </div>
        </div>
    );
};

const DashboardPage = ({ activeMode, setActiveMode, analysisResult, fileData }) => {
    const [activeTab, setActiveTab] = useState('summary');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isBotReplying, setIsBotReplying] = useState(false);
    const [numPages, setNumPages] = useState(null);
    const [highlightedPage, setHighlightedPage] = useState({ page: null, risk: '' });
    const [imageUrl, setImageUrl] = useState(null);
    const [highlightedClause, setHighlightedClause] = useState(null);
    const [processedTextContent, setProcessedTextContent] = useState('');
    const pdfContainerRef = useRef(null);

    useEffect(() => {
        if (analysisResult) {
            setChatMessages([{ type: 'bot', message: 'Hello! You can now ask me any questions about your document.' }]);
        }

        if (fileData?.file?.type?.startsWith('image/')) {
            const url = URL.createObjectURL(fileData.file);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setImageUrl(null);

    }, [analysisResult, fileData]);

    useEffect(() => {
        if (analysisResult?.originalText) {
            setProcessedTextContent(analysisResult.originalText);
        }
    }, [analysisResult]);

    const highlightClauseInText = (clauseText, risk, clauseIdx) => {
        const textContainer = document.querySelector('.text-preview-container pre');
        if (!textContainer) return;

        const existingHighlights = textContainer.querySelectorAll('.clause-highlight');
        existingHighlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });

        const textContent = textContainer.textContent;
        const foundIndex = textContent.indexOf(clauseText);
        
        if (foundIndex !== -1) {
            const beforeText = textContent.substring(0, foundIndex);
            const afterText = textContent.substring(foundIndex + clauseText.length);
            
            const highlightSpan = document.createElement('span');
            highlightSpan.className = `clause-highlight clause-highlight-${risk.toLowerCase()}`;
            highlightSpan.textContent = clauseText;
            highlightSpan.id = `clause-${clauseIdx}`;
            
            textContainer.innerHTML = '';
            textContainer.appendChild(document.createTextNode(beforeText));
            textContainer.appendChild(highlightSpan);
            textContainer.appendChild(document.createTextNode(afterText));
            
            highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setHighlightedClause(clauseIdx);
            
            setTimeout(() => {
                if (highlightSpan.parentNode) {
                    const parent = highlightSpan.parentNode;
                    parent.replaceChild(document.createTextNode(highlightSpan.textContent), highlightSpan);
                    parent.normalize();
                }
                setHighlightedClause(null);
            }, 3000);
        }
    };

    const highlightClauseInPDF = (clauseText, risk, clauseIdx) => {
        if (!analysisResult?.pdfTextData?.pageTexts) return;

        let targetPage = -1;
        for (let i = 0; i < analysisResult.pdfTextData.pageTexts.length; i++) {
            if (analysisResult.pdfTextData.pageTexts[i].includes(clauseText)) {
                targetPage = i + 1;
                break;
            }
        }

        if (targetPage > 0) {
            const pageElement = pdfContainerRef.current?.querySelector(`.react-pdf__Page[data-page-number="${targetPage}"]`);
            if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                pageElement.style.outline = `3px solid var(--risk-${risk.toLowerCase()}-color, #ff9800)`;
                pageElement.style.outlineOffset = '5px';
                
                setHighlightedPage({ page: targetPage, risk: risk.toLowerCase() });
                
                setTimeout(() => {
                    pageElement.style.outline = 'none';
                    pageElement.style.outlineOffset = '0';
                    setHighlightedPage({ page: null, risk: '' });
                }, 3000);
            }
        }
    };
   
    const handleClauseCardClick = (clause, clauseIdx) => {
        const isPDF = fileData?.file && (fileData.file.type === 'application/pdf' || fileData.name?.endsWith('.pdf'));
        const isTextDocument = !isPDF && !imageUrl;

        if (isTextDocument) {
            highlightClauseInText(clause.clauseText, clause.risk, clauseIdx);
        } else if (isPDF) {
            highlightClauseInPDF(clause.clauseText, clause.risk, clauseIdx);
        }
    };

    const handleSendMessage = async () => {
        if (chatInput.trim() && !isBotReplying) {
            const userMessage = { type: 'user', message: chatInput };
            const newMessages = [...chatMessages, userMessage];
            setChatMessages(newMessages);
            const question = chatInput;
            setChatInput('');
            setIsBotReplying(true);

            try {
                const chatHistory = newMessages.map(msg => ({
                    role: msg.type === 'bot' ? 'model' : 'user',
                    parts: [{ text: msg.message }]
                }));
                const botResponse = await chatWithDocumentApi(question, chatHistory);
                setChatMessages(prev => [...prev, { type: 'bot', message: botResponse.responseText }]);
            } catch (error) {
                setChatMessages(prev => [...prev, { type: 'bot', message: 'Sorry, I encountered an error. Please try again.' }]);
            } finally {
                setIsBotReplying(false);
            }
        }
    };

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    const renderSummary = () => {
        if (!analysisResult) return <p>Analysis data is not available. Please go to the Home page to analyze a document.</p>;
        const summaryText = activeMode === 'simple' ? analysisResult.summary.simple : analysisResult.summary.professional;
        return (
            <div className="animated-content">
                <div className="risk-card animated-card-item">
                    <h4>Overall Document Summary</h4>
                    <p>{summaryText}</p>
                    <hr style={{margin: '20px 0', borderColor: 'var(--border-color)'}}/>
                    <h4>Overall Risk Assessment: <span className={`risk-text-${analysisResult.overallRisk?.toLowerCase()}`}>{analysisResult.overallRisk}</span></h4>
                </div>
                <h3 style={{marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px'}}>Key Clauses Analysis</h3>
                {analysisResult.clauses.map((clause, index) => (
                    <ClauseCard key={index} clause={clause} onCardClick={handleClauseCardClick} index={index} />
                ))}
            </div>
        );
    };

const renderChatbot = () => {
    const messagesEndRef = useRef(null);

    // Scroll to bottom whenever chatMessages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    return (
        <div className="chat-layout">
            <div className="chat-container">
                {chatMessages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.type}`}>
                        {msg.message}
                    </div>
                ))}
                {/* invisible anchor to scroll to */}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a question about your document..."
                />
                <button className="mic-button" onClick={() => console.log("Mic clicked!")}>
                    🎤
                </button>
                <button onClick={handleSendMessage} className="send-button" disabled={isBotReplying}>
                    ➤
                </button>
            </div>
        </div>
    );
};


    const renderComparison = () => (
         <div className="animated-content comparison-section">
            <h3 className="text-center">Feature Coming Soon</h3>
            <p className="text-center">The side-by-side document comparison feature is currently in development.</p>
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'chatbot': return renderChatbot();
            case 'comparison': return renderComparison();
            case 'summary':
            default: return renderSummary();
        }
    };

    return (
        <section className="page animated-content">
            <div className="container p-0">
                
                <ModeSelector activeMode={activeMode} setActiveMode={setActiveMode} />
                <div className="dashboard-layout">
                    <div className="panel left-panel">
                        <h3 className="document-title">Original Document: {fileData?.name}</h3>
                        <div className="document-content-wrapper" ref={pdfContainerRef}>
                            <div className="document-content">
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={fileData.name}
                                        className="image-preview"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                ) : fileData?.file && (fileData.file.type === 'application/pdf' || fileData.name.endsWith('.pdf')) ? (
                                    <Document file={fileData.file} onLoadSuccess={onDocumentLoadSuccess}>
                                        {Array.from(new Array(numPages || 0), (el, index) => (
                                            <Page
                                                key={`page_${index + 1}`}
                                                pageNumber={index + 1}
                                                className={highlightedPage.page === (index + 1) ? `page-highlight-${highlightedPage.risk}` : ''}
                                            />
                                        ))}
                                    </Document>
                                ) : analysisResult?.originalText ? (
                                    <div className="text-preview-container">
                                        <pre>{processedTextContent}</pre>
                                    </div>
                                ) : (
                                    <div className="text-center"><p>No document preview available.</p></div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="panel right-panel">
                        <div className="tabs">
                            <button className={`tab-link ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Analysis</button>
                            <button className={`tab-link ${activeTab === 'chatbot' ? 'active' : ''}`} onClick={() => setActiveTab('chatbot')}>Chatbot</button>
                            <button className={`tab-link ${activeTab === 'comparison' ? 'active' : ''}`} onClick={() => setActiveTab('comparison')}>Comparison</button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {renderTabContent()}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DashboardPage;