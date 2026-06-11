import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Container, Furniture, Item, Vector3 } from './types';

export type CameraViewType = 'ISO' | 'TOP' | 'FRONT';
export type CameraProjectionType = 'PERSPECTIVE' | 'ORTHOGRAPHIC';

interface SpatialState {
  // --- Data ---
  roomDimensions: Vector3; // [width, height, depth]
  furniture: Furniture[];
  
  // --- UI/Interaction State ---
  searchQuery: string;
  focusedFurnitureId: string | null;
  selectedContainerId: string | null;
  isDraggingFurniture: boolean;
  cameraView: CameraViewType;
  cameraProjection: CameraProjectionType;
  gridOpacity: number;
  
  // --- Actions: State Mutators ---
  setRoomDimensions: (dimensions: Vector3) => void;
  addFurniture: (modelId: string, position: Vector3) => void;
  updateFurnitureName: (id: string, name: string) => void;
  updateFurniturePosition: (id: string, newPosition: Vector3) => void;
  updateFurnitureDimensions: (id: string, newDimensions: Vector3) => void;
  addContainer: (furnitureId: string, name: string, type: Container['type']) => void;
  addItem: (furnitureId: string, containerId: string, name: string, quantity: number) => void;
  
  // --- Actions: UI Mutators ---
  setSearchQuery: (query: string) => void;
  focusFurniture: (id: string | null) => void;
  selectContainer: (id: string | null) => void;
  setIsDraggingFurniture: (isDragging: boolean) => void;
  setCameraView: (view: CameraViewType) => void;
  setCameraProjection: (proj: CameraProjectionType) => void;
  setGridOpacity: (opacity: number) => void;
  
  // --- Selectors (Derived Data) ---
  getSearchResults: () => Array<{ item: Item, containerName: string, containerId: string, furnitureName: string, furnitureId: string }>;
}

export const useSpatialStore = create<SpatialState>((set, get) => ({
  roomDimensions: [40, 12, 40], // Default 40x40 room, 12 high
  furniture: [],
  searchQuery: '',
  focusedFurnitureId: null,
  selectedContainerId: null,
  isDraggingFurniture: false,
  cameraView: 'ISO',
  cameraProjection: 'PERSPECTIVE',
  gridOpacity: 0.8, // Default opacity

  // --- Core Logic ---
  
  setRoomDimensions: (dimensions) => set({ roomDimensions: dimensions }),

  addFurniture: (modelId, position) => set((state) => ({
    furniture: [
      ...state.furniture,
      {
        id: uuidv4(),
        name: modelId === 'shelf' ? 'Metal Shelf' : 'Cabinet',
        modelId,
        position,
        rotation: 0,
        dimensions: [4, 6, 2], // Default realistic size for racks
        containers: []
      }
    ]
  })),

  updateFurnitureName: (id, name) => set((state) => ({
    furniture: state.furniture.map(f =>
      f.id === id ? { ...f, name } : f
    )
  })),

  updateFurniturePosition: (id, newPosition) => set((state) => ({
    furniture: state.furniture.map(f => 
      f.id === id ? { ...f, position: newPosition } : f
    )
  })),

  updateFurnitureDimensions: (id, newDimensions) => set((state) => ({
    furniture: state.furniture.map(f => 
      f.id === id ? { ...f, dimensions: newDimensions } : f
    )
  })),

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
  selectContainer: (id) => set({ selectedContainerId: id }),
  setIsDraggingFurniture: (isDragging) => set({ isDraggingFurniture: isDragging }),
  setCameraView: (view) => set({ cameraView: view }),
  setCameraProjection: (proj) => set({ cameraProjection: proj }),
  setGridOpacity: (opacity) => set({ gridOpacity: opacity }),

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
}));
