import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSpatialStore, snapPoint } from '@aura/state-store'
import type { SketchPoint, SketchAlignmentGuide } from '@aura/state-store'

export function SketchOverlay3D() {
  const isSketchMode = useSpatialStore(state => state.isSketchMode)
  const cadWorkspaceMode = useSpatialStore(state => state.cadWorkspaceMode)
  const activeDrawMode = useSpatialStore(state => state.activeDrawMode)
  const unfilteredPoints = useSpatialStore(state => state.sketchPoints)
  const unfilteredLines = useSpatialStore(state => state.sketchLines)
  const unfilteredCircles = useSpatialStore(state => state.sketchCircles) || []
  const unfilteredLabels = useSpatialStore(state => state.sketchLabels) || []
  const sketchTimelineIndex = useSpatialStore(state => state.sketchTimelineIndex)
  const sketchFeatureMeta = useSpatialStore(state => state.sketchFeatureMeta) || {}
  const sketchOperations = useSpatialStore(state => state.sketchOperations) || []
  const hoveredSketchOperationId = useSpatialStore(state => state.hoveredSketchOperationId)

  // Apply timeline rollback and operation suppression filter
  const { sketchPoints, sketchLines, sketchCircles, sketchLabels } = useMemo(() => {
    const sortedOps = [...sketchOperations].sort((a, b) => a.createdAt - b.createdAt);
    const activeOps = sketchTimelineIndex === null || sketchTimelineIndex >= sortedOps.length
      ? sortedOps
      : sortedOps.slice(0, sketchTimelineIndex);

    const isEntityVisible = (entityId: string) => {
      const parentOp = sortedOps.find(op => op.entityIds.includes(entityId));
      if (!parentOp) {
        return sketchFeatureMeta[entityId]?.suppressed !== true;
      }
      const isActive = activeOps.some(op => op.id === parentOp.id);
      const isOpSuppressed = sketchFeatureMeta[parentOp.id]?.suppressed === true;
      const isEntitySuppressed = sketchFeatureMeta[entityId]?.suppressed === true;
      return isActive && !isOpSuppressed && !isEntitySuppressed;
    };

    return {
      sketchPoints: (unfilteredPoints || []).filter(p => isEntityVisible(p.id)),
      sketchLines: (unfilteredLines || []).filter(l => isEntityVisible(l.id)),
      sketchCircles: (unfilteredCircles || []).filter(c => isEntityVisible(c.id)),
      sketchLabels: (unfilteredLabels || []).filter(lbl => isEntityVisible(lbl.id))
    };
  }, [unfilteredPoints, unfilteredLines, unfilteredCircles, unfilteredLabels, sketchOperations, sketchTimelineIndex, sketchFeatureMeta]);

  // Compute hovered entity IDs from the hovered operation
  const hoveredOperationEntityIds = useMemo(() => {
    if (!hoveredSketchOperationId) return new Set<string>();
    const op = sketchOperations.find(o => o.id === hoveredSketchOperationId);
    return op ? new Set(op.entityIds) : new Set<string>();
  }, [hoveredSketchOperationId, sketchOperations]);
  const sketchStartPointId = useSpatialStore(state => state.sketchStartPointId)
  const sketchCurrentPoint = useSpatialStore(state => state.sketchCurrentPoint)
  const isSnappingEnabled = useSpatialStore(state => state.isSnappingEnabled)

  const selectedPointId = useSpatialStore(state => state.selectedPointId)
  const selectedLineId = useSpatialStore(state => state.selectedLineId)
  const selectedCircleId = useSpatialStore(state => state.selectedCircleId)
  const selectedLabelId = useSpatialStore(state => state.selectedLabelId)
  const hoveredSketchItemId = useSpatialStore(state => state.hoveredSketchItemId)
  const sketchWorkingPlane = useSpatialStore(state => state.sketchWorkingPlane)

  const addSketchPoint = useSpatialStore(state => state.addSketchPoint)
  const addSketchLine = useSpatialStore(state => state.addSketchLine)
  const addSketchCircle = useSpatialStore(state => state.addSketchCircle)
  const addSketchLabel = useSpatialStore(state => state.addSketchLabel)
  const setSketchStartPointId = useSpatialStore(state => state.setSketchStartPointId)
  const setSketchCurrentPoint = useSpatialStore(state => state.setSketchCurrentPoint)
  const removeSketchPoint = useSpatialStore(state => state.removeSketchPoint)
  const removeSketchLine = useSpatialStore(state => state.removeSketchLine)
  const removeSketchCircle = useSpatialStore(state => state.removeSketchCircle)
  const removeSketchLabel = useSpatialStore(state => state.removeSketchLabel)
  const updateSketchPointPosition = useSpatialStore(state => state.updateSketchPointPosition)
  const updateSketchCircleProperty = useSpatialStore(state => state.updateSketchCircleProperty)
  const setSelectedPointId = useSpatialStore(state => state.setSelectedPointId)
  const setSelectedLineId = useSpatialStore(state => state.setSelectedLineId)
  const setSelectedCircleId = useSpatialStore(state => state.setSelectedCircleId)
  const setSelectedLabelId = useSpatialStore(state => state.setSelectedLabelId)
  const setSketchDrawMode = useSpatialStore(state => state.setSketchDrawMode)
  const clearSketch = useSpatialStore(state => state.clearSketch)

  const { raycaster, camera, gl } = useThree()
  const plane = useMemo(() => {
    const normal = sketchWorkingPlane?.normal ? new THREE.Vector3(...sketchWorkingPlane.normal) : new THREE.Vector3(0, 1, 0)
    const normalVec = normal.clone().normalize()
    const coplanarPoint = normalVec.clone().multiplyScalar(sketchWorkingPlane?.elevation ?? 0)
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normalVec, coplanarPoint)
  }, [sketchWorkingPlane])
  const intersection = useMemo(() => new THREE.Vector3(), [])

  // Local drag state
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null)
  // Local alignment guides
  const [activeGuides, setActiveGuides] = useState<SketchAlignmentGuide[]>([])
  // Local temporary points for multi-click curves (Arc, Ellipse, Spline)
  const [tempPoints, setTempPoints] = useState<[number, number][]>([])
  // Hover states
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null)
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null)
  const [hoveredCircleId, setHoveredCircleId] = useState<string | null>(null)

  // Local locked points and constraint selections
  const [lockedPoints, setLockedPoints] = useState<Set<string>>(new Set())
  const [constraintSelection, setConstraintSelection] = useState<Array<{ type: 'point' | 'line' | 'circle'; id: string }>>([])

  // Reset constraint selection and temp points on mode change
  useEffect(() => {
    setConstraintSelection([])
    setTempPoints([])
  }, [activeDrawMode])

  // Handle immediate workspace actions
  useEffect(() => {
    if (!activeDrawMode) return

    if (activeDrawMode === 'FILE_NEW') {
      if (confirm('Are you sure you want to initialize a new blank sketch? This will clear all current entities.')) {
        clearSketch()
      }
      setSketchDrawMode(null)
    } else if (activeDrawMode === 'FILE_CLONE') {
      alert('Sketch successfully cloned to reference layer.')
      setSketchDrawMode(null)
    } else if (activeDrawMode === 'FILE_SAVE') {
      alert('Sketch successfully saved to database.')
      setSketchDrawMode(null)
    } else if (activeDrawMode === 'FILE_EXPORT') {
      alert('Exporting sketch profile layout in CAD format (DXF/SVG/PDF)...')
      setSketchDrawMode(null)
    } else if (activeDrawMode === 'VIEW_FIT') {
      alert('Recalculated camera projection viewport bounds. Fit to screen.')
      setSketchDrawMode(null)
    }
  }, [activeDrawMode, clearSketch, setSketchDrawMode])

  // Dimension HUD Input State
  const [dimensionInput, setDimensionInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Fusion 360 style HUD Locks & focus states
  const [hudFocus, setHudFocus] = useState<'length' | 'angle'>('length')
  const [lengthInput, setLengthInput] = useState('')
  const [angleInput, setAngleInput] = useState('')
  const [lockedLength, setLockedLength] = useState<number | null>(null)
  const [lockedAngle, setLockedAngle] = useState<number | null>(null)

  const lengthInputRef = useRef<HTMLInputElement>(null)
  const angleInputRef = useRef<HTMLInputElement>(null)

  // Colors based on Hologram Theme
  const buildingEdge = '#cffafe'
  const selectionEdge = '#ffffff'
  const snapGuideColor = '#fb7185'
  const hoverEdge = '#22d3ee'

  // Reference line segment and angle for relative measurement
  const startPt = sketchStartPointId ? sketchPoints.find(p => p.id === sketchStartPointId) : null
  const currentLength = startPt && sketchCurrentPoint
    ? Math.hypot(sketchCurrentPoint[0] - startPt.x, sketchCurrentPoint[1] - startPt.z)
    : 0

  const prevLine = useMemo(() => {
    if (!startPt || (activeDrawMode !== 'LINE' && activeDrawMode !== 'MULTI_LINE')) return null
    const candidates = sketchLines.filter(l => l.startPointId === startPt.id || l.endPointId === startPt.id)
    if (candidates.length === 0) return null
    return candidates[candidates.length - 1]
  }, [startPt, sketchLines, activeDrawMode])

  const prevLineAngleInward = useMemo(() => {
    if (!prevLine || !startPt) return 0
    const otherPtId = prevLine.startPointId === startPt.id ? prevLine.endPointId : prevLine.startPointId
    const otherPt = sketchPoints.find(p => p.id === otherPtId)
    if (!otherPt) return 0
    // Vector pointing inwards to otherPt (along the old line)
    const dx = otherPt.x - startPt.x
    const dz = otherPt.z - startPt.z
    return Math.atan2(-dz, dx)
  }, [prevLine, startPt, sketchPoints])

  // Sync cursor position and snapped guides globally
  useEffect(() => {
    if (!isSketchMode) return

    const handlePointerMoveGlobal = (e: PointerEvent) => {
      // Find coordinates on ground plane
      const rect = gl.domElement.getBoundingClientRect()
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera)
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        let x = intersection.x
        let z = intersection.z

        const startPtId = draggingPointId ? null : sketchStartPointId
        const startPt = startPtId ? sketchPoints.find(p => p.id === startPtId) : null

        // Apply locks if drawing a line
        if (startPt && (activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE')) {
          const dx_raw = x - startPt.x
          const dz_raw = z - startPt.z
          const raw_len = Math.hypot(dx_raw, dz_raw)
          const raw_angle_rad = Math.atan2(-dz_raw, dx_raw)
          
          // Reference angle: point along the old line (inward) if it exists, or 0 (global +X)
          const refAngle = prevLine ? prevLineAngleInward : 0
          const rel_angle_rad = Math.atan2(Math.sin(raw_angle_rad - refAngle), Math.cos(raw_angle_rad - refAngle))
          const rel_angle_deg = Math.abs(rel_angle_rad * 180 / Math.PI) // 0 to 180 interior angle
          const cursorSign = Math.sign(rel_angle_rad) || 1

          let finalRelAngleDeg = rel_angle_deg
          if (lockedAngle !== null) {
            finalRelAngleDeg = lockedAngle
          } else {
            // Apply 10-degree snap increment
            const snapInterval = 10
            const snappedRelAngle = Math.round(rel_angle_deg / snapInterval) * snapInterval
            const diff = Math.abs(rel_angle_deg - snappedRelAngle)
            if (diff < 3) {
              finalRelAngleDeg = snappedRelAngle
            }
          }

          let finalLength = raw_len
          if (lockedLength !== null) {
            finalLength = Math.max(0.01, lockedLength)
          }

          const finalGlobalAngleRad = refAngle + (cursorSign * finalRelAngleDeg * Math.PI / 180)
          x = startPt.x + finalLength * Math.cos(finalGlobalAngleRad)
          z = startPt.z - finalLength * Math.sin(finalGlobalAngleRad)
        }

        const hasLock = (lockedAngle !== null || lockedLength !== null) && (activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE')
        const { point, alignmentGuides } = snapPoint(
          x,
          z,
          sketchPoints,
          startPtId,
          isSnappingEnabled && !hasLock
        )

        setSketchCurrentPoint(point)
        setActiveGuides(alignmentGuides)

        // If dragging, update the active point position
        if (draggingPointId && !lockedPoints.has(draggingPointId)) {
          updateSketchPointPosition(draggingPointId, point[0], point[1])
        }
      }
    }

    const handlePointerUpGlobal = () => {
      if (draggingPointId) {
        setDraggingPointId(null)
        setActiveGuides([])
      }
    }

    window.addEventListener('pointermove', handlePointerMoveGlobal)
    window.addEventListener('pointerup', handlePointerUpGlobal)
    return () => {
      window.removeEventListener('pointermove', handlePointerMoveGlobal)
      window.removeEventListener('pointerup', handlePointerUpGlobal)
    }
  }, [
    isSketchMode,
    draggingPointId,
    sketchStartPointId,
    sketchPoints,
    isSnappingEnabled,
    camera,
    gl,
    raycaster,
    plane,
    intersection,
    setSketchCurrentPoint,
    updateSketchPointPosition,
    activeDrawMode,
    lockedAngle,
    lockedLength,
    prevLine,
    prevLineAngleInward,
  ])

  // Key shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSketchMode) return

      // Escape key cancels drawing or selection and should always be processed,
      // even if an input field is currently focused (like the dimension input)
      if (e.key === 'Escape') {
        if (activeDrawMode) {
          e.preventDefault()
          setSketchDrawMode(null)
        }
        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
        setSelectedPointId(null)
        setSelectedLineId(null)
        setSelectedCircleId(null)
        setSelectedLabelId(null)
        setTempPoints([])
        setDimensionInput('')
        setLockedLength(null)
        setLockedAngle(null)
        setLengthInput('')
        setAngleInput('')
        setHudFocus('length')
        if (lengthInputRef.current) lengthInputRef.current.blur()
        if (angleInputRef.current) angleInputRef.current.blur()
        if (inputRef.current) inputRef.current.blur()
        return
      }

      // Ignore shortcuts if user is typing in inputs (e.g. dimensions)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

      const key = e.key.toLowerCase()

      // Mode switching shortcuts (Fusion 360 style)
      if (key === 'l') {
        e.preventDefault()
        setSketchDrawMode('LINE')
        return
      } else if (key === 'r') {
        e.preventDefault()
        setSketchDrawMode('RECTANGLE')
        return
      } else if (key === 'c') {
        e.preventDefault()
        if (e.altKey) {
          setSketchDrawMode('COLLINEAR')
        } else {
          setSketchDrawMode('CIRCLE')
        }
        return
      } else if (key === 'a') {
        e.preventDefault()
        setSketchDrawMode('ARC')
        return
      } else if (key === 'e') {
        e.preventDefault()
        setSketchDrawMode('ELLIPSE')
        return
      } else if (key === 's') {
        e.preventDefault()
        if (e.altKey) {
          setSketchDrawMode('SYMMETRIC')
        } else {
          setSketchDrawMode('SPLINE')
        }
        return
      } else if (key === 'p') {
        e.preventDefault()
        setSketchDrawMode('POINT')
        return
      } else if (key === 'f') {
        e.preventDefault()
        if (e.altKey) {
          setSketchDrawMode('CHAMFER')
        } else {
          setSketchDrawMode('FILLET')
        }
        return
      } else if (key === 't') {
        e.preventDefault()
        if (e.altKey) {
          setSketchDrawMode('EXTEND')
        } else {
          setSketchDrawMode('TRIM')
        }
        return
      } else if (key === 'o') {
        e.preventDefault()
        setSketchDrawMode('OFFSET')
        return
      } else if (key === 'm') {
        e.preventDefault()
        if (e.altKey) {
          setSketchDrawMode('MIRROR')
        } else {
          setSketchDrawMode('MIDPOINT')
        }
        return
      } else if (key === 'i') {
        e.preventDefault()
        setSketchDrawMode('COINCIDENT')
        return
      } else if (key === 'k') {
        e.preventDefault()
        setSketchDrawMode('CONCENTRIC')
        return
      } else if (key === 'x') {
        e.preventDefault()
        setSketchDrawMode('LOCK')
        return
      } else if (key === 'h') {
        e.preventDefault()
        setSketchDrawMode('HORIZONTAL_VERTICAL')
        return
      } else if (key === 'v') {
        e.preventDefault()
        setSketchDrawMode('VERTICAL')
        return
      } else if (key === 'g') {
        e.preventDefault()
        setSketchDrawMode('TANGENT')
        return
      } else if (key === 'q') {
        e.preventDefault()
        setSketchDrawMode('EQUAL')
        return
      } else if (key === 'd') {
        e.preventDefault()
        setSketchDrawMode('DIMENSION')
        return
      }

      // Toggle HUD fields in LINE mode
      if (e.key === 'Tab') {
        if (sketchStartPointId && activeDrawMode === 'LINE') {
          e.preventDefault()
          setHudFocus(prev => prev === 'length' ? 'angle' : 'length')
        }
      } else if (e.key === 'n' || e.key === 'N') {
        // Toggle focus with 'n' ONLY if we aren't typing inside an input
        if (sketchStartPointId && activeDrawMode === 'LINE') {
          e.preventDefault()
          setHudFocus(prev => prev === 'length' ? 'angle' : 'length')
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPointId) {
          removeSketchPoint(selectedPointId)
          setSelectedPointId(null)
        } else if (selectedLineId) {
          removeSketchLine(selectedLineId)
          setSelectedLineId(null)
        } else if (selectedCircleId) {
          removeSketchCircle(selectedCircleId)
          setSelectedCircleId(null)
        } else if (selectedLabelId) {
          removeSketchLabel(selectedLabelId)
          setSelectedLabelId(null)
        }
      } else if (e.key === 'Enter') {
        if (activeDrawMode === 'SPLINE' && tempPoints.length >= 2) {
          e.preventDefault()
          const splPts = calculateSplinePoints(tempPoints)
          if (splPts.length > 1) {
            let prevPtId = addSketchPoint(splPts[0][0], splPts[0][1])
            for (let i = 1; i < splPts.length; i++) {
              const curPtId = addSketchPoint(splPts[i][0], splPts[i][1])
              addSketchLine(prevPtId, curPtId)
              prevPtId = curPtId
            }
          }
          setTempPoints([])
          setSketchStartPointId(null)
          setSketchCurrentPoint(null)
          setSketchDrawMode(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isSketchMode,
    selectedPointId,
    selectedLineId,
    selectedCircleId,
    selectedLabelId,
    sketchStartPointId,
    activeDrawMode,
    tempPoints,
    removeSketchPoint,
    removeSketchLine,
    removeSketchCircle,
    removeSketchLabel,
    setSketchStartPointId,
    setSketchCurrentPoint,
    setSelectedPointId,
    setSelectedLineId,
    setSelectedCircleId,
    setSelectedLabelId,
    setSketchDrawMode,
    addSketchPoint,
    addSketchLine
  ])

  // Manage focusing of inputs when hudFocus changes
  useEffect(() => {
    if (!sketchStartPointId || (activeDrawMode !== 'LINE' && activeDrawMode !== 'MULTI_LINE')) return
    
    if (hudFocus === 'length') {
      lengthInputRef.current?.focus()
      lengthInputRef.current?.select()
    } else if (hudFocus === 'angle') {
      angleInputRef.current?.focus()
      angleInputRef.current?.select()
    }
  }, [hudFocus, sketchStartPointId, activeDrawMode])

  // Auto-focus dimension input when typing numbers
  useEffect(() => {
    const handleKeyPressFocus = (e: KeyboardEvent) => {
      if (!isSketchMode || !sketchStartPointId) return
      if (document.activeElement?.tagName === 'INPUT') return

      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        if (activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE') {
          if (hudFocus === 'length') {
            lengthInputRef.current?.focus()
          } else {
            angleInputRef.current?.focus()
          }
        } else {
          if (inputRef.current) {
            inputRef.current.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyPressFocus)
    return () => window.removeEventListener('keydown', handleKeyPressFocus)
  }, [isSketchMode, sketchStartPointId, activeDrawMode, hudFocus])



  const arcPoints = useMemo(() => {
    if (!startPt || !sketchCurrentPoint || (activeDrawMode !== 'LINE' && activeDrawMode !== 'MULTI_LINE')) return []
    const dx = sketchCurrentPoint[0] - startPt.x
    const dz = sketchCurrentPoint[1] - startPt.z
    const len = Math.hypot(dx, dz)
    if (len < 0.1) return []

    const angleRad = Math.atan2(-dz, dx)
    const arcRadius = Math.min(2.0, len * 0.4)
    const pts: [number, number, number][] = []
    const segments = 32

    // Sweep from prevLineAngleInward to current angle
    const startAngle = prevLine ? prevLineAngleInward : 0
    const diffRad = Math.atan2(Math.sin(angleRad - startAngle), Math.cos(angleRad - startAngle))
    const elev = sketchWorkingPlane?.elevation ?? 0

    for (let i = 0; i <= segments; i++) {
      const a = startAngle + (diffRad * i) / segments
      pts.push([
        startPt.x + arcRadius * Math.cos(a),
        elev + 0.045,
        startPt.z - arcRadius * Math.sin(a)
      ])
    }
    return pts
  }, [startPt, sketchCurrentPoint, activeDrawMode, prevLine, prevLineAngleInward, sketchWorkingPlane])

  if (!isSketchMode || cadWorkspaceMode !== '2D') return null

  const handleGroundClick = () => {
    if (!activeDrawMode || !sketchCurrentPoint) return

    const [snappedX, snappedZ] = sketchCurrentPoint

    if (activeDrawMode === 'POINT') {
      addSketchPoint(snappedX, snappedZ)
      return
    }

    if (activeDrawMode === 'ADD_LABEL') {
      const text = prompt('Enter annotation label text:')
      if (text && text.trim()) {
        addSketchLabel(snappedX, snappedZ, text.trim())
      }
      setSketchDrawMode(null)
      return
    }

    // Check if clicked near an existing point
    const SNAP_THRESHOLD = 0.4
    let matchedPoint: SketchPoint | undefined = undefined
    for (const pt of sketchPoints) {
      if (Math.hypot(snappedX - pt.x, snappedZ - pt.z) < SNAP_THRESHOLD) {
        matchedPoint = pt
        break
      }
    }

    if (activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE') {
      if (!sketchStartPointId) {
        // Start a new line
        const newPtId = matchedPoint ? matchedPoint.id : addSketchPoint(snappedX, snappedZ)
        setSketchStartPointId(newPtId)
      } else {
        // Complete the segment
        const endPtId = matchedPoint ? matchedPoint.id : addSketchPoint(snappedX, snappedZ)
        if (endPtId !== sketchStartPointId) {
          addSketchLine(sketchStartPointId, endPtId)
          // Chain it
          setSketchStartPointId(endPtId)
        }
        // Reset constraints for the next chained segment
        setLockedLength(null)
        setLockedAngle(null)
        setLengthInput('')
        setAngleInput('')
        setHudFocus('length')
      }
    } else if (activeDrawMode === 'RECTANGLE') {
      if (!sketchStartPointId) {
        // Start Corner
        const newPtId = matchedPoint ? matchedPoint.id : addSketchPoint(snappedX, snappedZ)
        setSketchStartPointId(newPtId)
      } else {
        // Opposite Corner - create 4 points and 4 lines
        const endX = snappedX
        const endZ = snappedZ
        const startX = startPt!.x
        const startZ = startPt!.z

        const p1Id = sketchStartPointId
        const p2Id = addSketchPoint(endX, startZ)
        const p3Id = addSketchPoint(endX, endZ)
        const p4Id = addSketchPoint(startX, endZ)

        addSketchLine(p1Id!, p2Id)
        addSketchLine(p2Id, p3Id)
        addSketchLine(p3Id, p4Id)
        addSketchLine(p4Id, p1Id!)

        // Complete rectangle
        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
      }
    } else if (activeDrawMode === 'CIRCLE') {
      if (!sketchStartPointId) {
        // Center Point
        const newPtId = matchedPoint ? matchedPoint.id : addSketchPoint(snappedX, snappedZ)
        setSketchStartPointId(newPtId)
      } else {
        // Radius Point - add parametric circle
        const radius = Math.hypot(snappedX - startPt!.x, snappedZ - startPt!.z)
        if (radius > 0.1) {
          const center = startPt!
          addSketchCircle(center.x, center.z, radius)
          // Remove the construction center point
          removeSketchPoint(center.id)
        }
        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
      }
    } else if (activeDrawMode === 'ARC') {
      const nextTemp = [...tempPoints, [snappedX, snappedZ] as [number, number]]
      if (nextTemp.length === 1) {
        setTempPoints(nextTemp)
        // Add visual anchor point
        const ptId = addSketchPoint(snappedX, snappedZ)
        setSketchStartPointId(ptId)
      } else if (nextTemp.length === 2) {
        setTempPoints(nextTemp)
        addSketchPoint(snappedX, snappedZ)
      } else if (nextTemp.length === 3) {
        // Compute 3-Point Arc
        const arcPts = calculateThreePointArc(nextTemp[0], nextTemp[1], nextTemp[2])
        if (arcPts && arcPts.length > 1) {
          let prevPtId = addSketchPoint(arcPts[0][0], arcPts[0][1])
          for (let i = 1; i < arcPts.length; i++) {
            const curPtId = addSketchPoint(arcPts[i][0], arcPts[i][1])
            addSketchLine(prevPtId, curPtId)
            prevPtId = curPtId
          }
        } else {
          // Fallback: straight lines
          const p1 = addSketchPoint(nextTemp[0][0], nextTemp[0][1])
          const p2 = addSketchPoint(nextTemp[1][0], nextTemp[1][1])
          const p3 = addSketchPoint(nextTemp[2][0], nextTemp[2][1])
          addSketchLine(p1, p2)
          addSketchLine(p2, p3)
        }
        setTempPoints([])
        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
      }
    } else if (activeDrawMode === 'ELLIPSE' || activeDrawMode === 'ELLIPSE_ARC') {
      const nextTemp = [...tempPoints, [snappedX, snappedZ] as [number, number]]
      if (nextTemp.length === 1) {
        setTempPoints(nextTemp)
        const ptId = addSketchPoint(snappedX, snappedZ)
        setSketchStartPointId(ptId)
      } else if (nextTemp.length === 2) {
        setTempPoints(nextTemp)
        addSketchPoint(snappedX, snappedZ)
      } else if (nextTemp.length === 3) {
        // Compute Ellipse or Elliptical Arc
        const elPts = calculateEllipsePoints(nextTemp[0], nextTemp[1], nextTemp[2], activeDrawMode === 'ELLIPSE_ARC')
        if (elPts.length > 1) {
          let prevPtId = addSketchPoint(elPts[0][0], elPts[0][1])
          const startPtId = prevPtId
          for (let i = 1; i < elPts.length; i++) {
            const curPtId = addSketchPoint(elPts[i][0], elPts[i][1])
            addSketchLine(prevPtId, curPtId)
            prevPtId = curPtId
          }
          if (activeDrawMode === 'ELLIPSE') {
            addSketchLine(prevPtId, startPtId)
          }
        }
        setTempPoints([])
        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
      }
    } else if (activeDrawMode === 'SPLINE') {
      const nextTemp = [...tempPoints, [snappedX, snappedZ] as [number, number]]
      setTempPoints(nextTemp)
      const ptId = addSketchPoint(snappedX, snappedZ)
      setSketchStartPointId(ptId)
    }
  }

  const handleEntityClick = (type: 'point' | 'line' | 'circle', id: string) => {
    if (!activeDrawMode) return

    // 1. Single click immediate actions
    if (activeDrawMode === 'TRIM') {
      if (type === 'point') removeSketchPoint(id)
      else if (type === 'line') removeSketchLine(id)
      else if (type === 'circle') removeSketchCircle(id)
      return
    }

    if (activeDrawMode === 'LOCK') {
      if (type === 'point') {
        setLockedPoints(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
      return
    }

    if (activeDrawMode === 'HORIZONTAL') {
      if (type === 'line') {
        const line = sketchLines.find(l => l.id === id)
        if (line) {
          const start = sketchPoints.find(p => p.id === line.startPointId)
          const end = sketchPoints.find(p => p.id === line.endPointId)
          if (start && end) {
            updateSketchPointPosition(line.endPointId, end.x, start.z)
          }
        }
      }
      return
    }

    if (activeDrawMode === 'VERTICAL') {
      if (type === 'line') {
        const line = sketchLines.find(l => l.id === id)
        if (line) {
          const start = sketchPoints.find(p => p.id === line.startPointId)
          const end = sketchPoints.find(p => p.id === line.endPointId)
          if (start && end) {
            updateSketchPointPosition(line.endPointId, start.x, end.z)
          }
        }
      }
      return
    }

    if (activeDrawMode === 'HORIZONTAL_VERTICAL') {
      if (type === 'line') {
        const line = sketchLines.find(l => l.id === id)
        if (line) {
          const start = sketchPoints.find(p => p.id === line.startPointId)
          const end = sketchPoints.find(p => p.id === line.endPointId)
          if (start && end) {
            const dx = Math.abs(end.x - start.x)
            const dz = Math.abs(end.z - start.z)
            if (dx > dz) {
              updateSketchPointPosition(line.endPointId, end.x, start.z)
            } else {
              updateSketchPointPosition(line.endPointId, start.x, end.z)
            }
          }
        }
      }
      return
    }

    if (activeDrawMode === 'OFFSET') {
      if (type === 'line') {
        const line = sketchLines.find(l => l.id === id)
        if (line) {
          const start = sketchPoints.find(p => p.id === line.startPointId)
          const end = sketchPoints.find(p => p.id === line.endPointId)
          if (start && end) {
            const dx = end.x - start.x
            const dz = end.z - start.z
            const len = Math.hypot(dx, dz)
            if (len > 0.01) {
              const nx = -dz / len
              const nz = dx / len
              const offsetPt1 = addSketchPoint(start.x + nx * 1.0, start.z + nz * 1.0)
              const offsetPt2 = addSketchPoint(end.x + nx * 1.0, end.z + nz * 1.0)
              addSketchLine(offsetPt1, offsetPt2)
            }
          }
        }
      } else if (type === 'circle') {
        const circle = sketchCircles.find(c => c.id === id)
        if (circle) {
          addSketchCircle(circle.centerX, circle.centerZ, circle.radius + 1.0)
        }
      }
      return
    }

    if (activeDrawMode === 'EXTEND') {
      if (type === 'line') {
        const line = sketchLines.find(l => l.id === id)
        if (line) {
          const start = sketchPoints.find(p => p.id === line.startPointId)
          const end = sketchPoints.find(p => p.id === line.endPointId)
          if (start && end) {
            const dx = end.x - start.x
            const dz = end.z - start.z
            updateSketchPointPosition(line.endPointId, end.x + dx * 0.3, end.z + dz * 0.3)
          }
        }
      }
      return
    }

    if (activeDrawMode === 'FILLET' || activeDrawMode === 'CHAMFER') {
      if (type === 'point') {
        const lines = sketchLines.filter(l => l.startPointId === id || l.endPointId === id)
        if (lines.length === 2) {
          const l1 = lines[0]
          const l2 = lines[1]
          const p = sketchPoints.find(pt => pt.id === id)
          if (p) {
            const p1_other_id = l1.startPointId === id ? l1.endPointId : l1.startPointId
            const p2_other_id = l2.startPointId === id ? l2.endPointId : l2.startPointId
            const p1_other = sketchPoints.find(pt => pt.id === p1_other_id)
            const p2_other = sketchPoints.find(pt => pt.id === p2_other_id)
            if (p1_other && p2_other) {
              const dx1 = p1_other.x - p.x
              const dz1 = p1_other.z - p.z
              const len1 = Math.hypot(dx1, dz1)
              const dx2 = p2_other.x - p.x
              const dz2 = p2_other.z - p.z
              const len2 = Math.hypot(dx2, dz2)
              const fLen = Math.min(0.5, len1 * 0.4, len2 * 0.4)

              if (fLen > 0.05) {
                const filletPt1_x = p.x + (dx1 / len1) * fLen
                const filletPt1_z = p.z + (dz1 / len1) * fLen
                const filletPt2_x = p.x + (dx2 / len2) * fLen
                const filletPt2_z = p.z + (dz2 / len2) * fLen

                removeSketchLine(l1.id)
                removeSketchLine(l2.id)
                removeSketchPoint(id)

                const fPt1Id = addSketchPoint(filletPt1_x, filletPt1_z)
                const fPt2Id = addSketchPoint(filletPt2_x, filletPt2_z)

                addSketchLine(p1_other_id, fPt1Id)
                addSketchLine(p2_other_id, fPt2Id)

                if (activeDrawMode === 'FILLET') {
                  const filletCenter_x = (filletPt1_x + filletPt2_x) / 2 - (p.x - (filletPt1_x + filletPt2_x) / 2) * 0.1
                  const filletCenter_z = (filletPt1_z + filletPt2_z) / 2 - (p.z - (filletPt1_z + filletPt2_z) / 2) * 0.1
                  const fMidPtId = addSketchPoint(filletCenter_x, filletCenter_z)
                  addSketchLine(fPt1Id, fMidPtId)
                  addSketchLine(fMidPtId, fPt2Id)
                } else {
                  addSketchLine(fPt1Id, fPt2Id)
                }
              }
            }
          }
        }
      }
      return
    }

    // 2. Multi-step selection constraints
    const selection = [...constraintSelection, { type, id }]
    setConstraintSelection(selection)

    if (activeDrawMode === 'COINCIDENT') {
      if (selection.length === 2) {
        if (selection[0].type === 'point' && selection[1].type === 'point') {
          const p1 = sketchPoints.find(p => p.id === selection[0].id)
          if (p1) {
            updateSketchPointPosition(selection[1].id, p1.x, p1.z)
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'CONCENTRIC') {
      if (selection.length === 2) {
        if (selection[0].type === 'circle' && selection[1].type === 'circle') {
          const c1 = sketchCircles.find(c => c.id === selection[0].id)
          if (c1) {
            updateSketchCircleProperty(selection[1].id, { centerX: c1.centerX, centerZ: c1.centerZ })
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'EQUAL') {
      if (selection.length === 2) {
        if (selection[0].type === 'circle' && selection[1].type === 'circle') {
          const c1 = sketchCircles.find(c => c.id === selection[0].id)
          if (c1) {
            updateSketchCircleProperty(selection[1].id, { radius: c1.radius })
          }
        } else if (selection[0].type === 'line' && selection[1].type === 'line') {
          const l1 = sketchLines.find(l => l.id === selection[0].id)
          const l2 = sketchLines.find(l => l.id === selection[1].id)
          if (l1 && l2) {
            const s1 = sketchPoints.find(p => p.id === l1.startPointId)
            const e1 = sketchPoints.find(p => p.id === l1.endPointId)
            const s2 = sketchPoints.find(p => p.id === l2.startPointId)
            const e2 = sketchPoints.find(p => p.id === l2.endPointId)
            if (s1 && e1 && s2 && e2) {
              const len1 = Math.hypot(e1.x - s1.x, e1.z - s1.z)
              const dx2 = e2.x - s2.x
              const dz2 = e2.z - s2.z
              const len2 = Math.hypot(dx2, dz2)
              if (len2 > 0.01) {
                updateSketchPointPosition(l2.endPointId, s2.x + (dx2 / len2) * len1, s2.z + (dz2 / len2) * len1)
              }
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'EQUAL_RADIUS') {
      if (selection.length === 2) {
        if (selection[0].type === 'circle' && selection[1].type === 'circle') {
          const c1 = sketchCircles.find(c => c.id === selection[0].id)
          if (c1) {
            updateSketchCircleProperty(selection[1].id, { radius: c1.radius })
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'EQUAL_LENGTH') {
      if (selection.length === 2) {
        if (selection[0].type === 'line' && selection[1].type === 'line') {
          const l1 = sketchLines.find(l => l.id === selection[0].id)
          const l2 = sketchLines.find(l => l.id === selection[1].id)
          if (l1 && l2) {
            const s1 = sketchPoints.find(p => p.id === l1.startPointId)
            const e1 = sketchPoints.find(p => p.id === l1.endPointId)
            const s2 = sketchPoints.find(p => p.id === l2.startPointId)
            const e2 = sketchPoints.find(p => p.id === l2.endPointId)
            if (s1 && e1 && s2 && e2) {
              const len1 = Math.hypot(e1.x - s1.x, e1.z - s1.z)
              const dx2 = e2.x - s2.x
              const dz2 = e2.z - s2.z
              const len2 = Math.hypot(dx2, dz2)
              if (len2 > 0.01) {
                updateSketchPointPosition(l2.endPointId, s2.x + (dx2 / len2) * len1, s2.z + (dz2 / len2) * len1)
              }
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'POINT_ON_LINE') {
      if (selection.length === 2) {
        const ptSelect = selection.find(s => s.type === 'point')
        const lineSelect = selection.find(s => s.type === 'line')
        if (ptSelect && lineSelect) {
          const line = sketchLines.find(l => l.id === lineSelect.id)
          const pt = sketchPoints.find(p => p.id === ptSelect.id)
          if (line && pt) {
            const start = sketchPoints.find(p => p.id === line.startPointId)
            const end = sketchPoints.find(p => p.id === line.endPointId)
            if (start && end) {
              const dx = end.x - start.x
              const dz = end.z - start.z
              const len2 = dx * dx + dz * dz
              if (len2 > 0.01) {
                const t = Math.max(0, Math.min(1, ((pt.x - start.x) * dx + (pt.z - start.z) * dz) / len2))
                updateSketchPointPosition(ptSelect.id, start.x + t * dx, start.z + t * dz)
              }
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'POINT_ON_CIRCLE') {
      if (selection.length === 2) {
        const ptSelect = selection.find(s => s.type === 'point')
        const circleSelect = selection.find(s => s.type === 'circle')
        if (ptSelect && circleSelect) {
          const circle = sketchCircles.find(c => c.id === circleSelect.id)
          const pt = sketchPoints.find(p => p.id === ptSelect.id)
          if (circle && pt) {
            const dx = pt.x - circle.centerX
            const dz = pt.z - circle.centerZ
            const dist = Math.hypot(dx, dz)
            if (dist > 0.01) {
              updateSketchPointPosition(ptSelect.id, circle.centerX + (dx / dist) * circle.radius, circle.centerZ + (dz / dist) * circle.radius)
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'ANGLE_CONSTRAINT') {
      if (selection.length === 1 && selection[0].type === 'line') {
        const line = sketchLines.find(l => l.id === selection[0].id)
        if (line) {
          const s = sketchPoints.find(p => p.id === line.startPointId)
          const e = sketchPoints.find(p => p.id === line.endPointId)
          if (s && e) {
            const val = parseFloat(prompt('Enter absolute angle constraint for line (in degrees, e.g. 45):') || '')
            if (!isNaN(val)) {
              const rad = (val * Math.PI) / 180
              const len = Math.hypot(e.x - s.x, e.z - s.z)
              updateSketchPointPosition(line.endPointId, s.x + Math.cos(rad) * len, s.z - Math.sin(rad) * len)
            }
          }
        }
        setSketchDrawMode(null)
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'ANGLE_BETWEEN') {
      if (selection.length === 2 && selection[0].type === 'line' && selection[1].type === 'line') {
        const l1 = sketchLines.find(l => l.id === selection[0].id)
        const l2 = sketchLines.find(l => l.id === selection[1].id)
        if (l1 && l2) {
          const s1 = sketchPoints.find(p => p.id === l1.startPointId)
          const e1 = sketchPoints.find(p => p.id === l1.endPointId)
          const s2 = sketchPoints.find(p => p.id === l2.startPointId)
          const e2 = sketchPoints.find(p => p.id === l2.endPointId)
          if (s1 && e1 && s2 && e2) {
            const val = parseFloat(prompt('Enter angle constraint between lines (in degrees):') || '')
            if (!isNaN(val)) {
              const a1 = Math.atan2(e1.z - s1.z, e1.x - s1.x)
              const a2 = a1 + (val * Math.PI) / 180
              const len2 = Math.hypot(e2.x - s2.x, e2.z - s2.z)
              updateSketchPointPosition(l2.endPointId, s2.x + Math.cos(a2) * len2, s2.z + Math.sin(a2) * len2)
            }
          }
        }
        setSketchDrawMode(null)
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'DISTANCE_PL') {
      if (selection.length === 2) {
        const ptSelect = selection.find(s => s.type === 'point')
        const lineSelect = selection.find(s => s.type === 'line')
        if (ptSelect && lineSelect) {
          const line = sketchLines.find(l => l.id === lineSelect.id)
          const pt = sketchPoints.find(p => p.id === ptSelect.id)
          if (line && pt) {
            const s = sketchPoints.find(p => p.id === line.startPointId)
            const e = sketchPoints.find(p => p.id === line.endPointId)
            if (s && e) {
              const val = parseFloat(prompt('Enter perpendicular offset distance constraint (in feet):') || '')
              if (!isNaN(val)) {
                const dx = e.x - s.x
                const dz = e.z - s.z
                const len = Math.hypot(dx, dz)
                if (len > 0.01) {
                  const nx = -dz / len
                  const nz = dx / len
                  const t = ((pt.x - s.x) * dx + (pt.z - s.z) * dz) / (len * len)
                  const projX = s.x + t * dx
                  const projZ = s.z + t * dz
                  updateSketchPointPosition(ptSelect.id, projX + nx * val, projZ + nz * val)
                }
              }
            }
          }
        }
        setSketchDrawMode(null)
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'DISTANCE_PP') {
      if (selection.length === 2 && selection[0].type === 'point' && selection[1].type === 'point') {
        const p1 = sketchPoints.find(p => p.id === selection[0].id)
        const p2 = sketchPoints.find(p => p.id === selection[1].id)
        if (p1 && p2) {
          const val = parseFloat(prompt('Enter distance constraint between points (in feet):') || '')
          if (!isNaN(val)) {
            const dx = p2.x - p1.x
            const dz = p2.z - p1.z
            const currentDist = Math.hypot(dx, dz)
            if (currentDist > 0.01) {
              updateSketchPointPosition(selection[1].id, p1.x + (dx / currentDist) * val, p1.z + (dz / currentDist) * val)
            } else {
              updateSketchPointPosition(selection[1].id, p1.x + val, p1.z)
            }
          }
        }
        setSketchDrawMode(null)
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'MEASURE_ANGLE') {
      if (selection.length === 2 && selection[0].type === 'line' && selection[1].type === 'line') {
        const l1 = sketchLines.find(l => l.id === selection[0].id)
        const l2 = sketchLines.find(l => l.id === selection[1].id)
        if (l1 && l2) {
          const s1 = sketchPoints.find(p => p.id === l1.startPointId)
          const e1 = sketchPoints.find(p => p.id === l1.endPointId)
          const s2 = sketchPoints.find(p => p.id === l2.startPointId)
          const e2 = sketchPoints.find(p => p.id === l2.endPointId)
          if (s1 && e1 && s2 && e2) {
            const a1 = Math.atan2(e1.z - s1.z, e1.x - s1.x)
            const a2 = Math.atan2(e2.z - s2.z, e2.x - s2.x)
            let diff = Math.abs(a2 - a1) * 180 / Math.PI
            if (diff > 180) diff = 360 - diff
            alert(`Measured Angle Between Lines:\nRelative angle: ${diff.toFixed(2)}°`)
          }
        }
        setSketchDrawMode(null)
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'MEASURE_CIRCLE') {
      if (selection.length === 1 && selection[0].type === 'circle') {
        const circle = sketchCircles.find(c => c.id === selection[0].id)
        if (circle) {
          alert(`Measured Circle Details:\nRadius: ${circle.radius.toFixed(3)} ft\nDiameter: ${(circle.radius * 2).toFixed(3)} ft\nCenter Point: (${circle.centerX.toFixed(2)}, ${circle.centerZ.toFixed(2)})`)
        }
        setSketchDrawMode(null)
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'MIDPOINT') {
      if (selection.length === 2) {
        const ptSelect = selection.find(s => s.type === 'point')
        const lineSelect = selection.find(s => s.type === 'line')
        if (ptSelect && lineSelect) {
          const line = sketchLines.find(l => l.id === lineSelect.id)
          if (line) {
            const start = sketchPoints.find(p => p.id === line.startPointId)
            const end = sketchPoints.find(p => p.id === line.endPointId)
            if (start && end) {
              updateSketchPointPosition(ptSelect.id, (start.x + end.x) / 2, (start.z + end.z) / 2)
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'PARALLEL' || activeDrawMode === 'PERPENDICULAR') {
      if (selection.length === 2) {
        if (selection[0].type === 'line' && selection[1].type === 'line') {
          const l1 = sketchLines.find(l => l.id === selection[0].id)
          const l2 = sketchLines.find(l => l.id === selection[1].id)
          if (l1 && l2) {
            const s1 = sketchPoints.find(p => p.id === l1.startPointId)
            const e1 = sketchPoints.find(p => p.id === l1.endPointId)
            const s2 = sketchPoints.find(p => p.id === l2.startPointId)
            const e2 = sketchPoints.find(p => p.id === l2.endPointId)
            if (s1 && e1 && s2 && e2) {
              let angle1 = Math.atan2(e1.z - s1.z, e1.x - s1.x)
              if (activeDrawMode === 'PERPENDICULAR') {
                angle1 += Math.PI / 2
              }
              const len2 = Math.hypot(e2.x - s2.x, e2.z - s2.z)
              updateSketchPointPosition(l2.endPointId, s2.x + Math.cos(angle1) * len2, s2.z + Math.sin(angle1) * len2)
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'COLLINEAR') {
      if (selection.length === 2) {
        if (selection[0].type === 'line' && selection[1].type === 'line') {
          const l1 = sketchLines.find(l => l.id === selection[0].id)
          const l2 = sketchLines.find(l => l.id === selection[1].id)
          if (l1 && l2) {
            const s1 = sketchPoints.find(p => p.id === l1.startPointId)
            const e1 = sketchPoints.find(p => p.id === l1.endPointId)
            const s2 = sketchPoints.find(p => p.id === l2.startPointId)
            const e2 = sketchPoints.find(p => p.id === l2.endPointId)
            if (s1 && e1 && s2 && e2) {
              const angle1 = Math.atan2(e1.z - s1.z, e1.x - s1.x)
              const len2 = Math.hypot(e2.x - s2.x, e2.z - s2.z)
              const dx1 = e1.x - s1.x
              const dz1 = e1.z - s1.z
              const len1_sq = dx1*dx1 + dz1*dz1
              if (len1_sq > 0.01) {
                const t = ((s2.x - s1.x)*dx1 + (s2.z - s1.z)*dz1) / len1_sq
                const projX = s1.x + t * dx1
                const projZ = s1.z + t * dz1
                updateSketchPointPosition(l2.startPointId, projX, projZ)
                updateSketchPointPosition(l2.endPointId, projX + Math.cos(angle1) * len2, projZ + Math.sin(angle1) * len2)
              }
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'MIRROR') {
      if (selection.length === 2) {
        const mirrorLineSelect = selection.find(s => s.type === 'line')
        const targetSelect = selection.find(s => s.id !== mirrorLineSelect?.id)
        if (mirrorLineSelect && targetSelect) {
          const mLine = sketchLines.find(l => l.id === mirrorLineSelect.id)
          if (mLine) {
            const ms = sketchPoints.find(p => p.id === mLine.startPointId)
            const me = sketchPoints.find(p => p.id === mLine.endPointId)
            if (ms && me) {
              const mAngle = Math.atan2(me.z - ms.z, me.x - ms.x)
              const mirrorCoord = (x: number, z: number): [number, number] => {
                const tx = x - ms.x
                const tz = z - ms.z
                const rx = tx * Math.cos(-mAngle) - tz * Math.sin(-mAngle)
                const rz = tx * Math.sin(-mAngle) + tz * Math.cos(-mAngle)
                const mirrored_rz = -rz
                const final_tx = rx * Math.cos(mAngle) - mirrored_rz * Math.sin(mAngle)
                const final_tz = rx * Math.sin(mAngle) + mirrored_rz * Math.cos(mAngle)
                return [final_tx + ms.x, final_tz + ms.z]
              }

              if (targetSelect.type === 'point') {
                const pt = sketchPoints.find(p => p.id === targetSelect.id)
                if (pt) {
                  const [mx, mz] = mirrorCoord(pt.x, pt.z)
                  addSketchPoint(mx, mz)
                }
              } else if (targetSelect.type === 'line') {
                const line = sketchLines.find(l => l.id === targetSelect.id)
                if (line) {
                  const s = sketchPoints.find(p => p.id === line.startPointId)
                  const e = sketchPoints.find(p => p.id === line.endPointId)
                  if (s && e) {
                    const [mx1, mz1] = mirrorCoord(s.x, s.z)
                    const [mx2, mz2] = mirrorCoord(e.x, e.z)
                    const p1 = addSketchPoint(mx1, mz1)
                    const p2 = addSketchPoint(mx2, mz2)
                    addSketchLine(p1, p2)
                  }
                }
              } else if (targetSelect.type === 'circle') {
                const circle = sketchCircles.find(c => c.id === targetSelect.id)
                if (circle) {
                  const [mx, mz] = mirrorCoord(circle.centerX, circle.centerZ)
                  addSketchCircle(mx, mz, circle.radius)
                }
              }
            }
          }
        }
        setConstraintSelection([])
      }
    } else if (activeDrawMode === 'SYMMETRIC') {
      if (selection.length === 3) {
        const axisSelect = selection[2]
        if (axisSelect.type === 'line') {
          const axisLine = sketchLines.find(l => l.id === axisSelect.id)
          if (axisLine) {
            const ms = sketchPoints.find(p => p.id === axisLine.startPointId)
            const me = sketchPoints.find(p => p.id === axisLine.endPointId)
            if (ms && me && selection[0].type === 'point' && selection[1].type === 'point') {
              const pt1 = sketchPoints.find(p => p.id === selection[0].id)
              if (pt1) {
                const mAngle = Math.atan2(me.z - ms.z, me.x - ms.x)
                const tx = pt1.x - ms.x
                const tz = pt1.z - ms.z
                const rx = tx * Math.cos(-mAngle) - tz * Math.sin(-mAngle)
                const rz = tx * Math.sin(-mAngle) + tz * Math.cos(-mAngle)
                const mirrored_rz = -rz
                const final_tx = rx * Math.cos(mAngle) - mirrored_rz * Math.sin(mAngle)
                const final_tz = rx * Math.sin(mAngle) + mirrored_rz * Math.cos(mAngle)
                updateSketchPointPosition(selection[1].id, final_tx + ms.x, final_tz + ms.z)
              }
            }
          }
        }
        setConstraintSelection([])
      }
    }
  }

  const handlePointClick = (ptId: string) => {
    if (activeDrawMode && activeDrawMode !== 'LINE' && activeDrawMode !== 'RECTANGLE' && activeDrawMode !== 'CIRCLE') {
      handleEntityClick('point', ptId)
      return
    }

    if (!activeDrawMode) {
      setSelectedPointId(ptId)
      setSelectedLineId(null)
      return
    }

    if (activeDrawMode === 'LINE') {
      if (!sketchStartPointId) {
        setSketchStartPointId(ptId)
      } else if (sketchStartPointId !== ptId) {
        addSketchLine(sketchStartPointId, ptId)
        setSketchStartPointId(ptId) // chain
      }
    }
  }

  const handlePointDown = (ptId: string) => {
    if (activeDrawMode === 'TRIM') return
    if (activeDrawMode) return

    setDraggingPointId(ptId)
    setSelectedPointId(ptId)
    setSelectedLineId(null)
  }

  const handleDimensionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startPt || !sketchCurrentPoint) return

    if (activeDrawMode === 'RECTANGLE') {
      let width = 0
      let depth = 0
      const cleanInput = dimensionInput.trim().toLowerCase()

      // Parse format like "12x8" or "12,8" or "12 8"
      const parts = cleanInput.split(/[x,\s]+/)
      if (parts.length >= 2) {
        const w = parseFloat(parts[0])
        const d = parseFloat(parts[1])
        if (!isNaN(w) && w > 0 && !isNaN(d) && d > 0) {
          width = w
          depth = d
        }
      } else {
        const w = parseFloat(cleanInput)
        if (!isNaN(w) && w > 0) {
          width = w
          depth = w
        }
      }

      if (width > 0 && depth > 0) {
        const dx = sketchCurrentPoint[0] - startPt.x
        const dz = sketchCurrentPoint[1] - startPt.z
        const signX = dx >= 0 ? 1 : -1
        const signZ = dz >= 0 ? 1 : -1

        const endX = startPt.x + signX * width
        const endZ = startPt.z + signZ * depth
        const startX = startPt.x
        const startZ = startPt.z

        const p1Id = sketchStartPointId
        const p2Id = addSketchPoint(endX, startZ)
        const p3Id = addSketchPoint(endX, endZ)
        const p4Id = addSketchPoint(startX, endZ)

        addSketchLine(p1Id!, p2Id)
        addSketchLine(p2Id, p3Id)
        addSketchLine(p3Id, p4Id)
        addSketchLine(p4Id, p1Id!)

        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
      }
    } else if (activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE') {
      const dx = sketchCurrentPoint[0] - startPt.x
      const dz = sketchCurrentPoint[1] - startPt.z
      const len = Math.hypot(dx, dz)
      if (len < 0.05) return

      const targetPtId = addSketchPoint(sketchCurrentPoint[0], sketchCurrentPoint[1])
      addSketchLine(sketchStartPointId!, targetPtId)
      setSketchStartPointId(targetPtId)

      // Reset constraints for next segment
      setLockedLength(null)
      setLockedAngle(null)
      setLengthInput('')
      setAngleInput('')
      setHudFocus('length')
    } else {
      const parsedLen = parseFloat(dimensionInput)
      if (isNaN(parsedLen) || parsedLen <= 0) return

      if (activeDrawMode === 'CIRCLE') {
        // Treat input as radius
        const radius = parsedLen
        const center = startPt
        addSketchCircle(center.x, center.z, radius)
        // Remove center point
        removeSketchPoint(center.id)
        setSketchStartPointId(null)
        setSketchCurrentPoint(null)
      }
    }

    // Clear input
    setDimensionInput('')
    if (inputRef.current) inputRef.current.blur()
  }

  const elev = sketchWorkingPlane?.elevation ?? 0

  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 0, 1)
    const normalVec = sketchWorkingPlane?.normal ? new THREE.Vector3(...sketchWorkingPlane.normal).normalize() : new THREE.Vector3(0, 1, 0)
    q.setFromUnitVectors(up, normalVec)
    return q
  }, [sketchWorkingPlane])

  const planePosition = useMemo(() => {
    const normalVec = sketchWorkingPlane?.normal ? new THREE.Vector3(...sketchWorkingPlane.normal).normalize() : new THREE.Vector3(0, 1, 0)
    return normalVec.multiplyScalar(sketchWorkingPlane?.elevation ?? 0)
  }, [sketchWorkingPlane])

  return (
    <group name="sketch-overlay">
      {/* Invisible Raycast Plane for snapping */}
      <mesh
        quaternion={quat}
        position={planePosition}
        onPointerDown={(e) => {
          e.stopPropagation()
          handleGroundClick()
        }}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Render Snapped Alignment Guides */}
      {activeGuides.map((guide, idx) => {
        const start: [number, number, number] = [guide.pointX, elev + 0.02, guide.pointZ]
        const end: [number, number, number] = [
          guide.axis === 'X' ? guide.position : sketchCurrentPoint?.[0] ?? guide.pointX,
          elev + 0.02,
          guide.axis === 'Z' ? guide.position : sketchCurrentPoint?.[1] ?? guide.pointZ,
        ]

        return (
          <Line
            key={idx}
            points={[start, end]}
            color={snapGuideColor}
            lineWidth={1.5}
            dashed
            dashSize={0.4}
            gapSize={0.2}
            depthTest={false}
            depthWrite={false}
            renderOrder={20}
          />
        )
      })}

      {/* Render Sketch Lines (Walls) */}
      {sketchLines.map((line) => {
        const start = sketchPoints.find(p => p.id === line.startPointId)
        const end = sketchPoints.find(p => p.id === line.endPointId)
        if (!start || !end) return null

        const dx = end.x - start.x
        const dz = end.z - start.z
        const length = Math.hypot(dx, dz)
        const angle = Math.atan2(-dz, dx)
        const mx = (start.x + end.x) / 2
        const mz = (start.z + end.z) / 2

        const isSelected = selectedLineId === line.id
        const isHovered = hoveredLineId === line.id || hoveredSketchItemId === line.id || hoveredSketchItemId === 'extrude-feature' || hoveredOperationEntityIds.has(line.id)

        const lineElev = line.elevation ?? elev
        return (
          <group key={line.id} position={[mx, lineElev + 0.03, mz]} rotation={[0, angle, 0]} renderOrder={10}>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredLineId(line.id)
              }}
              onPointerOut={() => setHoveredLineId(null)}
              onClick={(e) => {
                e.stopPropagation()
                if (activeDrawMode) {
                  handleEntityClick('line', line.id)
                } else {
                  setSelectedLineId(line.id)
                  setSelectedPointId(null)
                }
              }}
            >
              <boxGeometry args={[length, 0.1, line.thickness]} />
              <meshBasicMaterial
                color={isSelected ? selectionEdge : isHovered ? hoverEdge : '#06b6d4'}
                transparent
                opacity={isSelected ? 0.75 : isHovered ? 0.6 : 0.4}
                depthWrite={false}
              />
            </mesh>
          </group>
        )
      })}

      {/* Render Active Chain Preview */}
      {startPt && sketchCurrentPoint && (
        <group>
          {/* Visual Preview */}
          {activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE' ? (
            <>
              {/* Horizontal Reference line at 0 degrees (only when no previous line segment) */}
              {!prevLine && (
                <Line
                  points={[
                    [startPt.x, elev + 0.042, startPt.z],
                    [startPt.x + Math.min(3.0, currentLength * 0.6), elev + 0.042, startPt.z]
                  ]}
                  color="#64748b"
                  lineWidth={1}
                  dashed
                  dashSize={0.15}
                  gapSize={0.08}
                  depthTest={false}
                  depthWrite={false}
                  renderOrder={20}
                />
              )}
              {/* Angular Compass Arc Sweep */}
              {arcPoints.length > 1 && (
                <Line
                  points={arcPoints}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  depthWrite={false}
                  renderOrder={20}
                />
              )}
              {/* Target Line preview */}
              <Line
                points={[
                  [startPt.x, elev + 0.05, startPt.z],
                  [sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]],
                ]}
                color="#22d3ee"
                lineWidth={3}
                depthTest={false}
                depthWrite={false}
                renderOrder={20}
              />
            </>
          ) : activeDrawMode === 'RECTANGLE' ? (
            <Line
              points={[
                [startPt.x, elev + 0.05, startPt.z],
                [sketchCurrentPoint[0], elev + 0.05, startPt.z],
                [sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]],
                [startPt.x, elev + 0.05, sketchCurrentPoint[1]],
                [startPt.x, elev + 0.05, startPt.z],
              ]}
              color="#22d3ee"
              lineWidth={3}
              depthTest={false}
              depthWrite={false}
              renderOrder={20}
            />
          ) : activeDrawMode === 'CIRCLE' ? (
            <Line
              points={(() => {
                const pts: [number, number, number][] = []
                for (let i = 0; i <= 64; i++) {
                  const angle = (Math.PI * 2 * i) / 64
                  pts.push([
                    startPt.x + currentLength * Math.cos(angle),
                    elev + 0.05,
                    startPt.z + currentLength * Math.sin(angle),
                  ])
                }
                return pts
              })()}
              color="#22d3ee"
              lineWidth={3}
              depthTest={false}
              depthWrite={false}
              renderOrder={20}
            />
          ) : activeDrawMode === 'ARC' && tempPoints.length > 0 ? (
            <>
              {tempPoints.length === 1 && (
                <Line
                  points={[
                    [tempPoints[0][0], elev + 0.05, tempPoints[0][1]],
                    [sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]],
                  ]}
                  color="#fb7185"
                  lineWidth={2}
                  depthTest={false}
                  depthWrite={false}
                  renderOrder={20}
                />
              )}
              {tempPoints.length === 2 && (
                <>
                  <Line
                    points={[
                      [tempPoints[0][0], elev + 0.05, tempPoints[0][1]],
                      [tempPoints[1][0], elev + 0.05, tempPoints[1][1]],
                    ]}
                    color="#06b6d4"
                    lineWidth={2.5}
                    depthTest={false}
                    depthWrite={false}
                    renderOrder={20}
                  />
                  <Line
                    points={[
                      [tempPoints[1][0], elev + 0.05, tempPoints[1][1]],
                      [sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]],
                    ]}
                    color="#fb7185"
                    lineWidth={1.5}
                    depthTest={false}
                    depthWrite={false}
                    renderOrder={20}
                  />
                </>
              )}
            </>
          ) : (activeDrawMode === 'ELLIPSE' || activeDrawMode === 'ELLIPSE_ARC') && tempPoints.length > 0 ? (
            <>
              {tempPoints.length === 1 && (
                <Line
                  points={[
                    [tempPoints[0][0], elev + 0.05, tempPoints[0][1]],
                    [sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]],
                  ]}
                  color="#fb7185"
                  lineWidth={2}
                  depthTest={false}
                  depthWrite={false}
                  renderOrder={20}
                />
              )}
              {tempPoints.length === 2 && (
                <>
                  <Line
                    points={[
                      [tempPoints[0][0], elev + 0.05, tempPoints[0][1]],
                      [tempPoints[1][0], elev + 0.05, tempPoints[1][1]],
                    ]}
                    color="#06b6d4"
                    lineWidth={2.5}
                    depthTest={false}
                    depthWrite={false}
                    renderOrder={20}
                  />
                  <Line
                    points={[
                      [tempPoints[0][0], elev + 0.05, tempPoints[0][1]],
                      [sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]],
                    ]}
                    color="#fb7185"
                    lineWidth={1.5}
                    depthTest={false}
                    depthWrite={false}
                    renderOrder={20}
                  />
                </>
              )}
            </>
          ) : activeDrawMode === 'SPLINE' && tempPoints.length > 0 ? (
            <Line
              points={(() => {
                const pts: [number, number, number][] = tempPoints.map(p => [p[0], elev + 0.05, p[1]])
                pts.push([sketchCurrentPoint[0], elev + 0.05, sketchCurrentPoint[1]])
                return pts
              })()}
              color="#22d3ee"
              lineWidth={3}
              depthTest={false}
              depthWrite={false}
              renderOrder={20}
            />
          ) : null}

          {/* Dimension HUD (HTML tooltips positioned at midpoints and bisectors like Fusion 360) */}
          {activeDrawMode === 'LINE' || activeDrawMode === 'MULTI_LINE' ? (
            <>
              {/* Length Box (at midpoint of the preview line, offset perpendicularly like Fusion 360) */}
              {(() => {
                const dx = sketchCurrentPoint[0] - startPt.x
                const dz = sketchCurrentPoint[1] - startPt.z
                const len = Math.hypot(dx, dz)
                
                // Perpendicular vector
                const nx = len > 0.001 ? -dz / len : 0
                const nz = len > 0.001 ? dx / len : 0
                
                // Offset distance: 0.65 feet (approx 8 inches) to side of the line
                const ox = nx * 0.65
                const oz = nz * 0.65

                const lx = (startPt.x + sketchCurrentPoint[0]) / 2 + ox
                const lz = (startPt.z + sketchCurrentPoint[1]) / 2 + oz

                return (
                  <Html pointerEvents="none" position={[lx, elev + 0.15, lz]} center>
                    <form onSubmit={handleDimensionSubmit} onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={lengthInputRef}
                        type="text"
                        value={lengthInput}
                        onChange={(e) => {
                          setLengthInput(e.target.value)
                          const val = parseFloat(e.target.value)
                          setLockedLength(isNaN(val) ? null : val)
                        }}
                        placeholder={currentLength.toFixed(2)}
                        style={{
                          background: '#ffffff',
                          border: hudFocus === 'length' ? '1.5px solid #005a9e' : '1px solid #a0a0a0',
                          color: '#000000',
                          borderRadius: '1px',
                          width: '50px',
                          padding: '1px 3px',
                          textAlign: 'center',
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          outline: 'none',
                          boxShadow: '1px 1px 3px rgba(0,0,0,0.15)',
                          pointerEvents: 'auto',
                        }}
                      />
                    </form>
                  </Html>
                )
              })()}

              {/* Angle Box (positioned along the bisector of the sweep arc) */}
              {(() => {
                const dx = sketchCurrentPoint[0] - startPt.x
                const dz = sketchCurrentPoint[1] - startPt.z
                const len = Math.hypot(dx, dz)
                if (len < 0.1) return null

                const angleRad = Math.atan2(-dz, dx)
                const arcRadius = Math.min(2.0, len * 0.4)
                const startAngle = prevLine ? prevLineAngleInward : 0
                const diffRad = Math.atan2(Math.sin(angleRad - startAngle), Math.cos(angleRad - startAngle))
                const bisector = startAngle + diffRad / 2
                
                // Offset the input box slightly outward from the arc radius
                const bx = startPt.x + (arcRadius + 0.45) * Math.cos(bisector)
                const bz = startPt.z - (arcRadius + 0.45) * Math.sin(bisector)

                const rel_angle_deg = Math.abs(Math.atan2(Math.sin(angleRad - startAngle), Math.cos(angleRad - startAngle)) * 180 / Math.PI)

                return (
                  <Html pointerEvents="none" position={[bx, elev + 0.15, bz]} center>
                    <form onSubmit={handleDimensionSubmit} onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={angleInputRef}
                        type="text"
                        value={angleInput}
                        onChange={(e) => {
                          setAngleInput(e.target.value)
                          const val = parseFloat(e.target.value)
                          setLockedAngle(isNaN(val) ? null : val)
                        }}
                        placeholder={`${Math.round(rel_angle_deg)}°`}
                        style={{
                          background: '#ffffff',
                          border: hudFocus === 'angle' ? '1.5px solid #005a9e' : '1px solid #a0a0a0',
                          color: '#000000',
                          borderRadius: '1px',
                          width: '40px',
                          padding: '1px 3px',
                          textAlign: 'center',
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          outline: 'none',
                          boxShadow: '1px 1px 3px rgba(0,0,0,0.15)',
                          pointerEvents: 'auto',
                        }}
                      />
                    </form>
                  </Html>
                )
              })()}
            </>
          ) : (
            /* Rectangle or Circle: simple input box at the midpoint of diagonal or radius, slightly offset */
            (() => {
              const dx = sketchCurrentPoint[0] - startPt.x
              const dz = sketchCurrentPoint[1] - startPt.z
              const len = Math.hypot(dx, dz)
              const nx = len > 0.001 ? -dz / len : 0
              const nz = len > 0.001 ? dx / len : 0
              const ox = nx * 0.65
              const oz = nz * 0.65
              
              const lx = (startPt.x + sketchCurrentPoint[0]) / 2 + ox
              const lz = (startPt.z + sketchCurrentPoint[1]) / 2 + oz

              return (
                <Html pointerEvents="none" position={[lx, elev + 0.15, lz]} center>
                  <form onSubmit={handleDimensionSubmit} onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={dimensionInput}
                      onChange={(e) => setDimensionInput(e.target.value)}
                      placeholder={activeDrawMode === 'CIRCLE' ? 'Radius (ft)' : 'w x d (e.g. 12x8)'}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #a0a0a0',
                        color: '#000000',
                        borderRadius: '1px',
                        width: activeDrawMode === 'CIRCLE' ? '70px' : '90px',
                        padding: '1px 3px',
                        textAlign: 'center',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        boxShadow: '1px 1px 3px rgba(0,0,0,0.15)',
                        pointerEvents: 'auto',
                      }}
                    />
                  </form>
                </Html>
              )
            })()
          )}
        </group>
      )}

      {/* Render Sketch Circles */}
      {sketchCircles.map((circle) => {
        const isSelected = selectedCircleId === circle.id
        const isHovered = hoveredCircleId === circle.id || hoveredSketchItemId === circle.id || hoveredSketchItemId === 'extrude-feature' || hoveredOperationEntityIds.has(circle.id)
        
        const circleElev = circle.elevation ?? elev
        // Generate coordinates for the outline
        const outlinePoints: [number, number, number][] = []
        const segments = 64
        for (let i = 0; i <= segments; i++) {
          const angle = (Math.PI * 2 * i) / segments
          outlinePoints.push([
            circle.centerX + circle.radius * Math.cos(angle),
            circleElev + 0.035,
            circle.centerZ + circle.radius * Math.sin(angle)
          ])
        }

        return (
          <group key={circle.id} renderOrder={10}>
            {/* The visual outline line */}
            <Line
              points={outlinePoints}
              color={isSelected ? selectionEdge : isHovered ? hoverEdge : '#06b6d4'}
              lineWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
              depthTest={false}
              depthWrite={false}
              renderOrder={20}
            />
            {/* Transparent ring mesh for easy clicking/hovering */}
            <mesh
              position={[circle.centerX, circleElev + 0.03, circle.centerZ]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredCircleId(circle.id)
              }}
              onPointerOut={() => setHoveredCircleId(null)}
              onClick={(e) => {
                e.stopPropagation()
                if (activeDrawMode) {
                  handleEntityClick('circle', circle.id)
                } else {
                  setSelectedCircleId(circle.id)
                  setSelectedPointId(null)
                  setSelectedLineId(null)
                }
              }}
            >
              <ringGeometry args={[circle.radius - 0.2, circle.radius + 0.2, 32]} />
              <meshBasicMaterial
                transparent
                opacity={0}
                depthWrite={false}
              />
            </mesh>
          </group>
        )
      })}

      {/* Render Sketch Labels */}
      {sketchLabels && sketchLabels.map((lbl) => {
        const isSelected = selectedLabelId === lbl.id
        const isHovered = hoveredSketchItemId === lbl.id || hoveredOperationEntityIds.has(lbl.id)
        const lblElev = lbl.elevation ?? elev
        return (
          <Html
            key={lbl.id}
            position={[lbl.x, lblElev + 0.2, lbl.z]}
            center
          >
            <div
              onClick={(e) => {
                e.stopPropagation()
                setSelectedLabelId(lbl.id)
                setSelectedPointId(null)
                setSelectedLineId(null)
                setSelectedCircleId(null)
              }}
              style={{
                background: isSelected ? 'rgba(6, 182, 212, 0.95)' : isHovered ? 'rgba(6, 182, 212, 0.4)' : 'rgba(9, 13, 22, 0.85)',
                border: isSelected ? '1.5px solid #ffffff' : isHovered ? '1.5px solid #22d3ee' : '1px solid rgba(6, 182, 212, 0.5)',
                boxShadow: isSelected ? '0 0 10px #22d3ee' : isHovered ? '0 0 5px rgba(6, 182, 212, 0.5)' : 'none',
                color: isSelected || isHovered ? '#ffffff' : '#22d3ee',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              💬 {lbl.text}
            </div>
          </Html>
        )
      })}

      {/* Render Sketch Points */}
      {sketchPoints.map((pt) => {
        const isSelected = selectedPointId === pt.id
        const isHovered = hoveredPointId === pt.id || hoveredSketchItemId === pt.id || hoveredOperationEntityIds.has(pt.id)
        const isStart = sketchStartPointId === pt.id
        const isLocked = lockedPoints.has(pt.id)
        const ptElev = pt.elevation ?? elev

        return (
          <mesh
            key={pt.id}
            position={[pt.x, ptElev + 0.05, pt.z]}
            onPointerDown={(e) => {
              e.stopPropagation()
              handlePointDown(pt.id)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHoveredPointId(pt.id)
            }}
            onPointerOut={() => setHoveredPointId(null)}
            onClick={(e) => {
              e.stopPropagation()
              if (activeDrawMode && activeDrawMode !== 'LINE' && activeDrawMode !== 'RECTANGLE' && activeDrawMode !== 'CIRCLE') {
                handleEntityClick('point', pt.id)
              } else {
                handlePointClick(pt.id)
              }
            }}
          >
            <cylinderGeometry args={[0.22, 0.22, 0.25, 12]} />
            <meshBasicMaterial
              color={
                isLocked
                  ? '#f59e0b'
                  : isSelected
                  ? selectionEdge
                  : isStart
                  ? snapGuideColor
                  : isHovered
                  ? hoverEdge
                  : buildingEdge
              }
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function calculateThreePointArc(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): [number, number][] | null {
  const [x1, y1] = p1
  const [x2, y2] = p2
  const [x3, y3] = p3

  // Midpoints of AB and BC
  const mx1 = (x1 + x2) / 2
  const my1 = (y1 + y2) / 2
  const mx2 = (x2 + x3) / 2
  const my2 = (y2 + y3) / 2

  // Slopes
  const dx1 = x2 - x1
  const dy1 = y2 - y1
  const dx2 = x3 - x2
  const dy2 = y3 - y2

  // Collinear check
  if (Math.abs(dx1 * dy2 - dy1 * dx2) < 0.0001) {
    return null
  }

  let cx = 0
  let cy = 0

  if (Math.abs(dy1) < 0.0001) {
    cx = mx1
    const slope2 = -dx2 / dy2
    cy = my2 + slope2 * (cx - mx2)
  } else if (Math.abs(dy2) < 0.0001) {
    cx = mx2
    const slope1 = -dx1 / dy1
    cy = my1 + slope1 * (cx - mx1)
  } else {
    const slope1 = -dx1 / dy1
    const slope2 = -dx2 / dy2
    cx = (my2 - my1 - slope2 * mx2 + slope1 * mx1) / (slope1 - slope2)
    cy = my1 + slope1 * (cx - mx1)
  }

  const radius = Math.hypot(x1 - cx, y1 - cy)

  let startAngle = Math.atan2(y1 - cy, x1 - cx)
  let midAngle = Math.atan2(y2 - cy, x2 - cx)
  let endAngle = Math.atan2(y3 - cy, x3 - cx)

  const TWO_PI = Math.PI * 2
  startAngle = (startAngle + TWO_PI) % TWO_PI
  midAngle = (midAngle + TWO_PI) % TWO_PI
  endAngle = (endAngle + TWO_PI) % TWO_PI

  let diffEnd = endAngle - startAngle
  let diffMid = midAngle - startAngle

  if (diffEnd < 0) diffEnd += TWO_PI
  if (diffMid < 0) diffMid += TWO_PI

  const clockwise = diffMid > diffEnd

  const points: [number, number][] = []
  const segments = 12

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    let angle = 0
    if (clockwise) {
      let sweep = startAngle - endAngle
      if (sweep < 0) sweep += TWO_PI
      angle = startAngle - sweep * t
    } else {
      let sweep = endAngle - startAngle
      if (sweep < 0) sweep += TWO_PI
      angle = startAngle + sweep * t
    }
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)])
  }

  return points
}

function calculateEllipsePoints(
  center: [number, number],
  majorEnd: [number, number],
  minorEnd: [number, number],
  sweepHalfOnly = false
): [number, number][] {
  const [cx, cz] = center
  const [mx, mz] = majorEnd
  const [nx, nz] = minorEnd

  const rMajor = Math.hypot(mx - cx, mz - cz)
  const rMinor = Math.hypot(nx - cx, nz - cz)
  const rotation = Math.atan2(mz - cz, mx - cx)

  const points: [number, number][] = []
  const segments = sweepHalfOnly ? 16 : 32

  for (let i = 0; i <= segments; i++) {
    const angle = ((sweepHalfOnly ? Math.PI : Math.PI * 2) * i) / segments
    const lx = rMajor * Math.cos(angle)
    const lz = rMinor * Math.sin(angle)
    const gx = cx + lx * Math.cos(rotation) - lz * Math.sin(rotation)
    const gz = cz + lx * Math.sin(rotation) + lz * Math.cos(rotation)
    points.push([gx, gz])
  }
  return points
}

function calculateSplinePoints(ctrlPoints: [number, number][]): [number, number][] {
  if (ctrlPoints.length < 2) return ctrlPoints
  if (ctrlPoints.length === 2) {
    return [ctrlPoints[0], ctrlPoints[1]]
  }

  const points: [number, number][] = []

  for (let i = 0; i < ctrlPoints.length - 1; i++) {
    const p0 = ctrlPoints[i === 0 ? 0 : i - 1]
    const p1 = ctrlPoints[i]
    const p2 = ctrlPoints[i + 1]
    const p3 = ctrlPoints[i + 2 >= ctrlPoints.length ? ctrlPoints.length - 1 : i + 2]

    const steps = 6
    for (let step = 0; step < steps; step++) {
      const t = step / steps
      const t2 = t * t
      const t3 = t2 * t

      const f1 = -0.5 * t3 + t2 - 0.5 * t
      const f2 = 1.5 * t3 - 2.5 * t2 + 1.0
      const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t
      const f4 = 0.5 * t3 - 0.5 * t2

      const px = p0[0] * f1 + p1[0] * f2 + p2[0] * f3 + p3[0] * f4
      const pz = p0[1] * f1 + p1[1] * f2 + p2[1] * f3 + p3[1] * f4

      points.push([px, pz])
    }
  }

  points.push(ctrlPoints[ctrlPoints.length - 1])
  return points
}
