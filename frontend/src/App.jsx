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
    return (
        <header>
            <nav>
                <div className="logo">LegalAlly AI</div>
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

