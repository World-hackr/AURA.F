import { Canvas } from '@react-three/fiber'
import { IsometricCamera, SceneManager } from '@aura/engine-3d'
import { LeftPanel, RightPanel, CenterOverlays } from './components/UIPanels'
import { useSpatialStore } from '@aura/state-store'
import * as THREE from 'three'
import { useEffect } from 'react'
import './index.css'

function AppContent() {
  const abyssDarkness = useSpatialStore(state => state.abyssDarkness)
  const gridOpacity = useSpatialStore(state => state.gridOpacity)
  
  // Calculate background color based on darkness (1 = black, 0 = white)
  const lightness = Math.floor((1 - abyssDarkness) * 255)
  const bgColor = `rgb(${lightness}, ${lightness}, ${lightness})`

  // We map the grid lines to be slightly brighter than the abyss so they stand out
  const gridLineLightness = Math.min(255, lightness + 40)
  const gridColor = `rgba(${gridLineLightness}, ${gridLineLightness}, ${gridLineLightness}, ${gridOpacity})`

  return (
    <div className="center-panel">
      <Canvas>
        <color attach="background" args={[bgColor]} />

        <IsometricCamera />

        {/* RAW Three.js Grid. No shaders, no fading, no tricks. Just math lines. */}
        {gridOpacity > 0 && (
          <gridHelper 
            args={[1000, 1000, gridColor, gridColor]} 
            position={[0, 0, 0]} 
          />
        )}

        {/* Clean, flat lighting for the hologram aesthetic. No shadows. */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[15, 30, 15]} intensity={1.0} />

        <SceneManager />
      </Canvas>
      <CenterOverlays />
    </div>
  )
}

function App() {
  const setGizmoMode = useSpatialStore(state => state.setGizmoMode)

  // Global Keyboard Shortcuts for professional CAD workflow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (like the search bar or dimensions)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 't') setGizmoMode('translate');
      if (key === 'r') setGizmoMode('rotate');
      if (key === 's') setGizmoMode('scale');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setGizmoMode]);

  return (
    <div className="app-layout">
      <LeftPanel />
      <AppContent />
      <RightPanel />
    </div>
  )
}

export default App
