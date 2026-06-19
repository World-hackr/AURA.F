import { useEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import { CameraControls, CameraControlsImpl, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useSpatialStore } from '@aura/state-store'
import * as THREE from 'three'

export function IsometricCamera() {
  const isDraggingFurniture = useSpatialStore(state => state.isDraggingFurniture)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const cameraTargetId = useSpatialStore(state => state.cameraTargetId)
  const cameraSwoopTrigger = useSpatialStore(state => state.cameraSwoopTrigger)
  const furniture = useSpatialStore(state => state.furniture)
  const { camera, gl } = useThree()
  
  const controlsRef = useRef<ComponentRef<typeof CameraControls>>(null)
  const perspectiveRef = useRef<THREE.PerspectiveCamera>(null)
  const orthographicRef = useRef<THREE.OrthographicCamera>(null)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastTouchRef = useRef<{ x: number; y: number; distance: number } | null>(null)
  const syncTargetRef = useRef(new THREE.Vector3())
  const syncDirectionRef = useRef(new THREE.Vector3())

  useEffect(() => {
    const canvas = gl.domElement
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
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
      const rect = canvas.getBoundingClientRect()
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -(((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1)
      )

      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.ray.intersectPlane(groundPlane, cursorPoint)
      if (hit) return hit

      return controls.getTarget(cursorPoint)
    }

    const zoomAt = (clientX: number, clientY: number, rawDelta: number) => {
      const controls = controlsRef.current
      if (!controls) return

      const normalizedDelta = THREE.MathUtils.clamp(rawDelta / 120, -2.5, 2.5)
      if (Math.abs(normalizedDelta) < 0.002) return
      const requestedFactor = THREE.MathUtils.clamp(Math.pow(0.72, normalizedDelta), 0.45, 2.2)
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

    const truckByPixels = (deltaX: number, deltaY: number) => {
      const controls = controlsRef.current
      if (!controls) return
      const rect = canvas.getBoundingClientRect()
      const worldUnitsPerPixel = getWorldHeight(controls) / Math.max(rect.height, 1)
      controls.truck(deltaX * worldUnitsPerPixel, -deltaY * worldUnitsPerPixel, false)
    }

    const handleWheel = (e: WheelEvent) => {
      const controls = controlsRef.current
      if (!controls) return

      e.preventDefault()
      e.stopImmediatePropagation()

      if (e.ctrlKey) {
        zoomAt(e.clientX, e.clientY, -e.deltaY)
        return
      }

      truckByPixels(e.deltaX, -e.deltaY)
    }

    const handlePointerDown = (e: PointerEvent) => {
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
      truckByPixels(current.x - previous.x, previous.y - current.y)

      const pinchDelta = current.distance - previous.distance
      if (Math.abs(pinchDelta) > 0.5) {
        zoomAt(current.x, current.y, pinchDelta * 2.5)
      }

      lastTouchRef.current = current
    }

    const handlePointerEnd = (e: PointerEvent) => {
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

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false })
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false })
    canvas.addEventListener('pointerup', handlePointerEnd, { passive: false })
    canvas.addEventListener('pointercancel', handlePointerEnd, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerEnd)
      canvas.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [camera, gl])

  const targetStr = useMemo(() => {
    const targetFurniture = furniture.find(f => f.id === cameraTargetId)
    if (!targetFurniture) return "0,2,0"
    const [x, y, z] = targetFurniture.position
    return `${x},${y + 2},${z}`
  }, [cameraTargetId, furniture])

  useEffect(() => {
    const [tx, ty, tz] = targetStr.split(',').map(Number)

    if (cameraTargetId && controlsRef.current) {
      controlsRef.current.setLookAt(
        tx + 12,
        ty + 10,
        tz + 12,
        tx,
        ty,
        tz,
        true
      )
    }
  }, [targetStr, cameraTargetId, cameraSwoopTrigger])

  useFrame(() => {
    const controls = controlsRef.current
    const perspective = perspectiveRef.current
    const orthographic = orthographicRef.current
    if (!controls || !perspective || !orthographic) return

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
          left: CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.TRUCK,
          right: CameraControlsImpl.ACTION.TRUCK,
          wheel: CameraControlsImpl.ACTION.NONE,
        }}
        touches={{
          one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
          two: CameraControlsImpl.ACTION.NONE,
          three: CameraControlsImpl.ACTION.NONE,
        }}
      />
    </>
  )
}





