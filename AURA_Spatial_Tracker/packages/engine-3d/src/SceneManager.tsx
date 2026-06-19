import { Suspense, useEffect, useState, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSpatialStore } from '@aura/state-store'
import { LoadedShelf } from './components/LoadedShelf'
import { ParametricCabinet } from './components/ParametricCabinet'
import { HologramWall } from './components/HologramWall'
import { IBeam } from './components/IBeam'
import { LowPolyFurniture } from './components/LowPolyFurniture'
import { ImportedAssetFurniture } from './components/ImportedAssetFurniture'
import { AlignmentGuides } from './components/AlignmentGuides'
import { SnapFootprints } from './components/SnapFootprints'
import { getFurnitureFootprint, type FurnitureFootprint } from './furnitureGeometry'
import type { AlignmentGuideData } from '@aura/state-store'

type TransformControlEvent = {
  target?: {
    object?: THREE.Object3D
  }
}

type AxisSnapTarget = {
  activeEdge: 'center' | 'min' | 'max'
  targetValue: number
  guidePosition: number
}

function GlobalGizmo() {
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId)
  const updateFurniturePosition = useSpatialStore(state => state.updateFurniturePosition)
  const updateFurnitureDimensions = useSpatialStore(state => state.updateFurnitureDimensions)
  const updateFurnitureRotation = useSpatialStore(state => state.updateFurnitureRotation)
  const setIsDraggingFurniture = useSpatialStore(state => state.setIsDraggingFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const setActiveAlignments = useSpatialStore(state => state.setActiveAlignments)
  const setDraggingPosition = useSpatialStore(state => state.setDraggingPosition)
  const gizmoMode = useSpatialStore(state => state.gizmoMode)
  const isSnappingEnabled = useSpatialStore(state => state.isSnappingEnabled)
  const showSnapFootprints = useSpatialStore(state => state.showSnapFootprints)
  const furnitureList = useSpatialStore(state => state.furniture)
  const { scene } = useThree()

  const [targetObject, setTargetObject] = useState<THREE.Object3D | null>(null)

  // High-performance cache for magnetic snapping targets
  const snapCacheRef = useRef<{ x: AxisSnapTarget[], z: AxisSnapTarget[] }>({ x: [], z: [] })
  const activeFootprintRef = useRef<FurnitureFootprint>({
    centerX: 0,
    centerZ: 0,
    halfX: 0.5,
    halfZ: 0.5,
    offsetX: 0,
    offsetZ: 0,
    minX: -0.5,
    maxX: 0.5,
    minZ: -0.5,
    maxZ: 0.5,
  })

  useEffect(() => {
    if (focusedFurnitureId) {
      const obj = scene.getObjectByName(`furniture-${focusedFurnitureId}`)
      setTargetObject(obj || null)
    } else {
      setTargetObject(null)
    }
  }, [focusedFurnitureId, scene])

  if (!targetObject || !focusedFurnitureId) return null

  const findSnapTarget = (
    targets: AxisSnapTarget[],
    edges: Record<AxisSnapTarget['activeEdge'], number>,
    threshold: number
  ) => {
    let bestTarget: AxisSnapTarget | null = null
    let bestDistance = threshold

    for (const target of targets) {
      const distance = Math.abs(edges[target.activeEdge] - target.targetValue)

      if (distance < bestDistance) {
        bestDistance = distance
        bestTarget = target
      }
    }

    return bestTarget
  }

  return (
    <TransformControls 
      object={targetObject}
      mode={gizmoMode}
      rotationSnap={Math.PI / 4} 
      showX={gizmoMode !== 'rotate'} 
      showZ={gizmoMode !== 'rotate'}
      showY={gizmoMode === 'scale' || gizmoMode === 'rotate'} 
      onMouseDown={() => {
        setIsDraggingFurniture(true)
        setCameraTarget(null) 
        if (showSnapFootprints) {
          setDraggingPosition([targetObject.position.x, targetObject.position.y, targetObject.position.z])
        }

        // STEP 2: PRE-CALCULATION (One-time scan when drag starts)
        if (isSnappingEnabled && gizmoMode === 'translate') {
          const activeObj = furnitureList.find(f => f.id === focusedFurnitureId)
          if (activeObj) {
            activeFootprintRef.current = getFurnitureFootprint(activeObj)
            const [ax, , az] = activeObj.position
            const scanRadius = 1640 // ~500 meters

            const targetXs: AxisSnapTarget[] = []
            const targetZs: AxisSnapTarget[] = []

            furnitureList.forEach(other => {
              if (other.id === focusedFurnitureId) return

              const [ox, , oz] = other.position
              const dist = Math.sqrt(Math.pow(ax - ox, 2) + Math.pow(az - oz, 2))

              if (dist <= scanRadius) {
                const otherFootprint = getFurnitureFootprint(other)

                targetXs.push(
                  { activeEdge: 'center', targetValue: otherFootprint.centerX, guidePosition: otherFootprint.centerX },
                  { activeEdge: 'min', targetValue: otherFootprint.maxX, guidePosition: otherFootprint.maxX },
                  { activeEdge: 'max', targetValue: otherFootprint.minX, guidePosition: otherFootprint.minX },
                )
                targetZs.push(
                  { activeEdge: 'center', targetValue: otherFootprint.centerZ, guidePosition: otherFootprint.centerZ },
                  { activeEdge: 'min', targetValue: otherFootprint.maxZ, guidePosition: otherFootprint.maxZ },
                  { activeEdge: 'max', targetValue: otherFootprint.minZ, guidePosition: otherFootprint.minZ },
                )
              }
            })

            snapCacheRef.current = { x: targetXs, z: targetZs }
          }
        }
      }} 
      onChange={(e) => {
        const obj = (e as TransformControlEvent | undefined)?.target?.object

        // STEP 3: THE TIGHT-THRESHOLD MAGNET
        if (gizmoMode === 'translate' && isSnappingEnabled && obj) {
          const activeFootprint = activeFootprintRef.current
          const SNAP_THRESHOLD = 0.5 
          const activeGuides: AlignmentGuideData[] = []

          const currentX = obj.position.x + activeFootprint.offsetX
          const currentZ = obj.position.z + activeFootprint.offsetZ
          const edgesX = {
            center: currentX,
            min: currentX - activeFootprint.halfX,
            max: currentX + activeFootprint.halfX,
          }
          const edgesZ = {
            center: currentZ,
            min: currentZ - activeFootprint.halfZ,
            max: currentZ + activeFootprint.halfZ,
          }

          const snapX = findSnapTarget(snapCacheRef.current.x, edgesX, SNAP_THRESHOLD)
          if (snapX) {
            if (snapX.activeEdge === 'center') obj.position.x = snapX.targetValue - activeFootprint.offsetX
            else if (snapX.activeEdge === 'min') obj.position.x = snapX.targetValue + activeFootprint.halfX - activeFootprint.offsetX
            else obj.position.x = snapX.targetValue - activeFootprint.halfX - activeFootprint.offsetX
            activeGuides.push({ axis: 'X', position: snapX.guidePosition })
          }

          const snapZ = findSnapTarget(snapCacheRef.current.z, edgesZ, SNAP_THRESHOLD)
          if (snapZ) {
            if (snapZ.activeEdge === 'center') obj.position.z = snapZ.targetValue - activeFootprint.offsetZ
            else if (snapZ.activeEdge === 'min') obj.position.z = snapZ.targetValue + activeFootprint.halfZ - activeFootprint.offsetZ
            else obj.position.z = snapZ.targetValue - activeFootprint.halfZ - activeFootprint.offsetZ
            activeGuides.push({ axis: 'Z', position: snapZ.guidePosition })
          }

          setActiveAlignments(activeGuides)
        }

        if (showSnapFootprints && obj) {
          setDraggingPosition([obj.position.x, obj.position.y, obj.position.z])
        }
      }}
      onMouseUp={(e) => {
        setIsDraggingFurniture(false)
        setDraggingPosition(null)
        setActiveAlignments([])
        const obj = (e as TransformControlEvent | undefined)?.target?.object
        
        if (obj) {
          if (gizmoMode === 'translate') {
            const finalPos: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z]
            updateFurniturePosition(focusedFurnitureId, finalPos)
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
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)

  return (
    <>
      <GlobalGizmo />
      <AlignmentGuides />
      <SnapFootprints />
      <Suspense fallback={null}>
        {furnitureList.map(furniture => {
          if (furniture.modelId === 'shelf') {
            return <LoadedShelf key={furniture.id} id={furniture.id} />
          } else if (furniture.modelId === 'wall-single' || furniture.modelId === 'wall-double') {
            return <HologramWall key={furniture.id} id={furniture.id} />
          } else if (furniture.modelId === 'i-beam') {
            return <IBeam key={furniture.id} id={furniture.id} />
          } else if (furniture.modelId === 'parametric') {
            return <ParametricCabinet key={furniture.id} id={furniture.id} />
          } else if (assetDefinitions[furniture.modelId]?.sourceStorageKey) {
            return <ImportedAssetFurniture key={furniture.id} id={furniture.id} />
          } else {
            return <LowPolyFurniture key={furniture.id} id={furniture.id} />
          }
        })}
      </Suspense>
    </>
  )
}
