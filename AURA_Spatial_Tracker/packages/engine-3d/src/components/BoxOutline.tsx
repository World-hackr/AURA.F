import { useMemo } from 'react'

export function BoxOutline({ size, color, opacity = 0.95 }: { size: [number, number, number], color: string, opacity?: number }) {
  const positions = useMemo(() => {
    const [w, h, d] = size
    const x = w / 2
    const y = h / 2
    const z = d / 2
    const corners = [
      [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
      [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
    ]
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ]

    return new Float32Array(edges.flatMap(([a, b]) => [...corners[a], ...corners[b]]))
  }, [size])

  return (
    <lineSegments renderOrder={20}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthTest={false} />
    </lineSegments>
  )
}

