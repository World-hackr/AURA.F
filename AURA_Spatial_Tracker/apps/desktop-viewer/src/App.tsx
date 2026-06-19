import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { BoxOutline, IsometricCamera, SceneManager, ChamferedViewCube } from '@aura/engine-3d'
import { LeftPanel, RightPanel, CenterOverlays } from './components/UIPanels'
import { AssetWorkspace } from './components/AssetWorkspace'
import { useSpatialStore } from '@aura/state-store'
import type { Vector3 } from '@aura/state-store'
import { AdaptiveDpr, GizmoHelper } from '@react-three/drei'
import { useEffect, useState } from 'react'
import './index.css'

const PLACEMENT_GRID_STEP = 0.25

function snapPlacementValue(value: number) {
  return Math.round(value / PLACEMENT_GRID_STEP) * PLACEMENT_GRID_STEP
}

function samePlacement(a: Vector3 | null, b: Vector3) {
  return Boolean(a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2])
}

function PlacementGhost() {
  const pendingPlacementModelId = useSpatialStore(state => state.pendingPlacementModelId)
  const placementPosition = useSpatialStore(state => state.placementPosition)
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)

  if (!pendingPlacementModelId || !placementPosition) return null

  const asset = assetDefinitions[pendingPlacementModelId]
  const dimensions = asset?.defaultDimensions ?? ([4, 6, 2] as Vector3)
  const [width, height, depth] = dimensions
  const position: Vector3 = [placementPosition[0], height / 2, placementPosition[2]]

  return (
    <group position={position} renderOrder={40}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <BoxOutline size={dimensions} color="#f8fafc" opacity={0.95} />
      <group position={[0, -height / 2 + 0.01, 0]}>
        <BoxOutline size={[width, 0.02, depth]} color="#ff4d7d" opacity={0.8} />
      </group>
    </group>
  )
}

function PlacementSurface({ floorColor }: { floorColor: string }) {
  const pendingPlacementModelId = useSpatialStore(state => state.pendingPlacementModelId)
  const placementPosition = useSpatialStore(state => state.placementPosition)
  const setPlacementPosition = useSpatialStore(state => state.setPlacementPosition)
  const setPendingPlacementModelId = useSpatialStore(state => state.setPendingPlacementModelId)
  const addFurniture = useSpatialStore(state => state.addFurniture)

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!pendingPlacementModelId) return

    const next: Vector3 = [
      snapPlacementValue(event.point.x),
      0,
      snapPlacementValue(event.point.z),
    ]

    if (!samePlacement(placementPosition, next)) {
      setPlacementPosition(next)
    }
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!pendingPlacementModelId || !placementPosition) return

    event.stopPropagation()
    addFurniture(pendingPlacementModelId, placementPosition)
    setPendingPlacementModelId(null)
  }

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.055, 0]}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial color={floorColor} depthWrite={false} />
      </mesh>
      <PlacementGhost />
    </>
  )
}

function AppContent() {
  const abyssDarkness = useSpatialStore(state => state.abyssDarkness)
  
  // Keep the environment pitch black; this slider now only controls floor brightness.
  const floorLightness = Math.floor((1 - abyssDarkness) * 255)
  const floorColor = `rgb(${floorLightness}, ${floorLightness}, ${floorLightness})`

  return (
    <div className="center-panel">
      <Canvas
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
      >
        <color attach="background" args={['#000000']} />

        <IsometricCamera />
        <AdaptiveDpr pixelated />

        {/* Lightweight visual/raycast floor for mobile-friendly depth reference. */}
        <PlacementSurface floorColor={floorColor} />

        {/* Clean, flat lighting for the hologram aesthetic. No shadows. */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[15, 30, 15]} intensity={1.0} />

        <SceneManager />

        {/* Professional CAD ViewCube in the top right */}
        <GizmoHelper alignment="top-right" margin={[80, 80]}>
          <ChamferedViewCube />
        </GizmoHelper>
      </Canvas>
      <CenterOverlays />
    </div>
  )
}

function App() {
  const [workspace, setWorkspace] = useState<'room' | 'assets'>('room')
  const setGizmoMode = useSpatialStore(state => state.setGizmoMode)
  const setPendingPlacementModelId = useSpatialStore(state => state.setPendingPlacementModelId)

  // Global Keyboard Shortcuts for professional CAD workflow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (like the search bar or dimensions)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 't') setGizmoMode('translate');
      if (key === 'r') setGizmoMode('rotate');
      if (key === 's') setGizmoMode('scale');
      if (key === 'escape') setPendingPlacementModelId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setGizmoMode, setPendingPlacementModelId]);

  return workspace === 'assets' ? (
    <AssetWorkspace onClose={() => setWorkspace('room')} />
  ) : (
    <div className="app-layout">
      <LeftPanel onOpenAssets={() => setWorkspace('assets')} />
      <AppContent />
      <RightPanel />
    </div>
  )
}

export default App
