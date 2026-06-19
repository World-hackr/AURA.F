import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AuraAssetDefinition, Container, Furniture, Item, Vector3 } from './types';
import { defaultHologramPalette as holo, hologramOpacity } from './hologramTheme';

export type CameraViewType = 'ISO' | 'TOP' | 'FRONT';
export type CameraProjectionType = 'PERSPECTIVE' | 'ORTHOGRAPHIC';
export type CameraSnapshot = {
  position: Vector3;
  target: Vector3;
  distance: number;
  visibleHeight: number;
};

export interface AlignmentGuideData {
  axis: 'X' | 'Z';
  position: number; // The coordinate on the axis where the line should be drawn
}

interface SpatialState {
  // --- Data ---
  roomDimensions: Vector3; // [width, height, depth]
  furniture: Furniture[];
  assetDefinitions: Record<string, AuraAssetDefinition>;
  
  // --- UI/Interaction State ---
  searchQuery: string;
  focusedFurnitureId: string | null;
  cameraTargetId: string | null;
  cameraSwoopTrigger: number;
  selectedContainerId: string | null;
  isDraggingFurniture: boolean;
  cameraView: CameraViewType;
  cameraProjection: CameraProjectionType;
  cameraSnapshot: CameraSnapshot | null;
  gridOpacity: number;
  abyssDarkness: number;
  doubleClickDelay: number;
  gizmoMode: 'translate' | 'scale' | 'rotate';
  isSnappingEnabled: boolean;
  showSnapFootprints: boolean;
  activeAlignments: AlignmentGuideData[]; // Live alignment lines to draw
  draggingPosition: Vector3 | null;
  selectedAssetDefinitionId: string;
  pendingPlacementModelId: string | null;
  placementPosition: Vector3 | null;
  
  // --- Actions: State Mutators ---
  setRoomDimensions: (dimensions: Vector3) => void;
  addFurniture: (modelId: string, position: Vector3) => void;
  removeFurniture: (id: string) => void;
  updateFurnitureName: (id: string, name: string) => void;
  updateFurniturePosition: (id: string, newPosition: Vector3) => void;
  updateFurnitureDimensions: (id: string, newDimensions: Vector3) => void;
  updateFurnitureRotation: (id: string, rotationY: number) => void;
  upsertAssetDefinition: (asset: AuraAssetDefinition) => void;
  updateAssetDefinition: (id: string, patch: Partial<AuraAssetDefinition>) => void;
  updateAssetFootprint: (id: string, footprint: AuraAssetDefinition['footprint']) => void;
  updateAssetCollisionBox: (assetId: string, boxId: string, patch: Partial<AuraAssetDefinition['collision'][number]>) => void;
  updateAssetSnapPoint: (assetId: string, pointId: string, patch: Partial<AuraAssetDefinition['snapPoints'][number]>) => void;
  updateAssetPart: (assetId: string, partId: string, patch: Partial<AuraAssetDefinition['parts'][number]>) => void;
  updateAssetMaterial: (assetId: string, materialId: string, patch: Partial<AuraAssetDefinition['materials'][number]>) => void;
  addContainer: (furnitureId: string, name: string, type: Container['type']) => void;
  addItem: (furnitureId: string, containerId: string, name: string, quantity: number) => void;
  
  // --- Actions: UI Mutators ---
  setSearchQuery: (query: string) => void;
  focusFurniture: (id: string | null) => void;
  setCameraTarget: (id: string | null) => void;
  selectContainer: (id: string | null) => void;
  setIsDraggingFurniture: (isDragging: boolean) => void;
  setCameraView: (view: CameraViewType) => void;
  setCameraProjection: (proj: CameraProjectionType) => void;
  setCameraSnapshot: (snapshot: CameraSnapshot | null) => void;
  setGridOpacity: (opacity: number) => void;
  setBackgroundDarkness: (darkness: number) => void;
  setDoubleClickDelay: (delay: number) => void;
  setGizmoMode: (mode: 'translate' | 'scale' | 'rotate') => void;
  setIsSnappingEnabled: (enabled: boolean) => void;
  setShowSnapFootprints: (enabled: boolean) => void;
  setDraggingPosition: (pos: Vector3 | null) => void;
  setActiveAlignments: (alignments: AlignmentGuideData[]) => void;
  setSelectedAssetDefinitionId: (id: string) => void;
  setPendingPlacementModelId: (id: string | null) => void;
  setPlacementPosition: (position: Vector3 | null) => void;
  
