import { useRef, useEffect } from 'react'
import { CameraControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'
import * as THREE from 'three'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId)
  const cameraView = useSpatialStore(state => state.cameraView)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const furniture = useSpatialStore(state => state.furniture)
  
  const controlsRef = useRef<CameraControls>(null)

  useEffect(() => {
    if (!controlsRef.current) return

    if (focusedFurnitureId) {
      const targetFurniture = furniture.find(f => f.id === focusedFurnitureId)
      if (targetFurniture) {
        const [x, y, z] = targetFurniture.position
        controlsRef.current.setLookAt(
          x + 15, y + 15, z + 15, // Pulled back slightly more due to narrow FOV
          x, y + 2, z,
          true
        )
      }
    } else {
      if (cameraView === 'TOP') {
        controlsRef.current.setLookAt(0, 60, 0, 0, 0, 0, true) // Higher up for Top view
      } else if (cameraView === 'FRONT') {
        controlsRef.current.setLookAt(0, 8, 45, 0, 2, 0, true) // Further back for Front view
      } else {
        controlsRef.current.setLookAt(0, 25, 45, 0, 0, 0, true) // Further back for ISO view
      }
    }
  }, [focusedFurnitureId, cameraView, furniture])

  return (
    <>
      {cameraProjection === 'PERSPECTIVE' ? (
        <PerspectiveCamera 
          makeDefault 
          position={[0, 25, 45]} 
          fov={35} /* CRITICAL: Narrow FOV (35 instead of 60) mimics Fusion 360 and prevents edge bending/fisheye distortion */
          near={0.1}
          far={2000}
        />
      ) : (
        <OrthographicCamera 
          makeDefault 
          position={[0, 25, 45]} 
          zoom={20} 
          near={-1000}
          far={2000}
        />
      )}
      
      <CameraControls 
        ref={controlsRef}
        enabled={!isDraggingFurniture}
        minDistance={0.1}
        maxDistance={Infinity}
        infinityDolly={true}
        dollySpeed={150.0}
        dollyToCursor={true}
        smoothTime={0.2}
        mouseButtons={{
          left: 2, 
          right: 1, 
          wheel: 8, 
          middle: 0,
        }}
        touches={{
          one: 1, 
          two: 8, 
          three: 2 
        }}
      />
    </>
  )
}





