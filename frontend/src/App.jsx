import React, { useState, useEffect } from 'react';
import HomePage from './pages/Home.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import ProfilePage from './pages/Profile.jsx';
import './index.css';

const BackgroundEffects = () => {
    return (
        <div className="floating-particles">
            {[...Array(9)].map((_, i) => <div key={i} className="particle"></div>)}
        </div>
    );
};

const Header = ({ activePage, setActivePage }) => {
    const navItems = ['Home', 'Dashboard', 'Profile'];
    const [selectedLanguage, setSelectedLanguage] = useState('EN');
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
    
    const languages = [
    { code: 'EN', name: 'English' },
    { code: 'HI', name: 'हिन्दी' }, // Hindi
    { code: 'BN', name: 'বাংলা' }, // Bengali 
    { code: 'TA', name: 'தமிழ்' }, // Tamil
    { code: 'TE', name: 'తెలుగు' } // Telugu
];


    return (
        <header>
            <nav>
                <div className="logo">LegalAlly AI</div>
                
                <div className="nav-right">
                    <ul>
                        {navItems.map(item => (
                            <li key={item}>
                                <a
                                    href={`#${item.toLowerCase()}`}
                                    className={activePage === item.toLowerCase() ? 'active' : ''}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if(item.toLowerCase() === 'dashboard' && !sessionStorage.getItem('analysisResult')) {
                                            alert("Please analyze a document first to view the dashboard.");
                                            return;
                                        }
                                        setActivePage(item.toLowerCase());
                                    }}
                                >{item}</a>
                            </li>
                        ))}
                    </ul>
                    
                    {/* Clean Language Selector */}
                    <div className="language-selector" onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}>
                        <span className="current-lang">{selectedLanguage}</span>
                        <svg className="lang-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                        
                        {isLanguageDropdownOpen && (
                            <div className="lang-menu">
                                {languages.map(lang => (
                                    <div
                                        key={lang.code}
                                        className={`lang-item ${selectedLanguage === lang.code ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLanguage(lang.code);
                                            setIsLanguageDropdownOpen(false);
                                        }}
                                    >
                                        {lang.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="auth-buttons">
                        <a href="#signin" className="auth-link signin">Sign In/Register</a>
                    </div>
                </div>
            </nav>
        </header>
    );
};


function App() {
    const [activePage, setActivePage] = useState('home');
    const [activeMode, setActiveMode] = useState('simple');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [fileForDashboard, setFileForDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const savedResult = sessionStorage.getItem('analysisResult');
        const savedFile = sessionStorage.getItem('fileForDashboard');
        if (savedResult) {
            setAnalysisResult(JSON.parse(savedResult));
        }
        if (savedFile) {
            setFileForDashboard(JSON.parse(savedFile));
        }
    }, []);

    const handleSetAnalysisResult = (result) => {
        sessionStorage.setItem('analysisResult', JSON.stringify(result));
        setAnalysisResult(result);
        setActivePage('dashboard');
    };

    const handleSetFileForDashboard = (fileData) => {
        sessionStorage.setItem('fileForDashboard', JSON.stringify(fileData));
        setFileForDashboard(fileData);
    };

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return <DashboardPage
                    activeMode={activeMode}
                    setActiveMode={setActiveMode}
                    analysisResult={analysisResult}
                    fileData={fileForDashboard}
                />;
            case 'profile':
                return <ProfilePage />;
            case 'home':
            default:
                return <HomePage
                    activeMode={activeMode}
                    setActiveMode={setActiveMode}
                    setAnalysisResult={handleSetAnalysisResult}
                    setIsLoading={setIsLoading}
                    setFileForDashboard={handleSetFileForDashboard}
                />;
        }
    };
    
    return (
        <div className="bg-color">
            <BackgroundEffects />
            <Header activePage={activePage} setActivePage={setActivePage} />
            <main className={isLoading ? 'loading' : ''}>
                {isLoading && <div className="loading-overlay" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem'}}>Analyzing...</div>}
                {renderPage()}
            </main>
        </div>
    );
}

export default App;