  // --- Selectors (Derived Data) ---
  getSearchResults: () => Array<{ item: Item, containerName: string, containerId: string, furnitureName: string, furnitureId: string }>;
}

const defaultAssetDefinitions: Record<string, AuraAssetDefinition> = {
  parametric: {
    id: 'parametric',
    displayName: 'Parametric Cabinet',
    supportedFileType: 'generated',
    defaultDimensions: [4, 6, 2],
    footprint: { width: 4.2, depth: 2.1, offset: [0, -0.05] },
    collision: [
      { id: 'cabinet-body', name: 'Cabinet Body', center: [0, 3, -0.05], size: [4.2, 6.2, 2.1] },
    ],
    snapPoints: [
      { id: 'left-edge', name: 'Left Edge', position: [-2.1, 0, 0] },
      { id: 'right-edge', name: 'Right Edge', position: [2.1, 0, 0] },
      { id: 'front-edge', name: 'Front Edge', position: [0, 0, 1] },
      { id: 'back-edge', name: 'Back Edge', position: [0, 0, -1.1] },
    ],
    parts: [
      { id: 'drawer-1', name: 'Drawer 1', motion: 'slide', axis: [0, 0, 1], closedOffset: 0.1, openOffset: 1.6, containerBounds: { center: [0, 1.05, 0], size: [3.6, 0.9, 1.6] } },
      { id: 'drawer-2', name: 'Drawer 2', motion: 'slide', axis: [0, 0, 1], closedOffset: 0.1, openOffset: 1.6, containerBounds: { center: [0, 2.35, 0], size: [3.6, 0.9, 1.6] } },
      { id: 'drawer-3', name: 'Drawer 3', motion: 'slide', axis: [0, 0, 1], closedOffset: 0.1, openOffset: 1.6, containerBounds: { center: [0, 3.65, 0], size: [3.6, 0.9, 1.6] } },
      { id: 'drawer-4', name: 'Drawer 4', motion: 'slide', axis: [0, 0, 1], closedOffset: 0.1, openOffset: 1.6, containerBounds: { center: [0, 4.95, 0], size: [3.6, 0.9, 1.6] } },
    ],
    materials: [
      { id: 'cabinet-shell', target: 'shell', color: holo.furnitureFill, opacity: hologramOpacity.furnitureFill },
      { id: 'drawer-1-material', target: 'drawer-1', color: holo.innerFill, opacity: hologramOpacity.innerFill },
      { id: 'drawer-2-material', target: 'drawer-2', color: holo.innerFill, opacity: hologramOpacity.innerFill },
      { id: 'drawer-3-material', target: 'drawer-3', color: holo.innerFill, opacity: hologramOpacity.innerFill },
      { id: 'drawer-4-material', target: 'drawer-4', color: holo.innerFill, opacity: hologramOpacity.innerFill },
    ],
  },
  shelf: {
    id: 'shelf',
    displayName: 'Metal Shelf',
    sourcePath: '/models/shelf.obj',
    supportedFileType: 'obj',
    defaultDimensions: [4, 6, 2],
    footprint: { width: 4, depth: 2, offset: [0, 0] },
    collision: [{ id: 'shelf-body', name: 'Shelf Body', center: [0, 3, 0], size: [4, 6, 2] }],
    snapPoints: [],
    parts: [],
    materials: [{ id: 'shelf-metal', target: 'all', color: holo.furnitureFill, opacity: hologramOpacity.furnitureFill }],
  },
  'wall-single': {
    id: 'wall-single',
    displayName: 'Single Brick Wall',
    supportedFileType: 'generated',
    defaultDimensions: [10, 10, 0.375],
    footprint: { width: 10, depth: 0.375, offset: [0, 0] },
    collision: [{ id: 'wall-body', name: 'Wall Body', center: [0, 5, 0], size: [10, 10, 0.375] }],
    snapPoints: [],
    parts: [],
    materials: [{ id: 'wall-blueprint', target: 'all', color: holo.buildingFill, opacity: hologramOpacity.wallFill }],
  },
  'wall-double': {
    id: 'wall-double',
    displayName: 'Double Brick Wall',
    supportedFileType: 'generated',
    defaultDimensions: [10, 10, 0.75],
    footprint: { width: 10, depth: 0.75, offset: [0, 0] },
    collision: [{ id: 'wall-body', name: 'Wall Body', center: [0, 5, 0], size: [10, 10, 0.75] }],
    snapPoints: [],
    parts: [],
    materials: [{ id: 'wall-blueprint', target: 'all', color: holo.buildingFill, opacity: hologramOpacity.wallFill }],
  },
  'i-beam': {
    id: 'i-beam',
    displayName: 'Iron I-Beam',
    supportedFileType: 'generated',
    defaultDimensions: [10, 0.5, 0.5],
    footprint: { width: 10, depth: 0.5, offset: [0, 0] },
    collision: [{ id: 'beam-body', name: 'Beam Body', center: [0, 0.25, 0], size: [10, 0.5, 0.5] }],
    snapPoints: [],
    parts: [],
    materials: [{ id: 'beam-red', target: 'all', color: holo.furnitureFill, opacity: hologramOpacity.furnitureFill }],
  },
  'low-table': createGeneratedAsset('low-table', 'Low Table', [4, 2.2, 2.5]),
  'low-chair': createGeneratedAsset('low-chair', 'Low Chair', [1.8, 3.2, 1.8]),
  'low-sofa': createGeneratedAsset('low-sofa', 'Low Sofa', [5.2, 2.6, 2.4]),
  'low-bed': createGeneratedAsset('low-bed', 'Low Bed', [4.8, 2.4, 7]),
  'low-wardrobe': createGeneratedAsset('low-wardrobe', 'Low Wardrobe', [3.4, 6.8, 1.8]),
  'low-desk': createGeneratedAsset('low-desk', 'Low Desk', [4.6, 3, 2.2]),
  'low-rack': createGeneratedAsset('low-rack', 'Low Rack', [4, 6.2, 1.8]),
  'low-fridge': createGeneratedAsset('low-fridge', 'Low Fridge', [2.6, 6, 2.2]),
  'low-workbench': createGeneratedAsset('low-workbench', 'Low Workbench', [6, 4.2, 2.4]),
  'low-storage-bin': createGeneratedAsset('low-storage-bin', 'Low Storage Bin', [3, 2, 2]),
};

