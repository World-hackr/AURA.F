import { Suspense, useEffect, useState, useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSpatialStore } from '@aura/state-store'
import { LoadedShelf } from './components/LoadedShelf'
import { ParametricCabinet } from './components/ParametricCabinet'
import { HologramWall } from './components/HologramWall'
import { HologramCurvedWall } from './components/HologramCurvedWall'
import { SolidBox } from './components/SolidBox'
import { SolidCylinder } from './components/SolidCylinder'
import { IBeam } from './components/IBeam'
import { LowPolyFurniture } from './components/LowPolyFurniture'
import { ImportedAssetFurniture } from './components/ImportedAssetFurniture'
import { AlignmentGuides } from './components/AlignmentGuides'
import { SnapFootprints } from './components/SnapFootprints'
import { SketchOverlay3D } from './components/SketchOverlay3D'
import { ProceduralProjectComponent } from './components/ProceduralProjectComponent'
import { getFurnitureFootprint, type FurnitureFootprint } from './furnitureGeometry'
import type { AlignmentGuideData, Furniture, SpatialState, SketchOperation } from '@aura/state-store'

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
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={() => {
        setIsDraggingFurniture(true)
        if (showSnapFootprints) {
          setDraggingPosition([targetObject.position.x, targetObject.position.y, targetObject.position.z])
        }

        // STEP 2: PRE-CALCULATION (One-time scan when drag starts)
        if (isSnappingEnabled && gizmoMode === 'translate') {
          const activeObj = furnitureList.find((f: Furniture) => f.id === focusedFurnitureId)
          if (activeObj) {
            activeFootprintRef.current = getFurnitureFootprint(activeObj)
            const [ax, , az] = activeObj.position
            const scanRadius = 1640 // ~500 meters

            const targetXs: AxisSnapTarget[] = []
            const targetZs: AxisSnapTarget[] = []

            furnitureList.forEach((other: Furniture) => {
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
          } else {
            obj.position.x = Math.round(obj.position.x / 0.25) * 0.25
          }

          const snapZ = findSnapTarget(snapCacheRef.current.z, edgesZ, SNAP_THRESHOLD)
          if (snapZ) {
            if (snapZ.activeEdge === 'center') obj.position.z = snapZ.targetValue - activeFootprint.offsetZ
            else if (snapZ.activeEdge === 'min') obj.position.z = snapZ.targetValue + activeFootprint.halfZ - activeFootprint.offsetZ
            else obj.position.z = snapZ.targetValue - activeFootprint.halfZ - activeFootprint.offsetZ
            activeGuides.push({ axis: 'Z', position: snapZ.guidePosition })
          } else {
            obj.position.z = Math.round(obj.position.z / 0.25) * 0.25
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
            const fData = furnitureList.find((f: Furniture) => f.id === focusedFurnitureId)
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
  const furnitureList = useSpatialStore((state: SpatialState) => state.furniture)
  const assetDefinitions = useSpatialStore((state: SpatialState) => state.assetDefinitions)
  const isSketchMode = useSpatialStore((state: SpatialState) => state.isSketchMode)
  const sketchIsolatedMode = useSpatialStore((state: SpatialState) => state.sketchIsolatedMode)
  const sketchReferenceMode = useSpatialStore((state: SpatialState) => state.sketchReferenceMode)
  const activeProjectId = useSpatialStore((state: SpatialState) => state.activeProjectId)
  const cadWorkspaceMode = useSpatialStore((state: SpatialState) => state.cadWorkspaceMode)

  const sketchOperations = useSpatialStore((state: SpatialState) => state.sketchOperations) || []
  const sketchTimelineIndex = useSpatialStore((state: SpatialState) => state.sketchTimelineIndex)
  const sketchFeatureMeta = useSpatialStore((state: SpatialState) => state.sketchFeatureMeta) || {}

  const { list: visibleFurnitureList, activeExtrudedIds } = useMemo(() => {
    if (!isSketchMode) return { list: furnitureList, activeExtrudedIds: new Set<string>() };

    const sortedOps = [...sketchOperations].sort((a, b) => a.createdAt - b.createdAt);
    const activeOps = sketchTimelineIndex === null || sketchTimelineIndex >= sortedOps.length
      ? sortedOps
      : sortedOps.slice(0, sketchTimelineIndex);

    const allSketchFurnitureIds = new Set<string>();
    sketchOperations.forEach((op: SketchOperation) => {
      if (op.toolType === 'EXTRUDE') {
        op.entityIds.forEach((id: string) => allSketchFurnitureIds.add(id));
      }
    });

    const activeFurnitureIds = new Set<string>();
    activeOps.forEach((op: SketchOperation) => {
      if (op.toolType === 'EXTRUDE' && sketchFeatureMeta[op.id]?.suppressed !== true) {
        op.entityIds.forEach((id: string) => activeFurnitureIds.add(id));
      }
    });

    const list = furnitureList.filter((f: Furniture) => {
      if (allSketchFurnitureIds.has(f.id)) {
        return activeFurnitureIds.has(f.id);
      }
      return true;
    });

    return { list, activeExtrudedIds: activeFurnitureIds };
  }, [furnitureList, sketchOperations, sketchTimelineIndex, sketchFeatureMeta, isSketchMode]);

  const renderFurniture = (furniture: Furniture, isReference = false) => {
    // Skip rendering the active project itself in CAD editor view when in 2D mode to avoid double rendering with the sketch overlay
    if (isSketchMode && cadWorkspaceMode === '2D' && furniture.modelId === `project-${activeProjectId}`) {
      return null
    }

    if (furniture.modelId.startsWith('project-')) {
      return <ProceduralProjectComponent key={furniture.id} id={furniture.id} isReference={isReference} />
    }

    if (furniture.modelId === 'shelf') {
      return <LoadedShelf key={furniture.id} id={furniture.id} />
    } else if (furniture.modelId === 'wall-single' || furniture.modelId === 'wall-double') {
      return <HologramWall key={furniture.id} id={furniture.id} isReference={isReference} />
    } else if (furniture.modelId === 'wall-curved') {
      return <HologramCurvedWall key={furniture.id} id={furniture.id} isReference={isReference} />
    } else if (furniture.modelId === 'solid-box') {
      return <SolidBox key={furniture.id} id={furniture.id} isReference={isReference} />
    } else if (furniture.modelId === 'solid-cylinder') {
      return <SolidCylinder key={furniture.id} id={furniture.id} isReference={isReference} />
    } else if (furniture.modelId === 'ibeam') {
      return <IBeam key={furniture.id} id={furniture.id} />
    } else if (furniture.modelId === 'parametric') {
      return <ParametricCabinet key={furniture.id} id={furniture.id} />
    } else if (assetDefinitions[furniture.modelId]?.sourceStorageKey) {
      return <ImportedAssetFurniture key={furniture.id} id={furniture.id} />
    } else {
      return <LowPolyFurniture key={furniture.id} id={furniture.id} />
    }
  }

  return (
    <>
      {!isSketchMode && <GlobalGizmo />}
      {!isSketchMode && <AlignmentGuides />}
      {!isSketchMode && <SnapFootprints />}
      <SketchOverlay3D />
      <Suspense fallback={null}>
        {isSketchMode ? (
          <group raycast={isSketchMode && cadWorkspaceMode === '2D' ? () => null : undefined}>
            {/* Render other furniture/projects as reference */}
            {sketchReferenceMode && visibleFurnitureList.map((furniture: Furniture) => {
              const isActiveProj = furniture.modelId === `project-${activeProjectId}`;
              const isExtrudedBody = activeExtrudedIds.has(furniture.id);
              if (isActiveProj || isExtrudedBody) return null;

              if (sketchIsolatedMode) {
                const isWall = furniture.modelId === 'wall-single' || furniture.modelId === 'wall-double' || furniture.modelId === 'wall-curved' || furniture.modelId === 'solid-box' || furniture.modelId === 'solid-cylinder'
                if (!isWall) return null
              }
              return renderFurniture(furniture, true)
            })}

            {/* Render the active project and its extruded solid bodies fully opaque and interactive when in 3D CAD mode */}
            {cadWorkspaceMode === '3D' && (() => {
              const isPlaced = visibleFurnitureList.some((furniture: Furniture) => furniture.modelId === `project-${activeProjectId}`);
              const activeProjectEl = !isPlaced && activeProjectId ? (
                <ProceduralProjectComponent key={`unplaced-project-${activeProjectId}`} id={activeProjectId} isReference={false} />
              ) : null;

              const placedAndExtrudedEls = visibleFurnitureList.map((furniture: Furniture) => {
                const isActiveProj = furniture.modelId === `project-${activeProjectId}`;
                const isExtrudedBody = activeExtrudedIds.has(furniture.id);

                if (isActiveProj || isExtrudedBody) {
                  return renderFurniture(furniture, false)
                }
                return null;
              });

              return (
                <>
                  {activeProjectEl}
                  {placedAndExtrudedEls}
                </>
              );
            })()}
          </group>
        ) : (
          visibleFurnitureList.map((furniture: Furniture) => renderFurniture(furniture, false))
        )}
      </Suspense>
    </>
  )
}
