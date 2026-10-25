import { useState, useEffect } from 'react';
import SolarSystemScene from './components/SolarSystemScene';
import LiveDemoPage from './components/LiveDemoPage';
import { LiveDatabaseMonitor } from './components/LiveDatabaseMonitor';
import { CyberDrawer } from './components/CyberDrawer';
import { SplashScreen } from './components/SplashScreen';
import { useBackendSync } from './hooks/useBackendSync';
import { useWeb3Listener } from './hooks/useWeb3Listener';

export function App() {
  // Mount backend SQLite polling & cross-tab BroadcastChannel sync at root level
  useBackendSync();
  // Mount live Hardhat blockchain block listener
  useWeb3Listener();

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <>
      <SplashScreen />
      {currentPath === '/demo' || currentPath.startsWith('/demo') ? <LiveDemoPage /> : <SolarSystemScene />}
      {currentPath !== '/demo' && !currentPath.startsWith('/demo') && <CyberDrawer />}
      <LiveDatabaseMonitor />
    </>
  );
}

export default App;
