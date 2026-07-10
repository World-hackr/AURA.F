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
  fadeStart = 50.0,
  fadeEnd = 160.0
}: InfiniteGridHelperProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  // Define uniforms outside so they aren't reconstructed every render
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
      // Pass the camera's XZ horizontal position directly to the shader
      material.uniforms.uCameraPos.value.set(camera.position.x, 0, camera.position.z)
    }
  })

  // GLSL Shader code for generating infinitely tiling, anti-aliased grid lines
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      // Output large world positions directly to draw an infinite plane
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

    // Calculates crisp anti-aliased grid lines procedurally
    float getGridLine(float position, float spacing, float width) {
      float dist = abs(fract(position / spacing - 0.5) - 0.5) / (width / spacing);
      float line = 1.0 - min(dist, 1.0);
      return line;
    }

    void main() {
      // Calculate radial distance of the pixel from the camera's projection target coordinate
      float d = distance(vWorldPosition.xz, uCameraPos.xz);
      
      // Perform smooth circular fading so there are no sharp clipping edges
      float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, d);
      if (fade <= 0.0) discard;

      // Draw major grid lines (1m increments)
      float majorX = getGridLine(vWorldPosition.x, uGridSize, 0.012);
      float majorZ = getGridLine(vWorldPosition.z, uGridSize, 0.012);
      float major = max(majorX, majorZ);

      // Draw minor grid lines (10cm increments)
      float minorX = getGridLine(vWorldPosition.x, uSubGridSize, 0.004);
      float minorZ = getGridLine(vWorldPosition.z, uSubGridSize, 0.004);
      float minor = max(minorX, minorZ);

      // Combine colors: major grid lines overlay minor grid lines
      vec3 color = mix(vec3(0.0), uSubGridColor, minor);
      color = mix(color, uGridColor, major);

      // Interpolate alpha opacity based on the soft fade factor
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
