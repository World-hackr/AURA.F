import { useState, useMemo } from 'react'
import * as THREE from 'three'
import { useGizmoContext, Edges, Text, Billboard } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'


/**
 * Custom FBX ViewCube Component
 * Loads, normalizes, and classifies the 27 bodies exported from Fusion 360
 * into interactive holographic faces, edges, and corners for camera control.
 */
export function ChamferedViewCube() {
  const { tweenCamera } = useGizmoContext()
  const fbx = useLoader(FBXLoader, '/models/viewcube.fbx') as THREE.Group
  const [hoveredName, setHoveredName] = useState<string | null>(null)

  // Compute centers and classify meshes once on load
  const meshes = useMemo(() => {
    const box = new THREE.Box3().setFromObject(fbx)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scaleFactor = 1.0 / maxDim

    const list: Array<{
      name: string
      geometry: THREE.BufferGeometry
      normalizedCenter: THREE.Vector3
      role: 'core' | 'face' | 'edge' | 'corner'
    }> = []

    fbx.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox()
        const localBox = child.geometry.boundingBox!.clone()
        const localCenter = new THREE.Vector3()
        localBox.getCenter(localCenter)
        localCenter.applyMatrix4(child.matrix)

        // Center and normalize coordinates to a range of approx [-0.5, 0.5]
        const normCenter = new THREE.Vector3(
          (localCenter.x - center.x) * scaleFactor,
          (localCenter.y - center.y) * scaleFactor,
          (localCenter.z - center.z) * scaleFactor
        )

        const threshold = 0.15
        const absX = Math.abs(normCenter.x)
        const absY = Math.abs(normCenter.y)
        const absZ = Math.abs(normCenter.z)

        const nonZeroX = absX > threshold
        const nonZeroY = absY > threshold
        const nonZeroZ = absZ > threshold
        const nonZeroCount = (nonZeroX ? 1 : 0) + (nonZeroY ? 1 : 0) + (nonZeroZ ? 1 : 0)

        let role: 'core' | 'face' | 'edge' | 'corner' = 'core'
        if (nonZeroCount === 1) role = 'face'
        else if (nonZeroCount === 2) role = 'edge'
        else if (nonZeroCount === 3) role = 'corner'

        // Clone geometry and apply child matrix to align vertex coordinates to parent root
        const geom = child.geometry.clone()
        geom.applyMatrix4(child.matrix)
        
        // Scale and translate geometry vertices so the entire model is unit-scaled and centered at (0,0,0)
        geom.translate(-center.x, -center.y, -center.z)
        geom.scale(scaleFactor, scaleFactor, scaleFactor)

        list.push({
          name: child.name,
          geometry: geom,
          normalizedCenter: normCenter,
          role
        })
      }
    })

    return list
  }, [fbx])

  // Get color, emissive, and opacity properties based on role and interaction state
  const getMeshColors = (role: string, normCenter: THREE.Vector3, isHovered: boolean) => {
    // 1. Core mesh (The inner glowing light source)
    if (role === 'core') {
      return { 
        fill: '#22d3ee',      // Glowing neon cyan core
        edge: '#e0f2fe',      // High-brightness outline
        opacity: 0.95, 
        renderOrder: 1,
        emissive: undefined,
        emissiveIntensity: undefined
      }
    }

    // 2. Hovered outer plates (Act as glowing buttons)
    if (isHovered) {
      if (role === 'face') {
        if (Math.abs(normCenter.x) > 0.15) {
          return { fill: '#b91c1c', emissive: '#ef4444', emissiveIntensity: 1.5, edge: '#ffffff', opacity: 0.95, renderOrder: 3 } // X Axis = Red
        }
        if (Math.abs(normCenter.y) > 0.15) {
          return { fill: '#15803d', emissive: '#22c55e', emissiveIntensity: 1.5, edge: '#ffffff', opacity: 0.95, renderOrder: 3 } // Y Axis = Green (Top/Bottom)
        }
        return { fill: '#1d4ed8', emissive: '#3b82f6', emissiveIntensity: 1.5, edge: '#ffffff', opacity: 0.95, renderOrder: 3 } // Z Axis = Blue (Front/Back)
      }
      if (role === 'edge') {
        return { fill: '#0f766e', emissive: '#2dd4bf', emissiveIntensity: 1.5, edge: '#ffffff', opacity: 0.95, renderOrder: 3 } // Edge = Teal
      }
      return { fill: '#be123c', emissive: '#fb7185', emissiveIntensity: 1.5, edge: '#ffffff', opacity: 0.95, renderOrder: 3 } // Corner = Pink
    }

    // 3. Idle outer plates (Beautiful deep space-blue frosted glass catching lights and highlighting shapes)
    // Core light leaks strongly through the crevices.
    return {
      fill: '#152538',        // Elegant medium-dark space-blue glass fill
      emissive: '#082e4f',    // Soft glowing cyan-blue tint
      emissiveIntensity: 0.35, // Soft ambient glow so it stands out from the black background
      edge: '#0ea5e9',        // Bright sky-blue wireframe boundaries
      opacity: 0.88,          // Mostly opaque to block light except at crevices
      renderOrder: 2
    }
  }

  // Returns text label and 3D rotation based on face direction coordinates
  const getFaceLabelInfo = (normCenter: THREE.Vector3) => {
    const absX = Math.abs(normCenter.x)
    const absY = Math.abs(normCenter.y)
    const absZ = Math.abs(normCenter.z)

    if (absX > absY && absX > absZ) {
      return {
        text: normCenter.x > 0 ? 'R' : 'L',
        rotation: [0, normCenter.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0] as [number, number, number]
      }
    }
    if (absY > absX && absY > absZ) {
      return {
        text: normCenter.y > 0 ? 'T' : 'D', // T = Top, D = Down
        rotation: [normCenter.y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0] as [number, number, number]
      }
    }
    return {
      text: normCenter.z > 0 ? 'F' : 'B', // F = Front, B = Back
      rotation: [0, normCenter.z > 0 ? 0 : Math.PI, 0] as [number, number, number]
    }
  }

  return (
    <group scale={[65, 65, 65]}>
      {/* Localized lighting specifically for this ViewCube's portal */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 3]} intensity={3.5} />
      
      {/* Inner glowing point light source that leaks through crevices */}
      <pointLight position={[0, 0, 0]} intensity={4.5} color="#22d3ee" distance={1.8} decay={1.2} />
 
      {/* CAD Axis Arrows protruding from the corner */}
      <axesHelper position={[-0.6, -0.6, -0.6]} args={[1.5]} />
 
      {meshes.map(mesh => {
        const isHovered = hoveredName === mesh.name
        const colors = getMeshColors(mesh.role, mesh.normalizedCenter, isHovered)
        const isCore = mesh.role === 'core'
 
        // Shift plate outward along its normal center vector when hovered to create a magnetic pop-out attraction effect
        const offsetPosition = (isHovered && !isCore)
          ? mesh.normalizedCenter.clone().normalize().multiplyScalar(0.045)
          : new THREE.Vector3(0, 0, 0)
 
        return (
          <group 
            key={mesh.name}
            position={offsetPosition}
          >
            <mesh
              geometry={mesh.geometry}
              renderOrder={colors.renderOrder}
              onPointerOver={e => {
                e.stopPropagation()
                setHoveredName(mesh.name)
              }}
              onPointerOut={e => {
                e.stopPropagation()
                setHoveredName(null)
              }}
              onClick={e => {
                e.stopPropagation()
                // Normalized camera view vector
                const viewDirection = mesh.normalizedCenter.clone().normalize()
                tweenCamera(viewDirection.multiplyScalar(5))
              }}
            >
              {isCore ? (
                <meshBasicMaterial
                  color={colors.fill}
                  transparent={false}
                  depthWrite={true}
                  depthTest={true}
                />
              ) : (
                <meshStandardMaterial
                  color={colors.fill}
                  emissive={colors.emissive}
                  emissiveIntensity={colors.emissiveIntensity}
                  roughness={isHovered ? 0.05 : 0.2}
                  metalness={0.9}
                  transparent
                  opacity={colors.opacity}
                  depthWrite={false}
                />
              )}
              {/* Only render wireframe outlines for outer buttons, not the core light source */}
              {!isCore && <Edges scale={1.0} color={colors.edge} lineWidth={isHovered ? 2.2 : 1.2} />}
            </mesh>
            
            {/* Draw sharp, technical vector labels offset on the faces */}
            {mesh.role === 'face' && (() => {
              const labelInfo = getFaceLabelInfo(mesh.normalizedCenter)
              // Slightly push text past geometry face to avoid clipping
              const textPos = mesh.normalizedCenter.clone().normalize().multiplyScalar(0.505)
              return (
                <Text
                  position={textPos}
                  rotation={labelInfo.rotation}
                  fontSize={0.24}
                  color={isHovered ? '#ffffff' : '#94a3b8'}
                  anchorX="center"
                  anchorY="middle"
                  material-depthTest={true}
                  material-depthWrite={true}
                  renderOrder={4}
                >
                  {labelInfo.text}
                </Text>
              )
            })()}
          </group>
        )
      })}
    </group>
  )
}

