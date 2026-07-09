import { useEffect, useRef } from 'react'
import type { ComponentRef } from 'react'
import { CameraControls, CameraControlsImpl, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useSpatialStore } from '@aura/state-store'
import * as THREE from 'three'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const isSketchMode = useSpatialStore(state => state.isSketchMode)
  const cadWorkspaceMode = useSpatialStore(state => state.cadWorkspaceMode)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const cameraView = useSpatialStore(state => state.cameraView)
  const cameraSwoopTrigger = useSpatialStore(state => state.cameraSwoopTrigger)
  const sketchWorkingPlane = useSpatialStore(state => state.sketchWorkingPlane)

  const { camera, gl, scene } = useThree()

  const pivotRef = useRef<THREE.Group>(null)
  const dropLineRef = useRef<THREE.LineSegments>(null)
  
  const controlsRef = useRef<ComponentRef<typeof CameraControls>>(null)
  const perspectiveRef = useRef<THREE.PerspectiveCamera>(null)
  const orthographicRef = useRef<THREE.OrthographicCamera>(null)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastTouchRef = useRef<{ x: number; y: number; distance: number } | null>(null)
  const syncTargetRef = useRef(new THREE.Vector3())
  const syncDirectionRef = useRef(new THREE.Vector3())
  const canvasRectRef = useRef<DOMRect | null>(null)

  useEffect(() => {
    const canvas = gl.domElement
    let isShiftDragging = false
    const lastPointerPos = { x: 0, y: 0 }
    const raycaster = new THREE.Raycaster()
    const fallbackTarget = new THREE.Vector3()
    const cursorPoint = new THREE.Vector3()
    const cameraPosition = new THREE.Vector3()
    const cameraTarget = new THREE.Vector3()
    const nextCameraPosition = new THREE.Vector3()
    const nextCameraTarget = new THREE.Vector3()
    const targetDelta = new THREE.Vector3()
    const cameraFromAnchor = new THREE.Vector3()
    const targetFromAnchor = new THREE.Vector3()
    const lookDirectionVec = new THREE.Vector3()
    const translationVec = new THREE.Vector3()
    const rightDirectionVec = new THREE.Vector3()

    const getWorldHeight = (controls: ComponentRef<typeof CameraControls>) => {
      const target = controls.getTarget(fallbackTarget)
      const targetDistance = camera.position.distanceTo(target)
      if (camera instanceof THREE.OrthographicCamera) {
        return (camera.top - camera.bottom) / camera.zoom
      }
      if (camera instanceof THREE.PerspectiveCamera) {
        return 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * targetDistance
      }
      return targetDistance
    }

    const getGroundPoint = (clientX: number, clientY: number, controls: ComponentRef<typeof CameraControls>) => {
      const rect = canvasRectRef.current || canvas.getBoundingClientRect()
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -(((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1)
      )

      raycaster.setFromCamera(pointer, camera)
      
      const state = useSpatialStore.getState()
      const normalVec = state.sketchWorkingPlane?.normal ? new THREE.Vector3(...state.sketchWorkingPlane.normal) : new THREE.Vector3(0, 1, 0)
      const elev = state.isSketchMode && state.sketchWorkingPlane ? state.sketchWorkingPlane.elevation : 0
      const activePlane = new THREE.Plane(normalVec, -elev)

      const hit = raycaster.ray.intersectPlane(activePlane, cursorPoint)
      if (hit) return hit

      return controls.getTarget(cursorPoint)
    }

    const zoomAt = (clientX: number, clientY: number, rawDelta: number) => {
      const controls = controlsRef.current
      if (!controls) return

      // Snappy sensitivity scaling: divide by 24 for a major zoom speed increase, and widen clamp limits for rapid mouse scroll zooming
      const normalizedDelta = THREE.MathUtils.clamp(rawDelta / 24, -4.0, 4.0)
      if (Math.abs(normalizedDelta) < 0.002) return
      const requestedFactor = THREE.MathUtils.clamp(Math.pow(0.68, normalizedDelta), 0.3, 3.0)
      const anchor = getGroundPoint(clientX, clientY, controls)

      controls.getPosition(cameraPosition)
      controls.getTarget(cameraTarget)

      if (camera instanceof THREE.OrthographicCamera) {
        const nextZoom = THREE.MathUtils.clamp(camera.zoom / requestedFactor, 0.2, 200)
        const actualFactor = camera.zoom / nextZoom
        nextCameraTarget.copy(anchor).addScaledVector(targetDelta.copy(cameraTarget).sub(anchor), actualFactor)
        targetDelta.subVectors(nextCameraTarget, cameraTarget)
        nextCameraPosition.copy(cameraPosition).add(targetDelta)

        controls.zoomTo(nextZoom, false)
        controls.setLookAt(
          nextCameraPosition.x,
          nextCameraPosition.y,
          nextCameraPosition.z,
          nextCameraTarget.x,
          nextCameraTarget.y,
          nextCameraTarget.z,
          false
        )
        return
      }

      const distance = cameraPosition.distanceTo(cameraTarget)
      if (distance < 0.001) return

      const nextDistance = THREE.MathUtils.clamp(distance * requestedFactor, 0.5, 50000)
      const actualFactor = nextDistance / distance
      nextCameraPosition.copy(anchor).addScaledVector(cameraFromAnchor.copy(cameraPosition).sub(anchor), actualFactor)
      nextCameraTarget.copy(anchor).addScaledVector(targetFromAnchor.copy(cameraTarget).sub(anchor), actualFactor)

      controls.setLookAt(
        nextCameraPosition.x,
        nextCameraPosition.y,
        nextCameraPosition.z,
        nextCameraTarget.x,
        nextCameraTarget.y,
        nextCameraTarget.z,
        false
      )
    }

    const truckByPixelsFloor = (deltaX: number, deltaY: number) => {
      const controls = controlsRef.current
      if (!controls) return
      const rect = canvasRectRef.current || canvas.getBoundingClientRect()
      const worldUnitsPerPixel = getWorldHeight(controls) / Math.max(rect.height, 1)

      // Calculate horizontal right vector projected on XZ floor plane
      rightDirectionVec.set(1, 0, 0).applyQuaternion(camera.quaternion)
      rightDirectionVec.y = 0
      rightDirectionVec.normalize()

      // Calculate forward direction projected on XZ floor plane
      camera.getWorldDirection(lookDirectionVec)
      lookDirectionVec.y = 0
      lookDirectionVec.normalize()

      // Combine into translation vector (pure X/Z flat movement)
      translationVec.copy(rightDirectionVec).multiplyScalar(deltaX * worldUnitsPerPixel)
      translationVec.addScaledVector(lookDirectionVec, deltaY * worldUnitsPerPixel)

      controls.getPosition(cameraPosition)
      controls.getTarget(cameraTarget)

      controls.setLookAt(
        cameraPosition.x + translationVec.x,
        cameraPosition.y, // Lock Y height
        cameraPosition.z + translationVec.z,
        cameraTarget.x + translationVec.x,
        cameraTarget.y, // Lock Y height
        cameraTarget.z + translationVec.z,
        false
      )
    }

    const truckByPixelsVertical = (deltaX: number, deltaY: number) => {
      const controls = controlsRef.current
      if (!controls) return
      const rect = canvasRectRef.current || canvas.getBoundingClientRect()
      const worldUnitsPerPixel = getWorldHeight(controls) / Math.max(rect.height, 1)

      // Horizontal component (deltaX) pans horizontally on XZ floor plane
      rightDirectionVec.set(1, 0, 0).applyQuaternion(camera.quaternion)
      rightDirectionVec.y = 0
      rightDirectionVec.normalize()
      translationVec.copy(rightDirectionVec).multiplyScalar(deltaX * worldUnitsPerPixel)

      // Vertical component (deltaY) translates camera + target vertically in world Y (elevation)
      const yDelta = deltaY * worldUnitsPerPixel

      controls.getPosition(cameraPosition)
      controls.getTarget(cameraTarget)

      controls.setLookAt(
        cameraPosition.x + translationVec.x,
        cameraPosition.y + yDelta,
        cameraPosition.z + translationVec.z,
        cameraTarget.x + translationVec.x,
        cameraTarget.y + yDelta,
        cameraTarget.z + translationVec.z,
        false
      )
    }

    const handleWheel = (e: WheelEvent) => {
      const controls = controlsRef.current
      if (!controls) return

      e.preventDefault()
      e.stopImmediatePropagation()

      // Detect standard mouse wheel clicks (which always emit multiples of 100/120 or deltaMode !== 0)
      // to separate them from smooth trackpad scrolling and swiping.
      const isMouseWheel = e.deltaMode !== 0 || (
        e.deltaY !== 0 && 
        Number.isInteger(e.deltaY) && 
        (Math.abs(e.deltaY) % 120 === 0 || Math.abs(e.deltaY) % 100 === 0)
      )

      if (e.shiftKey) {
        // Shift + pan: moves horizontally in X, vertically in Y (elevation)
        truckByPixelsVertical(e.deltaX, -e.deltaY)
        return
      }

      if (e.ctrlKey || isMouseWheel) {
        zoomAt(e.clientX, e.clientY, -e.deltaY)
        return
      }

      // Normal pan: moves across the floor plane (X and Z)
      truckByPixelsFloor(e.deltaX, -e.deltaY)
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.shiftKey) {
        isShiftDragging = true
        lastPointerPos.x = e.clientX
        lastPointerPos.y = e.clientY
        e.stopImmediatePropagation()
        e.preventDefault()
        return
      }

      if (e.pointerType !== 'touch') return
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (activePointersRef.current.size === 2) {
        const [a, b] = Array.from(activePointersRef.current.values())
        lastTouchRef.current = {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          distance: Math.hypot(a.x - b.x, a.y - b.y)
        }
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (isShiftDragging) {
        const deltaX = e.clientX - lastPointerPos.x
        const deltaY = e.clientY - lastPointerPos.y
        lastPointerPos.x = e.clientX
        lastPointerPos.y = e.clientY

        // Move vertical elevation (world Y) based on vertical delta
        truckByPixelsVertical(deltaX, -deltaY)

        e.stopImmediatePropagation()
        e.preventDefault()
        return
      }

      if (e.pointerType !== 'touch' || !activePointersRef.current.has(e.pointerId)) return
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (activePointersRef.current.size !== 2) return

      e.preventDefault()
      e.stopImmediatePropagation()

      const [a, b] = Array.from(activePointersRef.current.values())
      const current = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        distance: Math.hypot(a.x - b.x, a.y - b.y)
      }

      const previous = lastTouchRef.current ?? current
      truckByPixelsFloor(current.x - previous.x, previous.y - current.y)

      const panDistance = Math.hypot(current.x - previous.x, current.y - previous.y)
      const pinchDelta = current.distance - previous.distance
      
      // Adaptive gesture filter: Only trigger zoom if the user is intentionally pinching 
      // (pinch delta exceeds 4.0px and is not dominated by a vertical/horizontal panning motion)
      if (Math.abs(pinchDelta) > 4.0 && Math.abs(pinchDelta) > panDistance * 0.5) {
        zoomAt(current.x, current.y, pinchDelta * 2.5)
      }

      lastTouchRef.current = current
    }

    const handlePointerEnd = (e: PointerEvent) => {
      if (isShiftDragging) {
        isShiftDragging = false
        e.stopImmediatePropagation()
        e.preventDefault()
        return
      }

      if (e.pointerType !== 'touch') return
      activePointersRef.current.delete(e.pointerId)

      if (activePointersRef.current.size === 2) {
        const [a, b] = Array.from(activePointersRef.current.values())
        lastTouchRef.current = {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          distance: Math.hypot(a.x - b.x, a.y - b.y)
        }
      } else {
        lastTouchRef.current = null
      }
    }

    const handleResize = () => {
      canvasRectRef.current = canvas.getBoundingClientRect()
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    canvas.addEventListener('pointermove', handlePointerMove, { capture: true })
    canvas.addEventListener('pointerup', handlePointerEnd, { capture: true })
    canvas.addEventListener('pointercancel', handlePointerEnd, { capture: true })

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      canvas.removeEventListener('pointermove', handlePointerMove, { capture: true })
      canvas.removeEventListener('pointerup', handlePointerEnd, { capture: true })
      canvas.removeEventListener('pointercancel', handlePointerEnd, { capture: true })
    }
  }, [camera, gl, scene])

  useEffect(() => {
    if (!controlsRef.current) return

    const store = useSpatialStore.getState()
    const targetId = store.cameraTargetId
    const furnitureList = store.furniture
    const isSketchMode = store.isSketchMode
    const sketchWorkingPlane = store.sketchWorkingPlane

    const [tx, ty, tz] = targetId
      ? (furnitureList.find(f => f.id === targetId)?.position ?? [0, 0, 0])
      : [0, 0, 0]
    
    let cy = ty + 2
    if (isSketchMode && sketchWorkingPlane) {
      cy = sketchWorkingPlane.elevation
    }

    if (cameraView === 'TOP') {
      controlsRef.current.setLookAt(
        tx,
        cy + 35,
        tz + 0.01,
        tx,
        cy,
        tz,
        true
      )
    } else if (cameraView === 'FRONT') {
      controlsRef.current.setLookAt(
        tx,
        cy,
        tz + 25,
        tx,
        cy,
        tz,
        true
      )
    } else {
      // ISO (or home view if targetId is null)
      controlsRef.current.setLookAt(
        tx + 15,
        cy + 10,
        tz + 15,
        tx,
        cy,
        tz,
        true
      )
    }
  }, [cameraView, cameraSwoopTrigger, isSketchMode, sketchWorkingPlane])

  useEffect(() => {
    const controls = controlsRef.current
    const perspective = perspectiveRef.current
    const orthographic = orthographicRef.current
    if (!controls || !perspective || !orthographic) return

    const target = new THREE.Vector3()
    controls.getTarget(target)

    if (cameraProjection === 'PERSPECTIVE') {
      const visibleHeight = (orthographic.top - orthographic.bottom) / orthographic.zoom
      const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)))
      const direction = new THREE.Vector3().copy(orthographic.position).sub(target)
      if (direction.lengthSq() < 0.000001) {
        direction.set(1, 1, 1)
      }
      direction.normalize()

      const nextPos = new THREE.Vector3().copy(target).addScaledVector(direction, distance)
      
      perspective.position.copy(nextPos)
      perspective.quaternion.copy(orthographic.quaternion)
      perspective.updateProjectionMatrix()

      controls.camera = perspective
      controls.setLookAt(
        nextPos.x,
        nextPos.y,
        nextPos.z,
        target.x,
        target.y,
        target.z,
        false
      )
    } else {
      const distance = perspective.position.distanceTo(target)
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * Math.max(distance, 0.001)

      orthographic.position.copy(perspective.position)
      orthographic.quaternion.copy(perspective.quaternion)
      const nextZoom = THREE.MathUtils.clamp((orthographic.top - orthographic.bottom) / visibleHeight, 0.2, 200)
      orthographic.zoom = nextZoom
      orthographic.updateProjectionMatrix()

      controls.camera = orthographic
      controls.setLookAt(
        perspective.position.x,
        perspective.position.y,
        perspective.position.z,
        target.x,
        target.y,
        target.z,
        false
      )
      controls.zoomTo(nextZoom, false)
    }
  }, [cameraProjection])

  useFrame(() => {
    const controls = controlsRef.current
    const perspective = perspectiveRef.current
    const orthographic = orthographicRef.current
    if (!controls || !perspective || !orthographic) return

    // Position and scale the pivot marker and the drop line dynamically
    if (pivotRef.current && dropLineRef.current) {
      const targetVec = syncTargetRef.current
      controls.getTarget(targetVec)
      
      pivotRef.current.position.copy(targetVec)
      
      const s = cameraProjection === 'PERSPECTIVE'
        ? camera.position.distanceTo(targetVec) / 16
        : 20 / camera.zoom
      pivotRef.current.scale.set(s, s, s)

      dropLineRef.current.position.set(targetVec.x, 0, targetVec.z)
      dropLineRef.current.scale.y = Math.max(0, targetVec.y)
    }

    const target = controls.getTarget(syncTargetRef.current, true)

    if (cameraProjection === 'PERSPECTIVE') {
      const distance = perspective.position.distanceTo(target)
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * Math.max(distance, 0.001)

      orthographic.position.copy(perspective.position)
      orthographic.quaternion.copy(perspective.quaternion)
      orthographic.zoom = THREE.MathUtils.clamp((orthographic.top - orthographic.bottom) / visibleHeight, 0.2, 200)
      orthographic.updateProjectionMatrix()
    } else {
      const visibleHeight = (orthographic.top - orthographic.bottom) / orthographic.zoom
      const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)))
      const direction = syncDirectionRef.current.copy(orthographic.position).sub(target)

      if (direction.lengthSq() < 0.000001) {
        direction.set(1, 1, 1)
      }

      direction.normalize()
      perspective.position.copy(target).addScaledVector(direction, distance)
      perspective.quaternion.copy(orthographic.quaternion)
      perspective.updateProjectionMatrix()
    }
  })

  return (
    <>
      <PerspectiveCamera 
          ref={perspectiveRef}
          makeDefault={cameraProjection === 'PERSPECTIVE'}
          position={[0, 15, 15]} 
          fov={35} 
          near={0.1}
          far={50000} 
        />
      <OrthographicCamera 
          ref={orthographicRef}
          makeDefault={cameraProjection === 'ORTHOGRAPHIC'}
          position={[0, 15, 15]} 
          zoom={20} 
          near={-50000}
          far={50000} 
        />
      
      <CameraControls
        ref={controlsRef}
        enabled={!isDraggingFurniture}
        makeDefault
        dollyToCursor
        infinityDolly
        smoothTime={0.18}
        draggingSmoothTime={0.04}
        restThreshold={0.002}
        minDistance={2}
        maxDistance={50000}
        dollySpeed={1.8}
        truckSpeed={1.25}
        azimuthRotateSpeed={0.7}
        polarRotateSpeed={0.7}
        mouseButtons={{
          left: isSketchMode && cadWorkspaceMode === '2D'
            ? CameraControlsImpl.ACTION.NONE
            : CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.TRUCK,
          right: CameraControlsImpl.ACTION.TRUCK,
          wheel: CameraControlsImpl.ACTION.NONE,
        }}
        touches={{
          one: isSketchMode && cadWorkspaceMode === '2D'
            ? CameraControlsImpl.ACTION.NONE
            : CameraControlsImpl.ACTION.TOUCH_ROTATE,
          two: CameraControlsImpl.ACTION.NONE,
          three: CameraControlsImpl.ACTION.NONE,
        }}
      />

      {/* CAD style origin/rotation center dot indicator */}
      <group ref={pivotRef}>
        <mesh renderOrder={100}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color="#22d3ee" depthTest={false} transparent opacity={0.88} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={100}>
          <ringGeometry args={[0.13, 0.15, 32]} />
          <meshBasicMaterial color="#22d3ee" depthTest={false} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Visual vertical drop shadow depth guideline (dashed line) */}
      <lineSegments ref={dropLineRef} renderOrder={99}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 0, 1, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#22d3ee" transparent opacity={0.45} depthTest={true} />
      </lineSegments>
    </>
  )
}





