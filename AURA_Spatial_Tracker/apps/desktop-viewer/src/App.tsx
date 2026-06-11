import { Canvas } from '@react-three/fiber'
import { IsometricCamera, RoomMesh, NeonGrid, SceneManager } from '@aura/engine-3d'
import { LeftPanel, RightPanel, CenterOverlays } from './components/UIPanels'
import './index.css'

function App() {
  return (
    <div className="app-layout">

      <LeftPanel />

      <div className="center-panel">
        <Canvas shadows>
          <color attach="background" args={['#1a1a1a']} />

          <ambientLight intensity={0.5} />
          {/* Main light casting sharp shadows to show wall depth */}
          <directionalLight 
            position={[15, 30, 15]} 
            intensity={2.0} 
            castShadow 
            shadow-mapSize={[2048, 2048]} 
          />
          <hemisphereLight groundColor="#1a1a1a" color="#ffffff" intensity={0.5} />

          <IsometricCamera />
          <RoomMesh />
          <NeonGrid />

          <SceneManager />
        </Canvas>
        <CenterOverlays />
      </div>

      <RightPanel />

    </div>
  )
}

export default App
