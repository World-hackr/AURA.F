import { useRef, useEffect } from 'react'
import { CameraControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'
import * as THREE from 'three'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const cameraView = useSpatialStore(state => state.cameraView)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  
  const controlsRef = useRef<CameraControls>(null)

  useEffect(() => {
    if (!controlsRef.current) return

    if (cameraView === 'TOP') {
      controlsRef.current.setLookAt(0, 60, 0, 0, 0, 0, true)
    } else if (cameraView === 'FRONT') {
      controlsRef.current.setLookAt(0, 8, 45, 0, 2, 0, true)
    } else {
      controlsRef.current.setLookAt(0, 25, 45, 0, 0, 0, true)
    }
  }, [cameraView])

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
        minDistance={2}
        maxDistance={200}
        infinityDolly={false} /* Must be false to prevent target pushing */
        dollySpeed={25.0} /* Increased back to a fast, responsive speed for the trackpad */
        dollyToCursor={false} /* CRITICAL FIX: Disabled. This prevents the pivot point from flying into infinity and breaking the perspective */
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





