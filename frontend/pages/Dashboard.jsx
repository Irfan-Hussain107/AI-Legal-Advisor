import React, { useState } from 'react';

const ModeSelector = ({ activeMode, setActiveMode }) => {
  const explanations = {
    simple: "<strong>Simple Mode:</strong> Provides clear, concise summaries and straightforward suggestions. Ideal for quick reviews.",
    pro: "<strong>Professional Mode:</strong> Offers in-depth analysis, detailed clause-by-clause explanations, and legal precedents. Suited for legal professionals."
  };

  return (
    <div className="settings-card animated-card">
      <h3 className="mb-0">Analysis Mode</h3>
      <p className="subtle-text">Select the level of detail for the analysis and suggestions.</p>
      <div className="mode-selector">
        <button
          className={`mode-btn ${activeMode === 'simple' ? 'active' : ''}`}
          onClick={() => setActiveMode('simple')}
        >
          Simple Mode
        </button>
        <button
          className={`mode-btn ${activeMode === 'pro' ? 'active' : ''}`}
          onClick={() => setActiveMode('pro')}
        >
          Professional Mode
        </button>
      </div>
      <div
        id="mode-explanation"
        dangerouslySetInnerHTML={{ __html: explanations[activeMode] }}
      />
    </div>
  );
};

const DashboardPage = ({ activeMode, setActiveMode, uploadedDocument }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [chatMessages, setChatMessages] = useState([
    { type: 'bot', message: 'Hello! How can I help you with this document?' },
    { type: 'user', message: 'What is the termination period?' },
    { type: 'bot', message: 'The agreement can be terminated by either party with a 90-day written notice.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      setChatMessages([...chatMessages, { type: 'user', message: chatInput }]);
      setChatInput('');
      // Simulate bot response
      setTimeout(() => {
        setChatMessages(prev => [...prev, { type: 'bot', message: 'I understand your question. Let me analyze the document for that information.' }]);
      }, 1000);
    }
  };

  const highlightRisks = (content) => {
    const riskKeywords = {
      'risk-high': ['liability', 'arbitration', 'indemnification', 'damages', 'governing law'],
      'risk-medium': ['termination', 'warranty', 'exclusivity', 'confidentiality', 'amendment'],
      'risk-low': ['payment', 'notice', 'renewal', 'scope of work', 'force majeure'],
    };

    let highlightedContent = content;
    for (const [riskClass, keywords] of Object.entries(riskKeywords)) {
      keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        highlightedContent = highlightedContent.replace(regex, `<span class="${riskClass}">$1</span>`);
      });
    }

    return highlightedContent;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chatbot':
        return (
          <div className="chat-layout">
            <div className="chat-container">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.type}`}>
                  {msg.message}
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message here..."
              />
              <button
                onClick={handleSendMessage}
                className="send-button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        );
      case 'comparison':
        return (
          <div className="animated-content comparison-section">
            <h3 className="text-center">Compare Two Documents</h3>
            <p className="text-center">Upload two documents to see a side-by-side comparison of their clauses and identify key differences.</p>
            <div className="comparison-inputs">
              <div className="upload-area small">
                <p>Upload Document 1</p>
                <input type="file" className="hidden" id="file-compare-1" />
                <button
                  className="button"
                  onClick={() => document.getElementById('file-compare-1')?.click()}
                >
                  Browse
                </button>
              </div>
              <div className="upload-area small">
                <p>Upload Document 2</p>
                <input type="file" className="hidden" id="file-compare-2" />
                <button
                  className="button"
                  onClick={() => document.getElementById('file-compare-2')?.click()}
                >
                  Browse
                </button>
              </div>
            </div>
            <button className="button w-full">
              Compare Documents
            </button>
          </div>
        );
      case 'summary':
      default:
        return (
          <div className="animated-content">
            <h3>Analysis Summary</h3>
            <div className="risk-card animated-card-item">
              <h4>Summary</h4>
              <p>This document is a standard Service Agreement outlining the terms for the provision of services. It includes clauses on payment, project scope, liability, and dispute resolution. The agreement appears to be low risk for standard business operations, with clear obligations for both parties. However, certain clauses, particularly those related to liability and termination, should be reviewed closely depending on your business needs.</p>
            </div>
            <div className="risk-card animated-card-item">
              <p className="p-0 mb-0 subtle-text">Document analysis complete. Use the chatbot to ask specific questions or compare with other documents using the comparison tool.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <section className="page animated-content">
      <div className="container p-0">
        <ModeSelector activeMode={activeMode} setActiveMode={setActiveMode} />
        <div className="dashboard-layout">
          <div className="panel left-panel">
            <h3 className="document-title">Original Document</h3>
            {uploadedDocument ? (
              <div className="document-content">
                <p className="text-center"><strong>{uploadedDocument.name}</strong></p>
                <pre dangerouslySetInnerHTML={{ __html: highlightRisks(uploadedDocument.content) }} />
              </div>
            ) : (
              <div className="document-content text-center">
                <p>No document uploaded yet. Please go to the Home page to upload a document or paste text for analysis.</p>
              </div>
            )}
          </div>

          <div className="panel right-panel">
            <div className="tabs">
              <button
                className={`tab-link ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                Summary
              </button>
              <button
                className={`tab-link ${activeTab === 'chatbot' ? 'active' : ''}`}
                onClick={() => setActiveTab('chatbot')}
              >
                Chatbot
              </button>
              <button
                className={`tab-link ${activeTab === 'comparison' ? 'active' : ''}`}
                onClick={() => setActiveTab('comparison')}
              >
                Comparison
              </button>
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