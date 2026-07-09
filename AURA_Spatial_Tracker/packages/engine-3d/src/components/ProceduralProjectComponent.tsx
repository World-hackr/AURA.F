import { useRef, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg'

function createRoundedOrBeveledBoxShape(w: number, d: number, filletRadius: number, chamferDist: number): THREE.Shape {
  const shape = new THREE.Shape();
  const halfW = w / 2;
  const halfD = d / 2;

  if (filletRadius > 0) {
    const r = Math.min(filletRadius, halfW, halfD);
    shape.moveTo(-halfW + r, -halfD);
    shape.lineTo(halfW - r, -halfD);
    shape.absarc(halfW - r, -halfD + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(halfW, halfD - r);
    shape.absarc(halfW - r, halfD - r, r, 0, Math.PI / 2, false);
    shape.lineTo(halfW - r, halfD);
    shape.absarc(-halfW + r, halfD - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-halfW, -halfD + r);
    shape.absarc(-halfW + r, -halfD + r, r, Math.PI, -Math.PI / 2, false);
  } else if (chamferDist > 0) {
    const c = Math.min(chamferDist, halfW, halfD);
    shape.moveTo(-halfW + c, -halfD);
    shape.lineTo(halfW - c, -halfD);
    shape.lineTo(halfW, -halfD + c);
    shape.lineTo(halfW, halfD - c);
    shape.lineTo(halfW - c, halfD);
    shape.lineTo(-halfW + c, halfD);
    shape.lineTo(-halfW, halfD - c);
    shape.lineTo(-halfW, -halfD + c);
    shape.lineTo(-halfW + c, -halfD);
  } else {
    shape.moveTo(-halfW, -halfD);
    shape.lineTo(halfW, -halfD);
    shape.lineTo(halfW, halfD);
    shape.lineTo(-halfW, halfD);
    shape.lineTo(-halfW, -halfD);
  }
  return shape;
}

interface ProceduralProjectComponentProps {
  id: string
  isReference?: boolean
}

export function ProceduralProjectComponent({ id, isReference = false }: ProceduralProjectComponentProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const isFocused = useSpatialStore(state => state.focusedFurnitureId === id)
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay)
  const projects = useSpatialStore(state => state.projects)
  const sketchTimelineIndex = useSpatialStore(state => state.sketchTimelineIndex)
  const isSketchMode = useSpatialStore(state => state.isSketchMode)
  const activeProjectId = useSpatialStore(state => state.activeProjectId)

  const activeDrawMode = useSpatialStore(state => state.activeDrawMode)
  const setSketchWorkingPlane = useSpatialStore(state => state.setSketchWorkingPlane)
  const setCADWorkspaceMode = useSpatialStore(state => state.setCADWorkspaceMode)
  const setSketchDrawMode = useSpatialStore(state => state.setSketchDrawMode)
  const cadWorkspaceMode = useSpatialStore(state => state.cadWorkspaceMode)
  const isExtrudeDialogOpen = useSpatialStore(state => state.isExtrudeDialogOpen)
  const sketchWallHeight = useSpatialStore(state => state.sketchWallHeight)
  const setSketchWallHeight = useSpatialStore(state => state.setSketchWallHeight)
  const selectedBodyId = useSpatialStore(state => state.selectedBodyId)
  const setSelectedBodyId = useSpatialStore(state => state.setSelectedBodyId)

  const [isArrowHovered, setIsArrowHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null!)

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick: (e) => {
      if (activeDrawMode === 'SET_SKETCH_PLANE') {
        e.stopPropagation()
        const normalVec = e.normal ? e.normal.clone() : new THREE.Vector3(0, 1, 0)
        
        // Snap normal vector to closest main axis if it's nearly aligned
        if (Math.abs(normalVec.y) > 0.8) {
          normalVec.set(0, Math.sign(normalVec.y), 0)
        } else if (Math.abs(normalVec.x) > 0.8) {
          normalVec.set(Math.sign(normalVec.x), 0, 0)
        } else if (Math.abs(normalVec.z) > 0.8) {
          normalVec.set(0, 0, Math.sign(normalVec.z))
        }

        const elevation = e.point.y

        setSketchWorkingPlane({
          elevation: elevation,
          normal: [normalVec.x, normalVec.y, normalVec.z],
          faceId: id
        })
        
        setCADWorkspaceMode('2D')
        setSketchDrawMode(null)
        alert(`Active sketch plane set to elevation ${elevation.toFixed(2)} ft.`)
      } else {
        if (!isReference) focusFurniture(id)
      }
    },
    onDoubleClick: () => {
      if (activeDrawMode !== 'SET_SKETCH_PLANE') {
        if (!isReference) setCameraTarget(id)
      }
    },
    doubleClickDelay
  })

  // Get project data
  const project = useMemo(() => {
    if (!furnitureData) {
      if (id === activeProjectId) {
        return projects.find(p => p.id === id) || null
      }
      return null
    }
    const projectId = furnitureData.modelId.replace('project-', '')
    return projects.find(p => p.id === projectId) || null
  }, [furnitureData, projects, id, activeProjectId])

  // Get extruded bodies from active operations
  const activeBodies = useMemo(() => {
    if (!project) return []

    const operations = project.operations || []
    const featureMeta = project.featureMeta || {}
    const activeId = activeProjectId

    const applyRollback = isSketchMode && project.id === activeId
    const sortedOps = [...operations].sort((a, b) => a.createdAt - b.createdAt)
    const activeOps = applyRollback && sketchTimelineIndex !== null && sketchTimelineIndex < sortedOps.length
      ? sortedOps.slice(0, sketchTimelineIndex)
      : sortedOps

    const bodiesList: any[] = []
    activeOps.forEach(op => {
      const isOpSuppressed = featureMeta[op.id]?.suppressed === true
      if (op.toolType === 'EXTRUDE' && !isOpSuppressed && op.params?.outputType === 'component') {
        if (op.params?.bodies) {
          op.params.bodies.forEach((body: any) => {
            bodiesList.push(body)
          })
        }
      }
    })
    return bodiesList
  }, [project, isSketchMode, activeProjectId, sketchTimelineIndex])

  // CSG Evaluator to subtract Cuts from Additive solid bodies
  type Vector3Type = [number, number, number];
  const csgRenderList = useMemo(() => {
    if (activeBodies.length === 0) return []

    const adds = activeBodies.filter(b => b.operation !== 'cut')
    const cuts = activeBodies.filter(b => b.operation === 'cut')

    if (cuts.length === 0) {
      return adds.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        dimensions: b.dimensions as Vector3Type,
        position: b.position as Vector3Type,
        rotation: b.rotation,
        filletRadius: b.filletRadius,
        chamferDist: b.chamferDist,
        geometry: null
      }))
    }

    try {
      const evaluator = new Evaluator()

      return adds.map(addBody => {
        let baseGeom: THREE.BufferGeometry
        const [w, h, d] = addBody.dimensions

        if (addBody.type === 'solid-cylinder') {
          baseGeom = new THREE.CylinderGeometry(w, w, h, 32)
        } else {
          const f = addBody.filletRadius || 0
          const c = addBody.chamferDist || 0
          if (f > 0 || c > 0) {
            const shape = createRoundedOrBeveledBoxShape(w, d, f, c)
            baseGeom = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
            baseGeom.center()
            baseGeom.rotateX(Math.PI / 2)
          } else {
            baseGeom = new THREE.BoxGeometry(w, h, d)
          }
        }

        const lx = addBody.position[0] - (project?.centerX || 0)
        const ly = addBody.position[1] + h / 2
        const lz = addBody.position[2] - (project?.centerZ || 0)
        
        baseGeom.translate(lx, ly, lz)
        if (addBody.rotation) {
          baseGeom.rotateY(addBody.rotation)
        }

        const baseBrush = new Brush(baseGeom)
        let currentBrush = baseBrush

        cuts.forEach(cutBody => {
          const [cw, ch, cd] = cutBody.dimensions
          let cutGeom: THREE.BufferGeometry

          if (cutBody.type === 'solid-cylinder') {
            cutGeom = new THREE.CylinderGeometry(cw, cw, ch, 32)
          } else {
            cutGeom = new THREE.BoxGeometry(cw, ch, cd)
          }

          const clx = cutBody.position[0] - (project?.centerX || 0)
          const cly = cutBody.position[1] + ch / 2
          const clz = cutBody.position[2] - (project?.centerZ || 0)

          cutGeom.translate(clx, cly, clz)
          if (cutBody.rotation) {
            cutGeom.rotateY(cutBody.rotation)
          }

          const cutBrush = new Brush(cutGeom)
          currentBrush = evaluator.evaluate(currentBrush, cutBrush, SUBTRACTION)
          
          cutGeom.dispose()
        })

        const finalGeom = currentBrush.geometry.clone()
        baseGeom.dispose()

        return {
          id: addBody.id,
          name: addBody.name,
          type: addBody.type,
          dimensions: addBody.dimensions as Vector3Type,
          position: addBody.position as Vector3Type,
          rotation: addBody.rotation,
          geometry: finalGeom
        }
      })
    } catch (err) {
      console.warn("CSG Evaluation failed, falling back to primitive rendering", err)
      return adds.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        dimensions: b.dimensions as Vector3Type,
        position: b.position as Vector3Type,
        rotation: b.rotation,
        filletRadius: b.filletRadius,
        chamferDist: b.chamferDist,
        geometry: null
      }))
    }
  }, [activeBodies, project?.centerX, project?.centerZ])

  // Apply operations-based timeline rollback and suppression filters
  const filteredLinesAndCircles = useMemo(() => {
    if (!project) return { lines: [], circles: [] }

    const operations = project.operations || []
    const featureMeta = project.featureMeta || {}
    const activeId = activeProjectId

    // Determine if timeline boundary should be applied (active project under edit)
    const applyRollback = isSketchMode && project.id === activeId
    const sortedOps = [...operations].sort((a, b) => a.createdAt - b.createdAt)
    const activeOps = applyRollback && sketchTimelineIndex !== null && sketchTimelineIndex < sortedOps.length
      ? sortedOps.slice(0, sketchTimelineIndex)
      : sortedOps

    const isEntityVisible = (entityId: string) => {
      const parentOp = sortedOps.find(op => op.entityIds.includes(entityId))
      if (!parentOp) {
        return featureMeta[entityId]?.suppressed !== true
      }
      const isActive = activeOps.some(op => op.id === parentOp.id)
      const isOpSuppressed = featureMeta[parentOp.id]?.suppressed === true
      const isEntitySuppressed = featureMeta[entityId]?.suppressed === true
      return isActive && !isOpSuppressed && !isEntitySuppressed
    }

    return {
      lines: (project.lines || []).filter(l => isEntityVisible(l.id)),
      circles: (project.circles || []).filter(c => isEntityVisible(c.id))
    }
  }, [project, isSketchMode, activeProjectId, sketchTimelineIndex])

  if (!project) return null

  const overallHeight = furnitureData ? furnitureData.dimensions[1] : 10
  const position = furnitureData ? furnitureData.position : ([0, 0, 0] as [number, number, number])
  const rotationY = furnitureData ? (furnitureData.rotation || 0) : 0

  // Opacity & colors
  const opacity = isReference ? 0.05 : 0.2
  const edgeOpacity = isReference ? 0.2 : 0.8
  const fillColor = isReference ? holo.buildingFill : holo.buildingFill
  const edgeColor = isFocused ? holo.selectionEdge : (isReference ? holo.buildingEdge : holo.buildingEdge)

  return (
    <group 
      position={position} 
      rotation={[0, rotationY, 0]} 
      name={`furniture-${id}`} 
      ref={groupRef}
      raycast={isReference ? () => null : undefined}
    >
      {/* Draw Lines as 3D box meshes */}
      {(filteredLinesAndCircles.lines || []).map((line) => {
        const startPt = (project.points || []).find(p => p.id === line.startPointId)
        const endPt = (project.points || []).find(p => p.id === line.endPointId)
        if (!startPt || !endPt) return null

        // Local coordinates relative to project center
        const lx1 = startPt.x - (project.centerX || 0)
        const lz1 = startPt.z - (project.centerZ || 0)
        const lx2 = endPt.x - (project.centerX || 0)
        const lz2 = endPt.z - (project.centerZ || 0)

        const dx = lx2 - lx1
        const dz = lz2 - lz1
        const length = Math.hypot(dx, dz)
        if (length < 0.01) return null

        const mx = (lx1 + lx2) / 2
        const mz = (lz1 + lz2) / 2
        const rotation = Math.atan2(-dz, dx)
        const wallH = typeof line.height === 'number' && !isNaN(line.height) ? Math.max(0.01, line.height) : (overallHeight || 10)
        const wallThickness = typeof line.thickness === 'number' && !isNaN(line.thickness) ? Math.max(0.01, line.thickness) : 0.375

        return (
          <mesh 
            key={line.id} 
            position={[mx, (line.elevation || 0) + wallH / 2, mz]} 
            rotation={[0, rotation, 0]}
            onPointerDown={isReference ? undefined : onPointerDown}
            onPointerUp={isReference ? undefined : onPointerUp}
          >
            <boxGeometry args={[length, wallH, wallThickness]} />
            <meshBasicMaterial 
              color={fillColor} 
              transparent 
              opacity={opacity} 
              depthWrite={false} 
              side={THREE.DoubleSide} 
            />
            <Edges scale={1.0} color={edgeColor} lineWidth={1.5} opacity={edgeOpacity} />
          </mesh>
        )
      })}

      {/* Draw Circles as 3D ring meshes */}
      {(filteredLinesAndCircles.circles || []).map((circle) => {
        const localCX = circle.centerX - (project.centerX || 0)
        const localCZ = circle.centerZ - (project.centerZ || 0)
        const radius = typeof circle.radius === 'number' && !isNaN(circle.radius) ? Math.max(0.01, circle.radius) : 1
        const thickness = typeof circle.thickness === 'number' && !isNaN(circle.thickness) ? Math.max(0.01, circle.thickness) : 0.375
        const wallH = typeof circle.height === 'number' && !isNaN(circle.height) ? Math.max(0.01, circle.height) : (overallHeight || 10)

        // Create shape for extrusion
        const shape = new THREE.Shape()
        const outerR = radius + thickness / 2
        const innerR = Math.max(0.01, radius - thickness / 2)
        shape.absarc(0, 0, outerR, 0, Math.PI * 2, false)
        
        const hole = new THREE.Path()
        hole.absarc(0, 0, innerR, 0, Math.PI * 2, true)
        shape.holes.push(hole)

        return (
          <mesh 
            key={circle.id} 
            position={[localCX, circle.elevation || 0, localCZ]} 
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={isReference ? undefined : onPointerDown}
            onPointerUp={isReference ? undefined : onPointerUp}
          >
            <extrudeGeometry 
              args={[
                shape, 
                {
                  depth: wallH,
                  bevelEnabled: false,
                  steps: 1,
                  curveSegments: 32,
                }
              ]} 
            />
            <meshBasicMaterial 
              color={fillColor} 
              transparent 
              opacity={opacity} 
              depthWrite={false} 
              side={THREE.DoubleSide} 
            />
            {/* Outline the extruded mesh edges */}
            <Edges scale={1.0} color={edgeColor} lineWidth={1.5} opacity={edgeOpacity} />
          </mesh>
        )
      })}

      {/* Draw Extruded Solid Bodies */}
      {csgRenderList.map((body) => {
        const lx = body.position[0] - (project?.centerX || 0)
        const ly = body.position[1]
        const lz = body.position[2] - (project?.centerZ || 0)
        const [w, h, d] = body.dimensions

        const handlePointerDown = (e: any) => {
          if (isSketchMode && cadWorkspaceMode === '3D' && activeDrawMode !== 'SET_SKETCH_PLANE') {
            e.stopPropagation();
            setSelectedBodyId(body.id === selectedBodyId ? null : body.id);
          } else {
            if (isReference) return;
            onPointerDown(e);
          }
        };

        const isBodySelected = selectedBodyId === body.id;
        const currentEdgeColor = isBodySelected ? holo.selectionEdge : edgeColor;
        const currentFillColor = isBodySelected ? 'rgba(34, 211, 238, 0.3)' : fillColor;

        if (body.geometry) {
          return (
            <mesh 
              key={body.id} 
              position={[0, 0, 0]} 
              geometry={body.geometry}
              onPointerDown={handlePointerDown}
              onPointerUp={isReference ? undefined : onPointerUp}
            >
              <meshBasicMaterial 
                color={currentFillColor} 
                transparent 
                opacity={isReference ? 0.05 : 0.85} 
                depthWrite={true} 
                side={THREE.DoubleSide} 
              />
              <Edges scale={1.0} color={currentEdgeColor} lineWidth={1.5} opacity={edgeOpacity} />
            </mesh>
          )
        }

        if (body.type === 'solid-box') {
          const f = body.filletRadius || 0;
          const c = body.chamferDist || 0;

          if (f > 0 || c > 0) {
            return (
              <group key={body.id} position={[lx, ly, lz]} rotation={[-Math.PI / 2, 0, body.rotation || 0]}>
                <mesh 
                  onPointerDown={handlePointerDown}
                  onPointerUp={isReference ? undefined : onPointerUp}
                >
                  <extrudeGeometry 
                    args={[
                      createRoundedOrBeveledBoxShape(w, d, f, c),
                      { depth: h, bevelEnabled: false }
                    ]}
                  />
                  <meshBasicMaterial 
                    color={currentFillColor} 
                    transparent 
                    opacity={isReference ? 0.05 : 0.85} 
                    depthWrite={true} 
                    side={THREE.DoubleSide} 
                  />
                  <Edges scale={1.0} color={currentEdgeColor} lineWidth={1.5} opacity={edgeOpacity} />
                </mesh>
              </group>
            )
          }

          return (
            <mesh 
              key={body.id} 
              position={[lx, ly + h / 2, lz]} 
              rotation={[0, body.rotation || 0, 0]}
              onPointerDown={handlePointerDown}
              onPointerUp={isReference ? undefined : onPointerUp}
            >
              <boxGeometry args={[w, h, d]} />
              <meshBasicMaterial 
                color={currentFillColor} 
                transparent 
                opacity={isReference ? 0.05 : 0.85} 
                depthWrite={true} 
                side={THREE.DoubleSide} 
              />
              <Edges scale={1.0} color={currentEdgeColor} lineWidth={1.5} opacity={edgeOpacity} />
            </mesh>
          )
        } else if (body.type === 'solid-cylinder') {
          return (
            <mesh 
              key={body.id} 
              position={[lx, ly + h / 2, lz]} 
              rotation={[0, body.rotation || 0, 0]}
              onPointerDown={handlePointerDown}
              onPointerUp={isReference ? undefined : onPointerUp}
            >
              <cylinderGeometry args={[w, w, h, 32]} />
              <meshBasicMaterial 
                color={currentFillColor} 
                transparent 
                opacity={isReference ? 0.05 : 0.85} 
                depthWrite={true} 
                side={THREE.DoubleSide} 
              />
              <Edges scale={1.0} color={currentEdgeColor} lineWidth={1.5} opacity={edgeOpacity} />
            </mesh>
          )
        }
        return null
      })}

      {/* 3D Interactive Extrude Handle (Arrow) */}
      {isSketchMode && cadWorkspaceMode === '3D' && isExtrudeDialogOpen && id === activeProjectId && (() => {
        const arrowHeight = Math.max(0.1, sketchWallHeight);

        const handlePointerDown = (e: any) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          (window as any).__draggingArrow = true;
          (window as any).__initialMouseY = e.clientY;
          (window as any).__initialHeight = arrowHeight;
        };

        const handlePointerMove = (e: any) => {
          if ((window as any).__draggingArrow) {
            e.stopPropagation();
            const deltaY = ((window as any).__initialMouseY - e.clientY) * 0.05; // 0.05 ft per pixel
            const newHeight = Math.max(0.1, Number(((window as any).__initialHeight + deltaY).toFixed(1)));
            setSketchWallHeight(newHeight);
          }
        };

        const handlePointerUp = (e: any) => {
          if ((window as any).__draggingArrow) {
            e.stopPropagation();
            (window as any).__draggingArrow = false;
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          }
        };

        return (
          <group 
            position={[0, arrowHeight, 0]}
            onPointerOver={() => setIsArrowHovered(true)}
            onPointerOut={() => setIsArrowHovered(false)}
          >
            {/* Arrow Head (Cone) */}
            <mesh
              position={[0, 0.4, 0]}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <coneGeometry args={[isArrowHovered ? 0.25 : 0.2, 0.6, 16]} />
              <meshBasicMaterial color={isArrowHovered ? '#67e8f9' : '#22d3ee'} depthTest={false} transparent opacity={0.9} />
            </mesh>

            {/* Arrow Shaft (Cylinder) */}
            <mesh
              position={[0, 0, 0]}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <cylinderGeometry args={[isArrowHovered ? 0.06 : 0.04, isArrowHovered ? 0.06 : 0.04, 0.8, 8]} />
              <meshBasicMaterial color={isArrowHovered ? '#67e8f9' : '#22d3ee'} depthTest={false} transparent opacity={0.9} />
            </mesh>

            {/* Glowing guide line down to origin */}
            <mesh position={[0, -arrowHeight / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, arrowHeight, 4]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.3} depthTest={false} />
            </mesh>
          </group>
        );
      })()}
    </group>
  )
}
