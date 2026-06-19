import * as THREE from 'three'

interface InfiniteGridProps {
  opacity: number
}

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = `
  #extension GL_OES_standard_derivatives : enable

  uniform vec3 gridColor;
  uniform float opacity;
  varying vec3 vWorldPosition;

  float gridLine(vec2 coord, float cellSize, float lineWidth) {
    vec2 gridCoord = coord / cellSize;
    vec2 derivative = fwidth(gridCoord);
    vec2 line = abs(fract(gridCoord - 0.5) - 0.5) / max(derivative, vec2(0.0001));
    float nearestLine = min(line.x, line.y);
    return 1.0 - smoothstep(lineWidth, lineWidth + 1.0, nearestLine);
  }

  void main() {
    vec2 coord = vWorldPosition.xz;
    float minor = gridLine(coord, 1.0, 0.55);
    float major = gridLine(coord, 5.0, 0.75);
    float alpha = max(minor * 0.45, major) * opacity * 0.35;

    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(gridColor, alpha);
  }
`

export function InfiniteGrid({ opacity }: InfiniteGridProps) {
  if (opacity <= 0) return null

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={5}>
      <planeGeometry args={[100000, 100000, 1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
        uniforms={{
          gridColor: { value: new THREE.Color('#94a3b8') },
          opacity: { value: opacity },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        toneMapped={false}
      />
    </mesh>
  )
}