function createGeneratedAsset(id: string, displayName: string, dimensions: Vector3): AuraAssetDefinition {
  const [width, height, depth] = dimensions;

  return {
    id,
    displayName,
    supportedFileType: 'generated',
    defaultDimensions: dimensions,
    footprint: { width, depth, offset: [0, 0] },
    collision: [{ id: `${id}-bounds`, name: 'Auto Bounds', center: [0, height / 2, 0], size: dimensions }],
    snapPoints: [
      { id: `${id}-left-edge`, name: 'Left Edge', position: [-width / 2, 0, 0] },
      { id: `${id}-right-edge`, name: 'Right Edge', position: [width / 2, 0, 0] },
      { id: `${id}-front-edge`, name: 'Front Edge', position: [0, 0, depth / 2] },
      { id: `${id}-back-edge`, name: 'Back Edge', position: [0, 0, -depth / 2] },
    ],
    parts: [],
    materials: [{ id: `${id}-material`, target: 'all', color: holo.furnitureFill, opacity: hologramOpacity.furnitureFill }],
    meshNodes: [],
  };
}

const mergeWithDefaultAssetDefinitions = (
  existing?: Record<string, AuraAssetDefinition>
): Record<string, AuraAssetDefinition> => ({
  ...defaultAssetDefinitions,
  ...existing,
  parametric: defaultAssetDefinitions.parametric,
  shelf: defaultAssetDefinitions.shelf,
  'wall-single': defaultAssetDefinitions['wall-single'],
  'wall-double': defaultAssetDefinitions['wall-double'],
  'i-beam': defaultAssetDefinitions['i-beam'],
});

