import React, { useState, useEffect, useRef } from 'react';

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

const HomePage = ({ activeMode, setActiveMode, setUploadedDocument }) => {
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  // Scroll reveal effect
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedDocument({
          name: file.name,
          content: e.target.result
        });
      };
      reader.onerror = () => {
        alert('Error reading file. Please try again.');
      };
      reader.readAsText(file);
    }
  };

  const handleTextAnalysis = () => {
    if (textAreaRef.current) {
      const text = textAreaRef.current.value.trim();
      if (text) {
        setUploadedDocument({
          name: 'Pasted Text',
          content: text
        });
      } else {
        alert('Please enter some text to analyze.');
      }
    }
  };

  return (
    <section className="page animated-content">
      <div className="container">
        <div className="scroll-reveal">
          <h1>
            Analyze Legal Documents with AI
          </h1>
          <p>
            Upload a document or paste text to identify risks, get summaries, and receive suggestions instantly.
          </p>
        </div>

        {/* Mode selector */}
        <div className="scroll-reveal">
          <ModeSelector activeMode={activeMode} setActiveMode={setActiveMode} />
        </div>

        <div className="input-options">
          <div className="option-card animated-card interactive-hover">
            <h2>Upload Document</h2>
            <div className="upload-area">
              <p>Drag & drop your file here or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.doc,.docx,.pdf"
                onChange={handleFileUpload}
              />
              <button
                className="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </button>
            </div>
          </div>

          <div className="option-card animated-card interactive-hover">
            <h2>Paste Text</h2>
            <textarea
              ref={textAreaRef}
              placeholder="Paste your legal text here..."
            />
            <button
              className="button"
              onClick={handleTextAnalysis}
            >
              Analyze Text
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomePage;