import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { MapControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const cameraView = useSpatialStore(state => state.cameraView)
  
  const cameraTargetId = useSpatialStore(state => state.cameraTargetId)
  const cameraSwoopTrigger = useSpatialStore(state => state.cameraSwoopTrigger)
  const furniture = useSpatialStore(state => state.furniture)
  const { camera } = useThree()
  
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const [swoopTarget, setSwoopTarget] = useState<{ pos: THREE.Vector3, focus: THREE.Vector3 } | null>(null)
  const lastCameraView = useRef(cameraView)

  // Use a string representation of the target to prevent React from seeing a "new array" every render
  const targetStr = useMemo(() => {
    const targetFurniture = furniture.find(f => f.id === cameraTargetId)
    if (!targetFurniture) return "0,2,0"
    const [x, y, z] = targetFurniture.position
    return `${x},${y + 2},${z}`
  }, [cameraTargetId, furniture])

  useEffect(() => {
    const [tx, ty, tz] = targetStr.split(',').map(Number)
    const clampedX = THREE.MathUtils.clamp(tx, -8, 8)
    const clampedZ = THREE.MathUtils.clamp(tz, -8, 8)

    if (cameraTargetId) {
      setSwoopTarget({
        pos: new THREE.Vector3(tx + 12, ty + 10, tz + 12),
        focus: new THREE.Vector3(tx, ty, tz)
      })
    } else if (cameraView !== lastCameraView.current) {
      // ONLY reset the camera if the user EXPLICITLY clicked Top/Front/Iso in the UI.
      // Never reset it just because a drag ended or state updated.
      setSwoopTarget(null)
      lastCameraView.current = cameraView
      
      if (cameraView === 'TOP') {
        camera.position.set(clampedX, 40, clampedZ + 0.01)
      } else if (cameraView === 'FRONT') {
        camera.position.set(clampedX, 5, clampedZ + 25)
      } else {
        camera.position.set(clampedX + 15, 15, clampedZ + 15)
      }
      camera.lookAt(0, 2, 0)
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 2, 0)
      }
      camera.updateProjectionMatrix()
    }
  }, [camera, cameraView, targetStr, cameraTargetId, cameraSwoopTrigger])

  useFrame((_, delta) => {
    if (swoopTarget && controlsRef.current) {
      // Smoothly interpolate the camera position and the controls target
      camera.position.lerp(swoopTarget.pos, 5 * delta)
      controlsRef.current.target.lerp(swoopTarget.focus, 5 * delta)
      controlsRef.current.update()
      
      // Stop the animation once we are close enough so manual control is restored
      if (camera.position.distanceTo(swoopTarget.pos) < 0.1) {
        setSwoopTarget(null)
      }
    }
  })

  return (
    <>
      {cameraProjection === 'PERSPECTIVE' ? (
        <PerspectiveCamera 
          makeDefault 
          position={[0, 15, 15]} 
          fov={35} 
          near={0.1}
          far={100000} // Massive far clipping plane to prevent 'foggy' deletion of the grid
        />
      ) : (
        <OrthographicCamera 
          makeDefault 
          position={[0, 15, 15]} 
          zoom={20} 
          near={-100000}
          far={100000} // Massive far clipping plane
        />
      )}
      
      <MapControls 
        ref={controlsRef}
        enabled={!isDraggingFurniture && !swoopTarget} // Lock controls during animation
        minDistance={2}
        maxDistance={5000} // Allow zooming out much further
        makeDefault
      />
    </>
  )
}





