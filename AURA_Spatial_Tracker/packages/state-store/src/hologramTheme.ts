export const hologramPalettes = {
  primeCyan: {
    background: '#020617',
    grid: '#0891b2',
    buildingFill: '#67e8f9',
    buildingEdge: '#cffafe',
    furnitureFill: '#06b6d4',
    furnitureEdge: '#22d3ee',
    innerFill: '#be123c',
    innerEdge: '#fb7185',
    itemFill: '#164e63',
    itemEdge: '#38bdf8',
    selectionEdge: '#ffffff',
    snapGuide: '#fb7185',
    collisionDebug: '#22c55e',
  },
  deepTeal: {
    background: '#020617',
    grid: '#0e7490',
    buildingFill: '#a5f3fc',
    buildingEdge: '#ecfeff',
    furnitureFill: '#0891b2',
    furnitureEdge: '#67e8f9',
    innerFill: '#115e59',
    innerEdge: '#5eead4',
    itemFill: '#134e4a',
    itemEdge: '#2dd4bf',
    selectionEdge: '#ffffff',
    snapGuide: '#fb7185',
    collisionDebug: '#22c55e',
  },
  blueSignal: {
    background: '#020617',
    grid: '#0284c7',
    buildingFill: '#7dd3fc',
    buildingEdge: '#e0f2fe',
    furnitureFill: '#2563eb',
    furnitureEdge: '#93c5fd',
    innerFill: '#1d4ed8',
    innerEdge: '#60a5fa',
    itemFill: '#1e3a8a',
    itemEdge: '#38bdf8',
    selectionEdge: '#ffffff',
    snapGuide: '#fb7185',
    collisionDebug: '#22c55e',
  },
  labGreen: {
    background: '#020617',
    grid: '#0d9488',
    buildingFill: '#99f6e4',
    buildingEdge: '#ccfbf1',
    furnitureFill: '#14b8a6',
    furnitureEdge: '#5eead4',
    innerFill: '#15803d',
    innerEdge: '#86efac',
    itemFill: '#14532d',
    itemEdge: '#4ade80',
    selectionEdge: '#ffffff',
    snapGuide: '#fb7185',
    collisionDebug: '#22c55e',
  },
} as const;

export type HologramPaletteName = keyof typeof hologramPalettes;

export const defaultHologramPaletteName: HologramPaletteName = 'primeCyan';
export const defaultHologramPalette = hologramPalettes[defaultHologramPaletteName];

export const hologramOpacity = {
  buildingFill: 0.08,
  wallFill: 0.14,
  furnitureFill: 0.18,
  innerFill: 0.32,
  itemFill: 0.45,
  handleFill: 0.88,
  collisionDebug: 0.12,
} as const;

export const hologramMaterialSwatches = [
  { name: 'Cyan Shell', color: '#06b6d4' },
  { name: 'Light Cyan Shell', color: '#67e8f9' },
  { name: 'Teal Body', color: '#14b8a6' },
  { name: 'Deep Teal Inner', color: '#0f766e' },
  { name: 'Rose Inner', color: '#be123c' },
  { name: 'Signal Rose', color: '#fb7185' },
  { name: 'Blue Structure', color: '#2563eb' },
  { name: 'Soft Blue Edge', color: '#60a5fa' },
  { name: 'Green Debug', color: '#22c55e' },
] as const;

