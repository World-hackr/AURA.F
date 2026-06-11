import { useRef, useEffect } from 'react'
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const cameraView = useSpatialStore(state => state.cameraView)
  
  const controlsRef = useRef<any>(null)

  // A very simple, non-hijacking snap to Top/Front/Iso views.
  // We do not animate this, we just snap the camera to avoid breaking math.
  useEffect(() => {
    if (!controlsRef.current) return

    if (cameraView === 'TOP') {
      controlsRef.current.object.position.set(0, 60, 0)
    } else if (cameraView === 'FRONT') {
      controlsRef.current.object.position.set(0, 5, 45)
    } else {
      controlsRef.current.object.position.set(0, 25, 45)
    }
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }, [cameraView])

  return (
    <>
      {cameraProjection === 'PERSPECTIVE' ? (
        <PerspectiveCamera 
          makeDefault 
          position={[0, 25, 45]} 
          fov={35} 
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
      
      {/* 
        Standard OrbitControls. 
        Left-click orbits (rotates), Right-click pans (slides), Scroll zooms. 
        No swooping, no custom math, no distortion. 
      */}
      <OrbitControls 
        ref={controlsRef}
        enabled={!isDraggingFurniture}
        minDistance={2}
        maxDistance={200}
        makeDefault
      />
    </>
  )
}





