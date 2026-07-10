import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { BoxOutline, IsometricCamera, SceneManager, ChamferedViewCube, GimbalViewCube, ImportedModel, InfiniteGridHelper } from '@aura/engine-3d'
import { LeftPanel, RightPanel, CenterOverlays, AppSettings } from './components/UIPanels'
import { AssetWorkspace } from './components/AssetWorkspace'
import { useSpatialStore, createAssetObjectUrl } from '@aura/state-store'
import type { Vector3 } from '@aura/state-store'
import { AdaptiveDpr, GizmoHelper } from '@react-three/drei'
import { useEffect, useState, Suspense } from 'react'

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
  const [modelUrl, setModelUrl] = useState<string | null>(null)

  const asset = pendingPlacementModelId ? assetDefinitions[pendingPlacementModelId] : undefined

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const loadModelUrl = async () => {
      if (!asset?.sourceStorageKey) {
        setModelUrl(null)
        return
      }

      objectUrl = await createAssetObjectUrl(asset.sourceStorageKey)
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        return
      }

      setModelUrl(objectUrl)
    }

    void loadModelUrl()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset?.sourceStorageKey])

  if (!pendingPlacementModelId || !placementPosition || !asset) return null

  const dimensions = asset.defaultDimensions
  const [width, height, depth] = dimensions
  const position: Vector3 = [placementPosition[0], height / 2, placementPosition[2]]

  return (
    <group position={position} renderOrder={40}>
      {modelUrl ? (
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[width, height, depth]} />
            <meshBasicMaterial color="#5eead4" transparent opacity={0.14} depthWrite={false} />
          </mesh>
        }>
          <ImportedModel asset={asset} modelUrl={modelUrl} dimensions={dimensions} />
        </Suspense>
      ) : (
        <mesh>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.14} depthWrite={false} />
        </mesh>
      )}
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
        renderOrder={-10}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial color={floorColor} depthWrite={false} />
      </mesh>
      <PlacementGhost />
    </>
  )
}

function RoomCanvas() {
  const abyssDarkness = useSpatialStore(state => state.abyssDarkness)
  const viewCubeStyle = useSpatialStore(state => state.viewCubeStyle)
  
  // Keep the environment pitch black; this slider now only controls floor brightness.
  const floorLightness = Math.floor((1 - abyssDarkness) * 255)
  const floorColor = `rgb(${floorLightness}, ${floorLightness}, ${floorLightness})`

  return (
    <div className="center-panel" style={{ width: '60vw', height: '100%', position: 'relative' }}>
      <Canvas
        key="room-canvas"
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance"
        }}
      >
        <color attach="background" args={['#000000']} />
        <AdaptiveDpr pixelated />
        
        {/* Dynamic viewport-based perspective/orthographic camera system */}
        <IsometricCamera />

        {/* Optimized technical infinite snapping grid */}
        <InfiniteGridHelper />

        {/* Lightweight visual/raycast floor for depth reference and spawning */}
        <PlacementSurface floorColor={floorColor} />

        {/* Clean, flat lighting for the hologram aesthetic. No shadows. */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[15, 30, 15]} intensity={1.0} />

        <SceneManager />

        {/* Professional CAD ViewCube in the top right */}
        <GizmoHelper alignment="top-right" margin={[80, 80]}>
          {viewCubeStyle === 'gimbal' ? <GimbalViewCube /> : <ChamferedViewCube />}
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
  const setSketchMode = useSpatialStore(state => state.setSketchMode)
  const isSketchMode = useSpatialStore(state => state.isSketchMode)
  const activeCADEngine = useSpatialStore(state => state.activeCADEngine)

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

  if (workspace === 'assets') {
    return <AssetWorkspace onClose={() => setWorkspace('room')} />
  }

  if (isSketchMode) {
    const isChili = activeCADEngine === 'chili3d';
    return (
      <div className="cad-layout" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#020617', overflow: 'hidden', position: 'relative' }}>
        {/* Simple Header */}
        <div style={{
          height: '40px',
          background: '#090d16',
          borderBottom: '1px solid rgba(6, 182, 212, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          color: '#f8fafc',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>AURA CAD WORKSPACE</span>
            <span style={{ fontSize: '9px', background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
              {isChili ? 'CHILI3D ENGINE' : 'JSKETCHER ENGINE'}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setSketchMode(false);
              }}
              style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: '4px',
                color: '#fb7185',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: '4px 12px',
                transition: 'all 0.15s'
              }}
            >
              ❌ Exit to Room
            </button>
          </div>
        </div>

        {/* Embedded IFrame */}
        <iframe
          src={isChili ? '/chili3d/index.html' : '/jsketcher/index.html'}
          style={{
            flex: 1,
            width: '100%',
            height: 'calc(100% - 40px)',
            border: 'none',
            background: '#ffffff'
          }}
          title={isChili ? "Chili3D CAD Workspace" : "JSketcher CAD Workspace"}
        />
      </div>
    )
  }

  return (
    <div className="app-layout" style={{ position: 'relative' }}>
      <LeftPanel 
        onOpenAssets={() => setWorkspace('assets')} 
        onOpenSketcher={() => setSketchMode(true)} 
      />
      <RoomCanvas />
      <RightPanel />
      <AppSettings />
    </div>
  )
}

export default App
