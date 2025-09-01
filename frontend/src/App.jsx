import React, { useState, useEffect, useRef } from 'react';
import HomePage from './Home';
import DashboardPage from './Dashboard';
import ProfilePage from './Profile';
import './index.css'; // Make sure the path is correct

// ~~~~~~~~~~~~~~~~~~~~~~~ BACKGROUND EFFECTS COMPONENT ~~~~~~~~~~~~~~~~~~~~~~~
const BackgroundEffects = () => {
  return (
    <>
      {/* Floating Particles */}
      <div className="floating-particles">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>
    </>
  );
};

// ~~~~~~~~~~~~~~~~~~~~~~~ HEADER COMPONENT ~~~~~~~~~~~~~~~~~~~~~~~
const Header = ({ activePage, setActivePage }) => {
  const navItems = ['Home', 'Dashboard', 'Profile'];
  const headerRef = useRef(null);

  // Scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        if (window.scrollY > 50) {
          headerRef.current.classList.add('scrolled');
        } else {
          headerRef.current.classList.remove('scrolled');
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header ref={headerRef}>
      <nav>
        <div className="logo">
          Analyzer AI
        </div>
        <ul>
          {navItems.map(item => (
            <li key={item}>
              <a
                href={`#${item.toLowerCase()}`}
                className={activePage === item.toLowerCase() ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage(item.toLowerCase());
                }}
              >
                {item}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};

// ~~~~~~~~~~~~~~~~~~~~~~~ MAIN APP COMPONENT ~~~~~~~~~~~~~~~~~~~~~~~
function App() {
  const [activePage, setActivePage] = useState('home');
  const [activeMode, setActiveMode] = useState('simple');
  const [uploadedDocument, setUploadedDocument] = useState(null);

  // Auto-redirect to dashboard when document is uploaded
  useEffect(() => {
    if (uploadedDocument) {
      setActivePage('dashboard');
    }
  }, [uploadedDocument]);

  // Smooth page transitions
  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.style.opacity = '0';
      main.style.transform = 'translateY(20px)';

      setTimeout(() => {
        main.style.transition = 'all 0.4s ease';
        main.style.opacity = '1';
        main.style.transform = 'translateY(0)';
      }, 50);
    }
  }, [activePage]);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage activeMode={activeMode} setActiveMode={setActiveMode} uploadedDocument={uploadedDocument} />;
      case 'profile':
        return <ProfilePage />;
      case 'home':
      default:
        return <HomePage activeMode={activeMode} setActiveMode={setActiveMode} setUploadedDocument={setUploadedDocument} />;
    }
  };

  return (
    <div className="bg-color">
      <BackgroundEffects />
      <Header activePage={activePage} setActivePage={setActivePage} />
      <main>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;