export function GimbalViewCube() {
  const { tweenCamera } = useGizmoContext()
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null)

  const axisData = [
    { name: 'R', dir: new THREE.Vector3(1, 0, 0), color: '#ef4444', hoverColor: '#fca5a5' }, // X+ (Right)
    { name: 'L', dir: new THREE.Vector3(-1, 0, 0), color: '#ef4444', hoverColor: '#fca5a5', isNegative: true }, // X- (Left)
    { name: 'T', dir: new THREE.Vector3(0, 1, 0), color: '#22c55e', hoverColor: '#86efac' }, // Y+ (Top)
    { name: 'D', dir: new THREE.Vector3(0, -1, 0), color: '#22c55e', hoverColor: '#86efac', isNegative: true }, // Y- (Down)
    { name: 'F', dir: new THREE.Vector3(0, 0, 1), color: '#3b82f6', hoverColor: '#93c5fd' }, // Z+ (Front)
    { name: 'B', dir: new THREE.Vector3(0, 0, -1), color: '#3b82f6', hoverColor: '#93c5fd', isNegative: true }, // Z- (Back)
  ]

  return (
    <group scale={[65, 65, 65]}>
      {/* Light for the portal */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 3]} intensity={3.5} />

      {/* Main Transparent Outer Sphere (Greyish glass bubble) */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshStandardMaterial
          transparent
          opacity={0.22}
          color="#94a3b8"
          emissive="#e2e8f0"
          emissiveIntensity={0.3}
          roughness={0.1}
          metalness={0.9}
          depthWrite={false}
        />
      </mesh>

      {/* Origin Center Point */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#e2e8f0" />
      </mesh>

      {/* Render 3 Axis Lines (Cylinders extending only in positive directions) */}
      {/* X+ Axis (Right) */}
      <mesh position={[0.35, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.024, 0.7, 8]} />
        <meshBasicMaterial color="#ef4444" opacity={0.85} transparent />
      </mesh>
      {/* Y+ Axis (Top) */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.7, 8]} />
        <meshBasicMaterial color="#22c55e" opacity={0.85} transparent />
      </mesh>
      {/* Z+ Axis (Front) */}
      <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.7, 8]} />
        <meshBasicMaterial color="#3b82f6" opacity={0.85} transparent />
      </mesh>

      {/* Axis Ends (Balls + Labels) */}
      {axisData.map(axis => {
        const isHovered = hoveredAxis === axis.name
        const pos = axis.dir.clone().multiplyScalar(0.7)

        return (
          <group key={axis.name}>
            {/* Interactive Ball on Tip (Big and Bright) */}
            <mesh
              position={pos}
              onPointerOver={e => {
                e.stopPropagation()
                setHoveredAxis(axis.name)
              }}
              onPointerOut={e => {
                e.stopPropagation()
                setHoveredAxis(null)
              }}
              onClick={e => {
                e.stopPropagation()
                tweenCamera(axis.dir.clone().multiplyScalar(5))
              }}
            >
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshBasicMaterial
                color={isHovered ? axis.hoverColor : axis.color}
                transparent={axis.isNegative}
                opacity={axis.isNegative ? 0.45 : 1.0}
              />
            </mesh>

            {/* Billboarded Label Text (Center-aligned on sphere axis, always pointing to camera) */}
            <Billboard position={pos}>
              <Text
                fontSize={0.26}
                color={axis.isNegative ? '#ffffff' : '#000000'}
                anchorX="center"
                anchorY="middle"
                material-depthTest={false}
                renderOrder={5}
              >
                {axis.name}
              </Text>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}