export const useSpatialStore = create<SpatialState>()(
  persist(
    (set, get) => ({
      roomDimensions: [40, 12, 40], // Default 40x40 room, 12 high
      furniture: [],
      assetDefinitions: defaultAssetDefinitions,
      searchQuery: '',
      focusedFurnitureId: null,
      cameraTargetId: null,
      cameraSwoopTrigger: 0,
      selectedContainerId: null,
      isDraggingFurniture: false,
      cameraView: 'ISO',
      cameraProjection: 'PERSPECTIVE',
      cameraSnapshot: null,
      gridOpacity: 0.8, // Default opacity
      abyssDarkness: 0.0, // Default to pure white
      doubleClickDelay: 220,
      gizmoMode: 'translate', // Default to moving objects
      isSnappingEnabled: true,
      showSnapFootprints: false,
      activeAlignments: [],
      draggingPosition: null,
      selectedAssetDefinitionId: 'parametric',
      pendingPlacementModelId: null,
      placementPosition: null,

      // --- Core Logic ---
      
      setRoomDimensions: (dimensions) => set({ roomDimensions: dimensions }),

      addFurniture: (modelId, position) => set((state) => {
        let name = 'Cabinet';
        let dimensions: Vector3 = [4, 6, 2];

        // Assuming 1 unit = 1 foot for calculations
        if (modelId === 'shelf') {
          name = 'Metal Shelf';
          dimensions = [4, 6, 2];
        } else if (modelId === 'wall-single') {
          name = 'Single Brick Wall (4.5")';
          dimensions = [10, 10, 0.375]; // 0.375ft = 4.5 inches
        } else if (modelId === 'wall-double') {
          name = 'Double Brick Wall (9")';
          dimensions = [10, 10, 0.75]; // 0.75ft = 9 inches
        } else if (modelId === 'i-beam') {
          name = 'Iron I-Beam';
          dimensions = [10, 0.5, 0.5]; // 10ft long, 6inch high/wide
        } else if (state.assetDefinitions[modelId]) {
          name = state.assetDefinitions[modelId].displayName;
          dimensions = state.assetDefinitions[modelId].defaultDimensions;
        }

        const id = uuidv4();

        return {
          furniture: [
            ...state.furniture,
            {
              id,
              name,
              modelId,
              position,
              rotation: 0,
              dimensions,
              containers: []
            }
          ],
          focusedFurnitureId: id,
        };
      }),

      removeFurniture: (id) => set((state) => ({
        furniture: state.furniture.filter(f => f.id !== id),
        focusedFurnitureId: state.focusedFurnitureId === id ? null : state.focusedFurnitureId,
        cameraTargetId: state.cameraTargetId === id ? null : state.cameraTargetId,
        isDraggingFurniture: state.focusedFurnitureId === id ? false : state.isDraggingFurniture,
        draggingPosition: state.focusedFurnitureId === id ? null : state.draggingPosition,
        activeAlignments: state.focusedFurnitureId === id ? [] : state.activeAlignments,
        selectedContainerId: state.furniture.find(f => f.id === id)?.containers.some(c => c.id === state.selectedContainerId)
          ? null
          : state.selectedContainerId,
      })),

      updateFurnitureName: (id, name) => set((state) => ({
        furniture: state.furniture.map(f =>
          f.id === id ? { ...f, name } : f
        )
      })),

      updateFurniturePosition: (id, newPosition) => set((state) => ({
        furniture: state.furniture.map(f => 
          f.id === id ? { ...f, position: newPosition.map(v => Math.round(v * 100) / 100) as Vector3 } : f
        )
      })),

      updateFurnitureDimensions: (id, newDimensions) => set((state) => ({
        furniture: state.furniture.map(f => 
          f.id === id ? { ...f, dimensions: newDimensions.map(v => Math.max(0.1, Math.round(v * 100) / 100)) as Vector3 } : f
        )
      })),

      updateFurnitureRotation: (id, rotationY) => set((state) => ({
        furniture: state.furniture.map(f => 
          f.id === id ? { ...f, rotation: Math.round(rotationY * 10000) / 10000 } : f
        )
      })),

      upsertAssetDefinition: (asset) => set((state) => ({
        assetDefinitions: {
          ...state.assetDefinitions,
          [asset.id]: asset,
        },
        selectedAssetDefinitionId: asset.id,
      })),

      updateAssetDefinition: (id, patch) => set((state) => {
        const current = state.assetDefinitions[id];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [id]: { ...current, ...patch, id: current.id },
          },
        };
      }),

      updateAssetFootprint: (id, footprint) => set((state) => {
        const current = state.assetDefinitions[id];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [id]: { ...current, footprint },
          },
        };
      }),

      updateAssetCollisionBox: (assetId, boxId, patch) => set((state) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              collision: current.collision.map(box => box.id === boxId ? { ...box, ...patch, id: box.id } : box),
            },
          },
        };
      }),

      updateAssetSnapPoint: (assetId, pointId, patch) => set((state) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              snapPoints: current.snapPoints.map(point => point.id === pointId ? { ...point, ...patch, id: point.id } : point),
            },
          },
        };
      }),

      updateAssetPart: (assetId, partId, patch) => set((state) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              parts: current.parts.map(part => part.id === partId ? { ...part, ...patch, id: part.id } : part),
            },
          },
        };
      }),

      updateAssetMaterial: (assetId, materialId, patch) => set((state) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              materials: current.materials.map(material =>
                material.id === materialId ? { ...material, ...patch, id: material.id } : material
              ),
            },
          },
        };
      }),

      addContainer: (furnitureId, name, type) => set((state) => ({
        furniture: state.furniture.map(f => {
          if (f.id !== furnitureId) return f;
          return {
            ...f,
            containers: [...f.containers, { id: uuidv4(), name, type, items: [] }]
          };
        })
      })),

      addItem: (furnitureId, containerId, name, quantity) => set((state) => ({
        furniture: state.furniture.map(f => {
          if (f.id !== furnitureId) return f;
          return {
            ...f,
            containers: f.containers.map((c: Container) => {
              if (c.id !== containerId) return c;
              return {
                ...c,
                items: [...c.items, { id: uuidv4(), name, quantity, tags: [] }]
              };
            })
          };
        })
      })),

      // --- UI Logic ---

      setSearchQuery: (query) => set({ searchQuery: query }),
      focusFurniture: (id) => set({ focusedFurnitureId: id }),
      setCameraTarget: (id) => set(state => ({ cameraTargetId: id, cameraSwoopTrigger: state.cameraSwoopTrigger + 1 })),
      selectContainer: (id) => set({ selectedContainerId: id }),
      setIsDraggingFurniture: (isDragging) => set({ isDraggingFurniture: isDragging }),
      setCameraView: (view) => set({ cameraView: view }),
      setCameraProjection: (proj) => set({ cameraProjection: proj }),
      setCameraSnapshot: (snapshot) => set({ cameraSnapshot: snapshot }),
      setGridOpacity: (opacity) => set({ gridOpacity: opacity }),
      setBackgroundDarkness: (darkness) => set({ abyssDarkness: darkness }),
      setDoubleClickDelay: (delay) => set({ doubleClickDelay: delay }),
      setGizmoMode: (mode) => set({ gizmoMode: mode }),
      setIsSnappingEnabled: (enabled) => set({ isSnappingEnabled: enabled }),
      setShowSnapFootprints: (enabled) => set({ showSnapFootprints: enabled }),
      setDraggingPosition: (pos) => set({ draggingPosition: pos }),
      setActiveAlignments: (alignments) => set({ activeAlignments: alignments }),
      setSelectedAssetDefinitionId: (id) => set({ selectedAssetDefinitionId: id }),
      setPendingPlacementModelId: (id) => set({
        pendingPlacementModelId: id,
        placementPosition: null,
      }),
      setPlacementPosition: (position) => set({ placementPosition: position }),

      // --- Search Engine ---
      getSearchResults: () => {
        const { furniture, searchQuery } = get();
        if (!searchQuery.trim()) return [];
        
        const results: Array<{ item: Item, containerName: string, containerId: string, furnitureName: string, furnitureId: string }> = [];
        const lowerQuery = searchQuery.toLowerCase();

        furniture.forEach(f => {
          f.containers.forEach((c: Container) => {
            c.items.forEach((i: Item) => {
              if (
                i.name.toLowerCase().includes(lowerQuery) || 
                i.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
              ) {
                results.push({
                  item: i,
                  containerName: c.name,
                  containerId: c.id,
                  furnitureName: f.name,
                  furnitureId: f.id
                });
              }
            });
          });
        });

        return results;
      }
    }),
    {
      name: 'aura-spatial-storage', // The key used in localStorage
      version: 6,
      migrate: (persistedState) => {
        const state = persistedState as Partial<SpatialState>;
        return {
          furniture: state.furniture ?? [],
          assetDefinitions: mergeWithDefaultAssetDefinitions(state.assetDefinitions),
          abyssDarkness: state.abyssDarkness ?? 0,
          gridOpacity: state.gridOpacity ?? 0.8,
          cameraProjection: state.cameraProjection ?? 'PERSPECTIVE',
        };
      },
      partialize: (state) => ({ 
        furniture: state.furniture,
        assetDefinitions: state.assetDefinitions,
        abyssDarkness: state.abyssDarkness,
        gridOpacity: state.gridOpacity,
        cameraProjection: state.cameraProjection
      }), // Only save the physical layout and critical visual preferences
    }
  )
);
