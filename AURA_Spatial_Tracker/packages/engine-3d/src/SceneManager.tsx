import { Suspense, useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSpatialStore } from '@aura/state-store'
import { LoadedShelf } from './components/LoadedShelf'
import { ParametricCabinet } from './components/ParametricCabinet'
import { HologramWall } from './components/HologramWall'
import { IBeam } from './components/IBeam'

function GlobalGizmo() {
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId)
  const updateFurniturePosition = useSpatialStore(state => state.updateFurniturePosition)
  const updateFurnitureDimensions = useSpatialStore(state => state.updateFurnitureDimensions)
  const updateFurnitureRotation = useSpatialStore(state => state.updateFurnitureRotation)
  const setIsDraggingFurniture = useSpatialStore(state => state.setIsDraggingFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const gizmoMode = useSpatialStore(state => state.gizmoMode)
  const furnitureList = useSpatialStore(state => state.furniture)
  const { scene } = useThree()

  const [targetObject, setTargetObject] = useState<THREE.Object3D | null>(null)

  useEffect(() => {
    if (focusedFurnitureId) {
      const obj = scene.getObjectByName(`furniture-${focusedFurnitureId}`)
      setTargetObject(obj || null)
    } else {
      setTargetObject(null)
    }
  }, [focusedFurnitureId, scene])

  if (!targetObject || !focusedFurnitureId) return null

  return (
    <TransformControls 
      object={targetObject}
      mode={gizmoMode}
      translationSnap={1}
      showX={gizmoMode !== 'rotate'} // When rotating, only show Y-axis ring to spin on the floor
      showZ={gizmoMode !== 'rotate'}
      showY={gizmoMode === 'scale' || gizmoMode === 'rotate'} 
      onMouseDown={() => {
        setIsDraggingFurniture(true)
        setCameraTarget(null) 
      }} 
      onMouseUp={(e) => {
        setIsDraggingFurniture(false)
        if (e && e.target && e.target.object) {
          const obj = e.target.object
          
          if (gizmoMode === 'translate') {
            updateFurniturePosition(focusedFurnitureId, [obj.position.x, obj.position.y, obj.position.z])
          } else if (gizmoMode === 'rotate') {
            updateFurnitureRotation(focusedFurnitureId, obj.rotation.y)
          } else if (gizmoMode === 'scale') {
            const fData = furnitureList.find(f => f.id === focusedFurnitureId)
            if (fData) {
              const currentDims = fData.dimensions
              const newW = Math.max(0.1, Math.round(currentDims[0] * obj.scale.x * 10) / 10)
              const newH = Math.max(0.1, Math.round(currentDims[1] * obj.scale.y * 10) / 10)
              const newD = Math.max(0.1, Math.round(currentDims[2] * obj.scale.z * 10) / 10)
              
              updateFurnitureDimensions(focusedFurnitureId, [newW, newH, newD])
              obj.scale.set(1, 1, 1)
            }
          }
        }
      }}
    />
  )
}

export function SceneManager() {
  const furnitureList = useSpatialStore(state => state.furniture)

  return (
    <>
      <GlobalGizmo />
      <Suspense fallback={null}>
        {furnitureList.map(furniture => {
          if (furniture.modelId === 'shelf') {
            return <LoadedShelf key={furniture.id} id={furniture.id} />
          } else if (furniture.modelId === 'wall-single' || furniture.modelId === 'wall-double') {
            return <HologramWall key={furniture.id} id={furniture.id} />
          } else if (furniture.modelId === 'i-beam') {
            return <IBeam key={furniture.id} id={furniture.id} />
          } else {
            return <ParametricCabinet key={furniture.id} id={furniture.id} />
          }
        })}
      </Suspense>
    </>
  )
}
