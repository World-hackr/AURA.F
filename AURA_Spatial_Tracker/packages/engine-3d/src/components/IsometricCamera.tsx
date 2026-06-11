import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const cameraView = useSpatialStore(state => state.cameraView)
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId)
  const furniture = useSpatialStore(state => state.furniture)
  const { camera } = useThree()

  const target = useMemo<[number, number, number]>(() => {
    const focusedFurniture = furniture.find(f => f.id === focusedFurnitureId)
    if (!focusedFurniture) return [0, 2, 0]

    const [x, y, z] = focusedFurniture.position
    return [x, y + 2, z]
  }, [focusedFurnitureId, furniture])

  useEffect(() => {
    const [tx, ty, tz] = target

    if (cameraView === 'TOP') {
      camera.position.set(tx, ty + 35, tz + 0.01)
    } else if (cameraView === 'FRONT') {
      camera.position.set(tx, ty + 4, tz + 22)
    } else {
      camera.position.set(tx + 18, ty + 12, tz + 18)
    }

    camera.lookAt(tx, ty, tz)
    camera.updateProjectionMatrix()
  }, [camera, cameraView, target])

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
        enabled={!isDraggingFurniture}
        target={target}
        minDistance={2}
        maxDistance={200}
        makeDefault
      />
    </>
  )
}





