import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface InfiniteGridHelperProps {
  gridSize?: number
  subGridSize?: number
  gridColor?: string
  subGridColor?: string
  fadeStart?: number
  fadeEnd?: number
}

export function InfiniteGridHelper({
  gridSize = 1.0,
  subGridSize = 0.1,
  gridColor = '#1e293b',
  subGridColor = '#0f172a',
  fadeStart = 60.0,
  fadeEnd = 180.0
}: InfiniteGridHelperProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const uniformsRef = useRef({
    uCameraPos: { value: new THREE.Vector3() },
    uGridSize: { value: gridSize },
    uSubGridSize: { value: subGridSize },
    uGridColor: { value: new THREE.Color(gridColor) },
    uSubGridColor: { value: new THREE.Color(subGridColor) },
    uFadeStart: { value: fadeStart },
    uFadeEnd: { value: fadeEnd }
  })

  useFrame(() => {
    if (!meshRef.current) return
    const material = meshRef.current.material as THREE.ShaderMaterial
    if (material.uniforms && material.uniforms.uCameraPos) {
      material.uniforms.uCameraPos.value.set(camera.position.x, 0, camera.position.z)
    }
  })

  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `

  const fragmentShader = `
    uniform vec3 uCameraPos;
    uniform float uGridSize;
    uniform float uSubGridSize;
    uniform vec3 uGridColor;
    uniform vec3 uSubGridColor;
    uniform float uFadeStart;
    uniform float uFadeEnd;
    varying vec3 vWorldPosition;

    // Calculates constant screen-space width grid lines using derivatives (fwidth)
    float getGridLine(float position, float spacing, float pixelWidth) {
      // Find how fast the world coordinates change per screen pixel
      float dx = fwidth(position);
      
      // Distance to the nearest grid interval
      float distToLine = abs(fract(position / spacing - 0.5) - 0.5) * spacing;
      
      // Scale world width line boundary to match target pixel thickness
      float worldWidth = pixelWidth * dx;
      
      // Perform screen-space anti-aliasing
      return smoothstep(worldWidth, 0.0, distToLine);
    }

    void main() {
      float d = distance(vWorldPosition.xz, uCameraPos.xz);
      float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, d);
      if (fade <= 0.0) discard;

      // Draw major grid lines (constant screen-space width of 1.4 pixels)
      float majorX = getGridLine(vWorldPosition.x, uGridSize, 1.4);
      float majorZ = getGridLine(vWorldPosition.z, uGridSize, 1.4);
      float major = max(majorX, majorZ);

      // Draw minor grid lines (constant screen-space width of 0.8 pixels)
      float minorX = getGridLine(vWorldPosition.x, uSubGridSize, 0.8);
      float minorZ = getGridLine(vWorldPosition.z, uSubGridSize, 0.8);
      float minor = max(minorX, minorZ);

      // Mix colors based on line calculations
      vec3 color = mix(vec3(0.0), uSubGridColor, minor);
      color = mix(color, uGridColor, major);

      float alpha = max(major * 0.45, minor * 0.16) * fade;
      if (alpha < 0.005) discard;

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <mesh 
      ref={meshRef} 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.015, 0]}
    >
      <planeGeometry args={[12000, 12000]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniformsRef.current}
      />
    </mesh>
  )
}
