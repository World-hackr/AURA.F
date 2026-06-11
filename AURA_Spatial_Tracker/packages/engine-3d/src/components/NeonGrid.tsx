import { Grid } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

export function NeonGrid() {
  const gridOpacity = useSpatialStore(state => state.gridOpacity)

  if (gridOpacity === 0) return null;

  return (
    <Grid
      position={[0, -0.01, 0]}
      args={[100, 100]}
      cellSize={1}
      cellThickness={1}
      cellColor={`rgba(51, 51, 51, ${gridOpacity})`}
      sectionSize={5}
      sectionThickness={1.5}
      sectionColor={`rgba(85, 85, 85, ${gridOpacity})`}
      fadeDistance={100}
      fadeStrength={1.5}
      infiniteGrid={true}
    />
  )
}
