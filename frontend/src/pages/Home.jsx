import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { analyzeDocumentApi } from '../services/api.js';
import toast from 'react-hot-toast';
import CameraModal from '../components/CameraModal.jsx';

const ModeSelector = ({ activeMode, setActiveMode }) => {
    const explanations = {
        simple: "<strong>Simple Mode:</strong> Provides clear, concise summaries and straightforward suggestions. Ideal for quick reviews.",
        pro: "<strong>Professional Mode:</strong> Offers in-depth analysis, detailed clause-by-clause explanations, and legal precedents. Suited for legal professionals."
    };

    return (
        <div className="settings-card animated-card">
            <h3>Analysis Mode</h3>
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

const HomePage = ({ activeMode, setActiveMode, setAnalysisResult, setIsLoading, setFileForDashboard }) => {
    const [file, setFile] = useState(null);
    const [userPrompt, setUserPrompt] = useState('');
    const [error, setError] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const textAreaRef = useRef(null);
    const fileInputRef = useRef(null);

    const onDrop = React.useCallback((acceptedFiles) => {
        setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: true,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt'],
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
        }
    });
    
    const handleAnalysis = async (sourceFile, sourceName) => {
        if (!sourceFile) {
            setError('Please provide a document or text to analyze.');
            toast.error('Please provide a document or text to analyze.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const result = await analyzeDocumentApi(sourceFile, activeMode, userPrompt);
            setFileForDashboard({file: sourceFile, name: sourceName});
            setAnalysisResult(result);
        } catch (err) {
            setAnalysisResult(null); 
            setFileForDashboard(null);
            setError(err.toString());
            toast.error('Analysis failed. The document might be encrypted or unreadable.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFileSubmit = () => {
        handleAnalysis(file, file.name);
    };

    const handleTextSubmit = () => {
        const textContent = textAreaRef.current.value;
        if (textContent.trim()) {
            const textFile = new File([textContent], "PastedText.txt", { type: "text/plain" });
            handleAnalysis(textFile, "Pasted Text");
        } else {
            setError('Please paste some text to analyze.');
            toast.error('Please paste some text to analyze.');
        }
    };

    return (
        <>
            {isCameraOpen && (
                <CameraModal 
                    onClose={() => setIsCameraOpen(false)}
                    onCaptureComplete={(capturedFile) => handleAnalysis(capturedFile, capturedFile.name)}
                />
            )}
            <section className="page animated-content">
                <div className="container">
                    <div>
                        <h1>Analyze Legal Documents with AI</h1>
                        <p>Upload a document or paste text to identify risks, get summaries, and receive suggestions instantly.</p>
                    </div>
                    
                    <div>
                        <ModeSelector activeMode={activeMode} setActiveMode={setActiveMode} />
                    </div>

                    <div className="input-options">
                        <div className="option-card animated-card interactive-hover">
                            <h2>Upload Document</h2>
                            <div {...getRootProps()} className={`upload-area ${isDragActive ? 'active' : ''}`}>
                                <input {...getInputProps()} ref={fileInputRef} />
                                <p>{file ? file.name : "Drag & drop files here"}</p>
                                <button className="button" type="button" onClick={() => fileInputRef.current.click()}>
                                    Browse Files
                                </button>
                            </div>
                            <button className="button" type="button" onClick={() => setIsCameraOpen(true)} style={{marginTop: '10px'}}>
                                Capture with Camera
                            </button>
                             <button className="button" style={{marginTop: '20px', width: '100%'}} onClick={handleFileSubmit} disabled={!file}>Analyze Uploaded File</button>
                        </div>
                        <div className="option-card animated-card interactive-hover">
                            <h2>Paste Text</h2>
                            <textarea ref={textAreaRef} placeholder="Paste your legal text here..." />
                            <button className="button" style={{width: '100%'}} onClick={handleTextSubmit}>Analyze Text</button>
                        </div>
                    </div>
                     {error && <p className="error-message" style={{color: 'red', marginTop: '20px'}}>{error}</p>}
                </div>
            </section>
        </>
    );
};

export default HomePage;