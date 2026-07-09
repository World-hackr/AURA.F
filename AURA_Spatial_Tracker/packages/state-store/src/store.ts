import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AuraAssetDefinition, Container, Furniture, Item, Vector3, SketchPoint, SketchLine, SketchCircle, SketchLabel, SketchProject, SketchFeatureMeta, SketchOperation } from './types';
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

export interface SketchAlignmentGuide {
  axis: 'X' | 'Z';
  position: number;
  pointX: number;
  pointZ: number;
}

export function snapPoint(
  x: number,
  z: number,
  points: SketchPoint[],
  startPointId: string | null,
  isSnappingEnabled: boolean
): { point: [number, number]; snappedPointId: string | null; alignmentGuides: SketchAlignmentGuide[] } {
  if (!isSnappingEnabled) {
    return { point: [x, z], snappedPointId: null, alignmentGuides: [] };
  }

  const SNAP_THRESHOLD = 0.4;
  const alignmentGuides: SketchAlignmentGuide[] = [];

  let closestPointId: string | null = null;
  let minPointDist = SNAP_THRESHOLD;

  for (const pt of points) {
    const dist = Math.hypot(x - pt.x, z - pt.z);
    if (dist < minPointDist) {
      minPointDist = dist;
      closestPointId = pt.id;
    }
  }

  if (closestPointId) {
    const matched = points.find(p => p.id === closestPointId)!;
    return {
      point: [matched.x, matched.z],
      snappedPointId: closestPointId,
      alignmentGuides: []
    };
  }

  let finalX = x;
  let finalZ = z;

  const startPt = startPointId ? points.find(p => p.id === startPointId) : null;
  if (startPt) {
    const dx = x - startPt.x;
    const dz = z - startPt.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) {
      const angle = Math.atan2(dz, dx);
      const angleInterval = Math.PI / 4;
      const nearestAngle = Math.round(angle / angleInterval) * angleInterval;
      
      if (Math.abs(angle - nearestAngle) < 0.17) {
        finalX = startPt.x + Math.cos(nearestAngle) * dist;
        finalZ = startPt.z + Math.sin(nearestAngle) * dist;
      }
    }
  }

  let alignedX = false;
  let alignedZ = false;

  for (const pt of points) {
    if (startPt && pt.id === startPt.id) continue;
    
    if (!alignedX && Math.abs(finalX - pt.x) < SNAP_THRESHOLD) {
      finalX = pt.x;
      alignedX = true;
      alignmentGuides.push({
        axis: 'X',
        position: pt.x,
        pointX: pt.x,
        pointZ: pt.z
      });
    }

    if (!alignedZ && Math.abs(finalZ - pt.z) < SNAP_THRESHOLD) {
      finalZ = pt.z;
      alignedZ = true;
      alignmentGuides.push({
        axis: 'Z',
        position: pt.z,
        pointX: pt.x,
        pointZ: pt.z
      });
    }
  }

  if (!alignedX) {
    finalX = Math.round(finalX / 0.25) * 0.25;
  }
  if (!alignedZ) {
    finalZ = Math.round(finalZ / 0.25) * 0.25;
  }

  return {
    point: [finalX, finalZ],
    snappedPointId: null,
    alignmentGuides
  };
}

function simplifySketch(points: SketchPoint[], lines: SketchLine[]): { points: SketchPoint[], lines: SketchLine[] } {
  let mergedAny = true;
  let currentLines = [...lines];
  let currentPoints = [...points];

  while (mergedAny) {
    mergedAny = false;
    
    // Find point connectivity (how many lines touch each point)
    const pointConnectionCount: Record<string, number> = {};
    const pointLines: Record<string, SketchLine[]> = {};
    
    for (const pt of currentPoints) {
      pointConnectionCount[pt.id] = 0;
      pointLines[pt.id] = [];
    }
    
    for (const line of currentLines) {
      if (pointConnectionCount[line.startPointId] !== undefined) {
        pointConnectionCount[line.startPointId]++;
        pointLines[line.startPointId].push(line);
      }
      if (pointConnectionCount[line.endPointId] !== undefined) {
        pointConnectionCount[line.endPointId]++;
        pointLines[line.endPointId].push(line);
      }
    }

    // Find a candidate point to merge
    let candidatePointId: string | null = null;
    let line1: SketchLine | null = null;
    let line2: SketchLine | null = null;

    for (const ptId in pointConnectionCount) {
      if (pointConnectionCount[ptId] === 2) {
        const connectedLines = pointLines[ptId];
        // Ensure same thickness and height
        if (connectedLines[0].thickness === connectedLines[1].thickness &&
            connectedLines[0].height === connectedLines[1].height) {
          
          const pt = currentPoints.find(p => p.id === ptId)!;
          const l1 = connectedLines[0];
          const l2 = connectedLines[1];
          
          const otherPt1Id = l1.startPointId === ptId ? l1.endPointId : l1.startPointId;
          const otherPt2Id = l2.startPointId === ptId ? l2.endPointId : l2.startPointId;
          
          const p1 = currentPoints.find(p => p.id === otherPt1Id)!;
          const p2 = currentPoints.find(p => p.id === otherPt2Id)!;
          
          if (p1 && p2) {
            const dx1 = p1.x - pt.x;
            const dz1 = p1.z - pt.z;
            const len1 = Math.hypot(dx1, dz1);
            
            const dx2 = p2.x - pt.x;
            const dz2 = p2.z - pt.z;
            const len2 = Math.hypot(dx2, dz2);
            
            if (len1 > 0.001 && len2 > 0.001) {
              const dot = (dx1 * dx2 + dz1 * dz2) / (len1 * len2);
              // opposite vectors should have dot close to -1 for collinear lines
              if (dot < -0.998) {
                candidatePointId = ptId;
                line1 = l1;
                line2 = l2;
                break;
              }
            }
          }
        }
      }
    }

    if (candidatePointId && line1 && line2) {
      const ptId = candidatePointId;
      const otherPt1Id = line1.startPointId === ptId ? line1.endPointId : line1.startPointId;
      const otherPt2Id = line2.startPointId === ptId ? line2.endPointId : line2.startPointId;

      const newLine: SketchLine = {
        id: line1.id,
        startPointId: otherPt1Id,
        endPointId: otherPt2Id,
        thickness: line1.thickness,
        height: line1.height,
        elevation: line1.elevation ?? line2.elevation
      };

      currentPoints = currentPoints.filter(p => p.id !== ptId);
      currentLines = currentLines.filter(l => l.id !== line1!.id && l.id !== line2!.id);
      currentLines.push(newLine);
      
      mergedAny = true;
    }
  }

  return { points: currentPoints, lines: currentLines };
}

function buildOperationsFromGeometry(
  points: SketchPoint[],
  lines: SketchLine[],
  circles: SketchCircle[],
  labels: SketchLabel[]
): SketchOperation[] {
  const operations: SketchOperation[] = [];
  
  if (points.length > 0) {
    operations.push({
      id: 'default-points-op',
      toolType: 'POINT',
      name: 'Base Points',
      entityIds: points.map(p => p.id),
      createdAt: 1
    });
  }
  
  if (lines.length > 0) {
    operations.push({
      id: 'default-lines-op',
      toolType: 'LINE',
      name: 'Base Walls',
      entityIds: lines.map(l => l.id),
      createdAt: 2
    });
  }
  
  if (circles.length > 0) {
    operations.push({
      id: 'default-circles-op',
      toolType: 'CIRCLE',
      name: 'Base Curves',
      entityIds: circles.map(c => c.id),
      createdAt: 3
    });
  }
  
  if (labels.length > 0) {
    operations.push({
      id: 'default-labels-op',
      toolType: 'ADD_LABEL',
      name: 'Base Labels',
      entityIds: labels.map(l => l.id),
      createdAt: 4
    });
  }
  
  return operations;
}




export interface SpatialState {
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
  isSketchMode: boolean;
  activeCADEngine: 'jsketcher' | 'chili3d' | 'aura';
  viewCubeStyle: 'chamfered' | 'gimbal';
  isExtrudeDialogOpen: boolean;
  sketchIsolatedMode: boolean;
  cadWorkspaceMode: '2D' | '3D';
  activeDrawMode: 'LINE' | 'MULTI_LINE' | 'RECTANGLE' | 'CIRCLE' | 'ARC' | 'ELLIPSE' | 'ELLIPSE_ARC' | 'SPLINE' | 'POINT' | 'ADD_LABEL' | 'FILLET' | 'CHAMFER' | 'OFFSET' | 'TRIM' | 'EXTEND' | 'MIRROR' | 'DIMENSION' | 'COINCIDENT' | 'CONCENTRIC' | 'LOCK' | 'MIDPOINT' | 'HORIZONTAL' | 'VERTICAL' | 'HORIZONTAL_VERTICAL' | 'COLLINEAR' | 'PARALLEL' | 'PERPENDICULAR' | 'TANGENT' | 'EQUAL' | 'EQUAL_RADIUS' | 'EQUAL_LENGTH' | 'POINT_ON_LINE' | 'POINT_ON_CIRCLE' | 'ANGLE_CONSTRAINT' | 'ANGLE_BETWEEN' | 'DISTANCE_PL' | 'DISTANCE_PP' | 'SYMMETRIC' | 'MEASURE_ANGLE' | 'MEASURE_CIRCLE' | 'FILE_NEW' | 'FILE_CLONE' | 'FILE_SAVE' | 'FILE_EXPORT' | 'VIEW_FIT' | 'SET_SKETCH_PLANE' | null;
  sketchWorkingPlane: { elevation: number; normal: [number, number, number]; faceId?: string };
  sketchPoints: SketchPoint[];
  sketchLines: SketchLine[];
  sketchCircles: SketchCircle[];
  sketchLabels: SketchLabel[];
  sketchStartPointId: string | null;
  sketchCurrentPoint: [number, number] | null;
  sketchThickness: number;
  sketchWallHeight: number;
  selectedPointId: string | null;
  selectedLineId: string | null;
  selectedCircleId: string | null;
  selectedLabelId: string | null;
  selectedBodyId: string | null;
  hoveredSketchItemId: string | null;
  sketchTimelineIndex: number | null;
  sketchFeatureMeta: Record<string, SketchFeatureMeta>;
  sketchOperations: SketchOperation[];
  currentOperationId: string | null;
  hoveredSketchOperationId: string | null;

  // --- Projects/Sketch Canvas State ---
  projects: SketchProject[];
  activeProjectId: string | null;
  sketchReferenceMode: boolean;

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
  setSketchMode: (enabled: boolean) => void;
  setSketchIsolatedMode: (enabled: boolean) => void;
  setCADWorkspaceMode: (mode: '2D' | '3D') => void;
  setSketchDrawMode: (mode: SpatialState['activeDrawMode']) => void;
  addSketchPoint: (x: number, z: number) => string;
  addSketchLine: (startPointId: string, endPointId: string) => string | null;
  addSketchCircle: (centerX: number, centerZ: number, radius: number) => string;
  removeSketchLine: (id: string) => void;
  removeSketchPoint: (id: string) => void;
  removeSketchCircle: (id: string) => void;
  clearSketch: () => void;
  extrudeSketch: (options: number | {
    height: number;
    thickness?: number;
    type: 'solid' | 'thin';
    selectionMode: 'all' | 'selected';
    outputType?: 'component' | 'room';
  }) => void;
  setSketchThickness: (thickness: number) => void;
  setSketchWallHeight: (height: number) => void;
  setIsExtrudeDialogOpen: (open: boolean) => void;
  setSelectedPointId: (id: string | null) => void;
  setSelectedLineId: (id: string | null) => void;
  setSelectedCircleId: (id: string | null) => void;
  setSelectedLabelId: (id: string | null) => void;
  setSelectedBodyId: (id: string | null) => void;
  updateBodyParams: (projectId: string, bodyId: string, patch: Partial<any>) => void;
  setSketchStartPointId: (id: string | null) => void;
  setSketchCurrentPoint: (pt: [number, number] | null) => void;
  setSketchTimelineIndex: (idx: number | null) => void;
  setSketchWorkingPlane: (plane: { elevation: number; normal: [number, number, number]; faceId?: string }) => void;
  updateSketchPointPosition: (id: string, x: number, z: number) => void;
  updateSketchLineProperty: (id: string, patch: Partial<SketchLine>) => void;
  updateSketchCircleProperty: (id: string, patch: Partial<SketchCircle>) => void;
  updateSketchLabelProperty: (id: string, patch: Partial<SketchLabel>) => void;
  setHoveredSketchItemId: (id: string | null) => void;
  addSketchLabel: (x: number, z: number, text: string) => string;
  removeSketchLabel: (id: string) => void;
  suppressSketchFeature: (id: string) => void;
  unsuppressSketchFeature: (id: string) => void;
  renameSketchFeature: (id: string, name: string) => void;
  setHoveredSketchOperationId: (id: string | null) => void;
  removeSketchOperation: (id: string) => void;
  setActiveCADEngine: (engine: 'jsketcher' | 'chili3d' | 'aura') => void;
  setViewCubeStyle: (style: 'chamfered' | 'gimbal') => void;

  // --- Actions: Project Canvas Mutators ---
  addProject: (name: string) => void;
  setActiveProjectId: (id: string | null) => void;
  updateProjectName: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  saveProjectAsComponent: (id: string) => void;
  setSketchReferenceMode: (enabled: boolean) => void;

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
  'wall-curved': {
    id: 'wall-curved',
    displayName: 'Curved Wall',
    supportedFileType: 'generated',
    defaultDimensions: [10, 10, 0.375], // radius, height, thickness (mapped to dimensions)
    footprint: { width: 10, depth: 10, offset: [0, 0] },
    collision: [],
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
  'wall-curved': defaultAssetDefinitions['wall-curved'],
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

      // --- Projects/Sketch Canvas State ---
      projects: [],
      activeProjectId: null,
      sketchReferenceMode: false,

      // --- Sketch Mode State ---
      isSketchMode: false,
      activeCADEngine: 'jsketcher',
      viewCubeStyle: 'chamfered',
      isExtrudeDialogOpen: false,
      sketchIsolatedMode: true,
      cadWorkspaceMode: '2D',
      activeDrawMode: null,
      sketchWorkingPlane: { elevation: 0, normal: [0, 1, 0] },
      sketchPoints: [],
      sketchLines: [],
      sketchCircles: [],
      sketchLabels: [],
      sketchStartPointId: null,
      sketchCurrentPoint: null,
      sketchThickness: 0.375,
      sketchWallHeight: 10,
      selectedPointId: null,
      selectedLineId: null,
      selectedCircleId: null,
      selectedLabelId: null,
      selectedBodyId: null,
      hoveredSketchItemId: null,
      sketchTimelineIndex: null,
      sketchFeatureMeta: {},
      sketchOperations: [],
      currentOperationId: null,
      hoveredSketchOperationId: null,




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

      updateAssetFootprint: (id: string, footprint: AuraAssetDefinition['footprint']) => set((state: SpatialState) => {
        const current = state.assetDefinitions[id];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [id]: { ...current, footprint },
          },
        };
      }),

      updateAssetCollisionBox: (assetId: string, boxId: string, patch: Partial<AuraAssetDefinition['collision'][number]>) => set((state: SpatialState) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              collision: current.collision.map((box: AuraAssetDefinition['collision'][number]) => box.id === boxId ? { ...box, ...patch, id: box.id } : box),
            },
          },
        };
      }),

      updateAssetSnapPoint: (assetId: string, pointId: string, patch: Partial<AuraAssetDefinition['snapPoints'][number]>) => set((state: SpatialState) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              snapPoints: current.snapPoints.map((point: AuraAssetDefinition['snapPoints'][number]) => point.id === pointId ? { ...point, ...patch, id: point.id } : point),
            },
          },
        };
      }),

      updateAssetPart: (assetId: string, partId: string, patch: Partial<AuraAssetDefinition['parts'][number]>) => set((state: SpatialState) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              parts: current.parts.map((part: AuraAssetDefinition['parts'][number]) => part.id === partId ? { ...part, ...patch, id: part.id } : part),
            },
          },
        };
      }),

      updateAssetMaterial: (assetId: string, materialId: string, patch: Partial<AuraAssetDefinition['materials'][number]>) => set((state: SpatialState) => {
        const current = state.assetDefinitions[assetId];
        if (!current) return state;

        return {
          assetDefinitions: {
            ...state.assetDefinitions,
            [assetId]: {
              ...current,
              materials: current.materials.map((material: AuraAssetDefinition['materials'][number]) =>
                material.id === materialId ? { ...material, ...patch, id: material.id } : material
              ),
            },
          },
        };
      }),

      addContainer: (furnitureId: string, name: string, type: Container['type']) => set((state: SpatialState) => ({
        furniture: state.furniture.map((f: Furniture) => {
          if (f.id !== furnitureId) return f;
          return {
            ...f,
            containers: [...f.containers, { id: uuidv4(), name, type, items: [] }]
          };
        })
      })),

      addItem: (furnitureId: string, containerId: string, name: string, quantity: number) => set((state: SpatialState) => ({
        furniture: state.furniture.map((f: Furniture) => {
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

      setSearchQuery: (query: string) => set({ searchQuery: query }),
      focusFurniture: (id: string | null) => set({ focusedFurnitureId: id }),
      setCameraTarget: (id: string | null) => set((state: SpatialState) => ({ cameraTargetId: id, cameraSwoopTrigger: state.cameraSwoopTrigger + 1 })),
      selectContainer: (id: string | null) => set({ selectedContainerId: id }),
      setIsDraggingFurniture: (isDragging: boolean) => set({ isDraggingFurniture: isDragging }),
      setCameraView: (view: CameraViewType) => set({ cameraView: view }),
      setCameraProjection: (proj: CameraProjectionType) => set({ cameraProjection: proj }),
      setCameraSnapshot: (snapshot: CameraSnapshot | null) => set({ cameraSnapshot: snapshot }),
      setGridOpacity: (opacity: number) => set({ gridOpacity: opacity }),
      setBackgroundDarkness: (darkness: number) => set({ abyssDarkness: darkness }),
      setDoubleClickDelay: (delay: number) => set({ doubleClickDelay: delay }),
      setGizmoMode: (mode: 'translate' | 'scale' | 'rotate') => set({ gizmoMode: mode }),
      setIsSnappingEnabled: (enabled: boolean) => set({ isSnappingEnabled: enabled }),
      setShowSnapFootprints: (enabled: boolean) => set({ showSnapFootprints: enabled }),
      setDraggingPosition: (pos: Vector3 | null) => set({ draggingPosition: pos }),
      setActiveAlignments: (alignments: AlignmentGuideData[]) => set({ activeAlignments: alignments }),
      setSelectedAssetDefinitionId: (id: string) => set({ selectedAssetDefinitionId: id }),
      setPendingPlacementModelId: (id: string | null) => set({
        pendingPlacementModelId: id,
        placementPosition: null,
      }),
      setPlacementPosition: (position: Vector3 | null) => set({ placementPosition: position }),

      // --- Sketch Mode Actions ---
      setActiveCADEngine: (engine: 'jsketcher' | 'chili3d' | 'aura') => set({ activeCADEngine: engine }),
      setViewCubeStyle: (style: 'chamfered' | 'gimbal') => set({ viewCubeStyle: style }),
      setSketchMode: (enabled: boolean) => set((state: SpatialState) => {
        if (enabled) {
          return {
            isSketchMode: true,
            cadWorkspaceMode: '2D',
            cameraView: 'TOP',
            cameraProjection: 'ORTHOGRAPHIC'
          };
        } else {
          // AUTO-SAVE current active sketch into projects array before exiting
          let updatedProjects = [...state.projects];
          if (state.activeProjectId) {
            updatedProjects = updatedProjects.map(p => 
              p.id === state.activeProjectId 
                ? {
                    ...p,
                    points: state.sketchPoints,
                    lines: state.sketchLines,
                    circles: state.sketchCircles,
                    labels: state.sketchLabels,
                    thickness: state.sketchThickness,
                    wallHeight: state.sketchWallHeight,
                  }
                : p
            );
          }
          return {
            projects: updatedProjects,
            isSketchMode: false
          };
        }
      }),
      setSketchIsolatedMode: (enabled: boolean) => set({ sketchIsolatedMode: enabled }),
      setCADWorkspaceMode: (mode: '2D' | '3D') => set(() => {
        if (mode === '2D') {
          return {
            cadWorkspaceMode: '2D',
            cameraView: 'TOP',
            cameraProjection: 'ORTHOGRAPHIC',
            activeDrawMode: null,
            sketchStartPointId: null,
            sketchCurrentPoint: null
          };
        } else {
          return {
            cadWorkspaceMode: '3D',
            cameraView: 'ISO',
            cameraProjection: 'PERSPECTIVE'
          };
        }
      }),
      setSketchDrawMode: (mode: SpatialState['activeDrawMode']) => set((state: SpatialState) => {
        let updatedOperations = [...state.sketchOperations];
        let newOpId = state.currentOperationId;

        // If switching from drawing to selection/null
        if (mode === null) {
          if (newOpId) {
            const op = updatedOperations.find(o => o.id === newOpId);
            if (op && op.entityIds.length === 0) {
              updatedOperations = updatedOperations.filter(o => o.id !== newOpId);
            }
            newOpId = null;
          }
        } else {
          // If starting a new draw mode
          if (newOpId) {
            const op = updatedOperations.find(o => o.id === newOpId);
            if (op && op.entityIds.length === 0) {
              updatedOperations = updatedOperations.filter(o => o.id !== newOpId);
            }
          }
          
          newOpId = uuidv4();
          const toolType = mode as any;
          const modeCount = updatedOperations.filter(o => o.toolType === toolType).length + 1;
          const niceName = `${toolType.charAt(0) + toolType.toLowerCase().slice(1)} Sketch ${modeCount}`;
          
          updatedOperations.push({
            id: newOpId,
            toolType: toolType,
            name: niceName,
            entityIds: [],
            createdAt: Date.now()
          });
        }

        return {
          activeDrawMode: mode,
          sketchStartPointId: null,
          sketchCurrentPoint: null,
          sketchOperations: updatedOperations,
          currentOperationId: newOpId
        };
      }),
      addSketchPoint: (x: number, z: number) => {
        const id = uuidv4();
        set((state: SpatialState) => {
          const currentOp = state.currentOperationId;
          let updatedOperations = [...state.sketchOperations];
          if (currentOp) {
            updatedOperations = updatedOperations.map(o => o.id === currentOp ? { ...o, entityIds: [...o.entityIds, id] } : o);
          } else {
            const fallbackId = uuidv4();
            updatedOperations.push({
              id: fallbackId,
              toolType: 'POINT',
              name: 'Point Sketch',
              entityIds: [id],
              createdAt: Date.now()
            });
          }
          return {
            sketchPoints: [...state.sketchPoints, { id, x, z, elevation: state.sketchWorkingPlane?.elevation ?? 0, createdAt: Date.now() }],
            sketchOperations: updatedOperations,
            sketchTimelineIndex: null
          };
        });
        return id;
      },
      addSketchLine: (startPointId: string, endPointId: string) => {
        if (startPointId === endPointId) return null;
        const id = uuidv4();
        let createdId: string | null = null;
        set((state: SpatialState) => {
          const exists = state.sketchLines.some((l: SketchLine) => 
            (l.startPointId === startPointId && l.endPointId === endPointId) ||
            (l.startPointId === endPointId && l.endPointId === startPointId)
          );
          if (exists) return state;
          createdId = id;

          const currentOp = state.currentOperationId;
          let updatedOperations = [...state.sketchOperations];
          if (currentOp) {
            updatedOperations = updatedOperations.map(o => o.id === currentOp ? { ...o, entityIds: [...o.entityIds, id] } : o);
          } else {
            const fallbackId = uuidv4();
            updatedOperations.push({
              id: fallbackId,
              toolType: 'LINE',
              name: 'Line Sketch',
              entityIds: [id],
              createdAt: Date.now()
            });
          }

          return {
            sketchLines: [
              ...state.sketchLines,
              {
                id,
                startPointId,
                endPointId,
                thickness: state.sketchThickness,
                height: state.sketchWallHeight,
                elevation: state.sketchWorkingPlane?.elevation ?? 0,
                createdAt: Date.now()
              }
            ],
            sketchOperations: updatedOperations,
            sketchTimelineIndex: null
          };
        });
        return createdId;
      },
      removeSketchLine: (id: string) => set((state: SpatialState) => ({
        sketchLines: state.sketchLines.filter((l: SketchLine) => l.id !== id),
        selectedLineId: state.selectedLineId === id ? null : state.selectedLineId,
        sketchOperations: state.sketchOperations.map((o: SketchOperation) => ({ ...o, entityIds: o.entityIds.filter((eId: string) => eId !== id) }))
      })),
      removeSketchPoint: (id: string) => set((state: SpatialState) => {
        const linesToRemove = new Set(state.sketchLines.filter((l: SketchLine) => l.startPointId === id || l.endPointId === id).map((l: SketchLine) => l.id));
        const entitiesToRemove = new Set([id, ...linesToRemove]);
        return {
          sketchPoints: state.sketchPoints.filter((p: SketchPoint) => p.id !== id),
          sketchLines: state.sketchLines.filter((l: SketchLine) => l.startPointId !== id && l.endPointId !== id),
          sketchStartPointId: state.sketchStartPointId === id ? null : state.sketchStartPointId,
          selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
          sketchOperations: state.sketchOperations.map((o: SketchOperation) => ({ ...o, entityIds: o.entityIds.filter((eId: string) => !entitiesToRemove.has(eId)) }))
        };
      }),
      removeSketchCircle: (id: string) => set((state: SpatialState) => ({
        sketchCircles: state.sketchCircles.filter((c: SketchCircle) => c.id !== id),
        selectedCircleId: state.selectedCircleId === id ? null : state.selectedCircleId,
        sketchOperations: state.sketchOperations.map((o: SketchOperation) => ({ ...o, entityIds: o.entityIds.filter((eId: string) => eId !== id) }))
      })),
      addSketchCircle: (centerX: number, centerZ: number, radius: number) => {
        const id = uuidv4();
        set((state: SpatialState) => {
          const currentOp = state.currentOperationId;
          let updatedOperations = [...state.sketchOperations];
          if (currentOp) {
            updatedOperations = updatedOperations.map(o => o.id === currentOp ? { ...o, entityIds: [...o.entityIds, id] } : o);
          } else {
            const fallbackId = uuidv4();
            updatedOperations.push({
              id: fallbackId,
              toolType: 'CIRCLE',
              name: 'Circle Sketch',
              entityIds: [id],
              createdAt: Date.now()
            });
          }
          return {
            sketchCircles: [
              ...state.sketchCircles,
              {
                id,
                centerX,
                centerZ,
                radius,
                thickness: state.sketchThickness,
                height: state.sketchWallHeight,
                elevation: state.sketchWorkingPlane?.elevation ?? 0,
                createdAt: Date.now()
              }
            ],
            sketchOperations: updatedOperations,
            sketchTimelineIndex: null
          };
        });
        return id;
      },
      clearSketch: () => set((state: SpatialState) => {
        const updatedProjects = state.activeProjectId 
          ? state.projects.map((p: SketchProject) => p.id === state.activeProjectId ? { ...p, points: [], lines: [], circles: [], labels: [], featureMeta: {}, operations: [] } : p)
          : state.projects;
        return {
          projects: updatedProjects,
          sketchPoints: [],
          sketchLines: [],
          sketchCircles: [],
          sketchLabels: [],
          sketchFeatureMeta: {},
          sketchOperations: [],
          currentOperationId: null,
          hoveredSketchOperationId: null,
          sketchStartPointId: null,
          sketchCurrentPoint: null,
          selectedPointId: null,
          selectedLineId: null,
          selectedCircleId: null,
          selectedLabelId: null
        };
      }),
      extrudeSketch: (options: number | {
        height: number;
        thickness?: number;
        type: 'solid' | 'thin';
        selectionMode: 'all' | 'selected';
        outputType?: 'component' | 'room';
        operation?: 'add' | 'cut';
      }) => set((state: SpatialState) => {
        let wallHeight = 10;
        let extThickness = state.sketchThickness;
        let extType: 'solid' | 'thin' = 'thin';
        let selMode: 'all' | 'selected' = 'all';
        let outputType: 'component' | 'room' = 'room';
        let operation: 'add' | 'cut' = 'add';

        if (typeof options === 'number') {
          wallHeight = options;
        } else if (options && typeof options === 'object') {
          wallHeight = options.height;
          if (options.thickness !== undefined) extThickness = options.thickness;
          if (options.type !== undefined) extType = options.type;
          if (options.selectionMode !== undefined) selMode = options.selectionMode;
          if (options.outputType !== undefined) outputType = options.outputType;
          if (options.operation !== undefined) operation = options.operation;
        }

        const { points: simplifiedPoints, lines: simplifiedLines } = simplifySketch(
          state.sketchPoints,
          state.sketchLines
        );

        let linesToProcess = [...simplifiedLines];
        let circlesToProcess = [...(state.sketchCircles || [])];

        if (selMode === 'selected') {
          if (state.selectedLineId) {
            linesToProcess = linesToProcess.filter(l => l.id === state.selectedLineId);
            circlesToProcess = [];
          } else if (state.selectedCircleId) {
            circlesToProcess = circlesToProcess.filter(c => c.id === state.selectedCircleId);
            linesToProcess = [];
          } else {
            linesToProcess = [];
            circlesToProcess = [];
          }
        }

        const newFurniture: Furniture[] = [...state.furniture];
        const extrudedIds: string[] = [];
        const bodies: Array<{
          id: string;
          name: string;
          type: 'solid-box' | 'solid-cylinder';
          position: Vector3;
          rotation: number;
          dimensions: Vector3;
          operation: 'add' | 'cut';
          filletRadius?: number;
          chamferDist?: number;
        }> = [];

        if (extType === 'solid') {
          // Process circles as solid cylinders
          for (const circle of circlesToProcess) {
            const id = uuidv4();
            extrudedIds.push(id);

            const circleRadius = typeof circle.radius === 'number' && !isNaN(circle.radius) ? Math.max(0.01, circle.radius) : 1;
            const circleElevation = typeof circle.elevation === 'number' && !isNaN(circle.elevation) ? circle.elevation : 0;
            const height = typeof wallHeight === 'number' && !isNaN(wallHeight) ? Math.max(0.1, wallHeight) : 10;
            const cx = typeof circle.centerX === 'number' && !isNaN(circle.centerX) ? circle.centerX : 0;
            const cz = typeof circle.centerZ === 'number' && !isNaN(circle.centerZ) ? circle.centerZ : 0;

            const bodyDef = {
              id,
              name: operation === 'cut' ? `Subtractive Cylinder (R=${circleRadius.toFixed(1)}ft)` : `Solid Cylinder (R=${circleRadius.toFixed(1)}ft)`,
              type: 'solid-cylinder' as const,
              position: [cx, circleElevation, cz] as Vector3,
              rotation: 0,
              dimensions: [circleRadius, height, 0] as Vector3,
              operation: operation,
              filletRadius: 0,
              chamferDist: 0
            };

            if (outputType === 'component') {
              bodies.push(bodyDef);
            } else {
              newFurniture.push({
                ...bodyDef,
                modelId: 'solid-cylinder',
                containers: []
              });
            }
          }

          if (selMode === 'selected') {
            // Extrude single selected line as a box solid
            for (const line of linesToProcess) {
              const startPt = simplifiedPoints.find(p => p.id === line.startPointId);
              const endPt = simplifiedPoints.find(p => p.id === line.endPointId);
              if (!startPt || !endPt) continue;

              const dx = endPt.x - startPt.x;
              const dz = endPt.z - startPt.z;
              const length = Math.hypot(dx, dz);
              if (isNaN(length) || length < 0.01) continue;

              const mx = (startPt.x + endPt.x) / 2;
              const mz = (startPt.z + endPt.z) / 2;
              const rotation = Math.atan2(-dz, dx);

              const id = uuidv4();
              extrudedIds.push(id);

              const elevation = typeof line.elevation === 'number' && !isNaN(line.elevation) ? line.elevation : 0;
              const thickness = typeof line.thickness === 'number' && !isNaN(line.thickness) ? Math.max(0.01, line.thickness) : extThickness;
              const height = typeof wallHeight === 'number' && !isNaN(wallHeight) ? Math.max(0.1, wallHeight) : 10;
              const len = typeof length === 'number' && !isNaN(length) ? Math.max(0.01, length) : 1;
              const xPos = typeof mx === 'number' && !isNaN(mx) ? mx : 0;
              const zPos = typeof mz === 'number' && !isNaN(mz) ? mz : 0;
              const rot = typeof rotation === 'number' && !isNaN(rotation) ? rotation : 0;

              const bodyDef = {
                id,
                name: operation === 'cut' ? `Subtractive Box` : `Solid Box`,
                type: 'solid-box' as const,
                position: [xPos, elevation, zPos] as Vector3,
                rotation: rot,
                dimensions: [len, height, thickness] as Vector3,
                operation: operation,
                filletRadius: 0,
                chamferDist: 0
              };

              if (outputType === 'component') {
                bodies.push(bodyDef);
              } else {
                newFurniture.push({
                  ...bodyDef,
                  modelId: 'solid-box',
                  containers: []
                });
              }
            }
          } else {
            // Group all lines by connected components to detect closed loops
            const lineVisited = new Set<string>();
            const components: SketchLine[][] = [];

            for (const line of linesToProcess) {
              if (lineVisited.has(line.id)) continue;

              const comp: SketchLine[] = [];
              const queue: SketchLine[] = [line];
              lineVisited.add(line.id);

              while (queue.length > 0) {
                const curr = queue.shift()!;
                comp.push(curr);

                for (const other of linesToProcess) {
                  if (lineVisited.has(other.id)) continue;
                  const sharesPoint = 
                    other.startPointId === curr.startPointId || 
                    other.startPointId === curr.endPointId || 
                    other.endPointId === curr.startPointId || 
                    other.endPointId === curr.endPointId;
                  if (sharesPoint) {
                    lineVisited.add(other.id);
                    queue.push(other);
                  }
                }
              }
              components.push(comp);
            }

            for (const comp of components) {
              const degrees: Record<string, number> = {};
              const vertexIds = new Set<string>();
              for (const l of comp) {
                degrees[l.startPointId] = (degrees[l.startPointId] || 0) + 1;
                degrees[l.endPointId] = (degrees[l.endPointId] || 0) + 1;
                vertexIds.add(l.startPointId);
                vertexIds.add(l.endPointId);
              }

              let isClosed = comp.length >= 3;
              if (isClosed) {
                for (const vId of vertexIds) {
                  if ((degrees[vId] || 0) < 2) {
                    isClosed = false;
                    break;
                  }
                }
              }

              if (isClosed) {
                const pts = simplifiedPoints.filter(p => vertexIds.has(p.id));
                if (pts.length > 0) {
                  const xs = pts.map(p => p.x);
                  const zs = pts.map(p => p.z);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minZ = Math.min(...zs);
                  const maxZ = Math.max(...zs);

                  const width = Math.max(0.01, maxX - minX);
                  const depth = Math.max(0.01, maxZ - minZ);
                  const cx = (minX + maxX) / 2;
                  const cz = (minZ + maxZ) / 2;
                  const elevation = pts[0].elevation || 0;

                  const id = uuidv4();
                  extrudedIds.push(id);

                  const bodyDef = {
                    id,
                    name: operation === 'cut' ? `Subtractive Box (W=${width.toFixed(1)}ft, D=${depth.toFixed(1)}ft)` : `Solid Box (W=${width.toFixed(1)}ft, D=${depth.toFixed(1)}ft)`,
                    type: 'solid-box' as const,
                    position: [cx, elevation, cz] as Vector3,
                    rotation: 0,
                    dimensions: [width, wallHeight, depth] as Vector3,
                    operation: operation,
                    filletRadius: 0,
                    chamferDist: 0
                  };

                  if (outputType === 'component') {
                    bodies.push(bodyDef);
                  } else {
                    newFurniture.push({
                      ...bodyDef,
                      modelId: 'solid-box',
                      containers: []
                    });
                  }
                }
              } else {
                // Fallback to thin wall extrusions for open lines
                for (const line of comp) {
                  const startPt = simplifiedPoints.find(p => p.id === line.startPointId);
                  const endPt = simplifiedPoints.find(p => p.id === line.endPointId);
                  if (!startPt || !endPt) continue;

                  const dx = endPt.x - startPt.x;
                  const dz = endPt.z - startPt.z;
                  const length = Math.hypot(dx, dz);
                  if (isNaN(length) || length < 0.01) continue;

                  const mx = (startPt.x + endPt.x) / 2;
                  const mz = (startPt.z + endPt.z) / 2;
                  const rotation = Math.atan2(-dz, dx);
                  
                  const modelId = line.thickness > 0.5 ? 'wall-double' : 'wall-single';
                  const name = line.thickness > 0.5 ? 'Double Brick Wall (9")' : 'Single Brick Wall (4.5")';

                  const id = uuidv4();
                  extrudedIds.push(id);

                  const elevation = typeof line.elevation === 'number' && !isNaN(line.elevation) ? line.elevation : 0;
                  const thickness = typeof line.thickness === 'number' && !isNaN(line.thickness) ? Math.max(0.01, line.thickness) : extThickness;
                  const height = typeof wallHeight === 'number' && !isNaN(wallHeight) ? Math.max(0.1, wallHeight) : 10;
                  const len = typeof length === 'number' && !isNaN(length) ? Math.max(0.01, length) : 1;
                  const xPos = typeof mx === 'number' && !isNaN(mx) ? mx : 0;
                  const zPos = typeof mz === 'number' && !isNaN(mz) ? mz : 0;
                  const rot = typeof rotation === 'number' && !isNaN(rotation) ? rotation : 0;

                  if (outputType === 'component') {
                    bodies.push({
                      id,
                      name: operation === 'cut' ? `Subtractive Wall` : `Extruded Wall (${(thickness * 12).toFixed(1)}")`,
                      type: 'solid-box' as const,
                      position: [xPos, elevation, zPos] as Vector3,
                      rotation: rot,
                      dimensions: [len, height, thickness] as Vector3,
                      operation: operation,
                      filletRadius: 0,
                      chamferDist: 0
                    });
                  } else {
                    newFurniture.push({
                      id,
                      name,
                      modelId,
                      position: [xPos, elevation, zPos],
                      rotation: rot,
                      dimensions: [len, height, thickness],
                      containers: []
                    });
                  }
                }
              }
            }
          }
        } else {
          // Thin extrusion (Walls/Profiles)
          // Extrude straight lines
          for (const line of linesToProcess) {
            const startPt = simplifiedPoints.find(p => p.id === line.startPointId);
            const endPt = simplifiedPoints.find(p => p.id === line.endPointId);
            if (!startPt || !endPt) continue;

            const dx = endPt.x - startPt.x;
            const dz = endPt.z - startPt.z;
            const length = Math.hypot(dx, dz);
            if (isNaN(length) || length < 0.01) continue;

            const mx = (startPt.x + endPt.x) / 2;
            const mz = (startPt.z + endPt.z) / 2;
            const rotation = Math.atan2(-dz, dx);
            
            const modelId = line.thickness > 0.5 ? 'wall-double' : 'wall-single';
            const name = line.thickness > 0.5 ? 'Double Brick Wall (9")' : 'Single Brick Wall (4.5")';

            const id = uuidv4();
            extrudedIds.push(id);

            const elevation = typeof line.elevation === 'number' && !isNaN(line.elevation) ? line.elevation : 0;
            const thickness = typeof line.thickness === 'number' && !isNaN(line.thickness) ? Math.max(0.01, line.thickness) : extThickness;
            const height = typeof wallHeight === 'number' && !isNaN(wallHeight) ? Math.max(0.1, wallHeight) : 10;
            const len = typeof length === 'number' && !isNaN(length) ? Math.max(0.01, length) : 1;
            const xPos = typeof mx === 'number' && !isNaN(mx) ? mx : 0;
            const zPos = typeof mz === 'number' && !isNaN(mz) ? mz : 0;
            const rot = typeof rotation === 'number' && !isNaN(rotation) ? rotation : 0;

            if (outputType === 'component') {
              bodies.push({
                id,
                name: operation === 'cut' ? `Subtractive Wall` : `Extruded Wall (${(thickness * 12).toFixed(1)}")`,
                type: 'solid-box' as const,
                position: [xPos, elevation, zPos] as Vector3,
                rotation: rot,
                dimensions: [len, height, thickness] as Vector3,
                operation: operation,
                filletRadius: 0,
                chamferDist: 0
              });
            } else {
              newFurniture.push({
                id,
                name,
                modelId,
                position: [xPos, elevation, zPos],
                rotation: rot,
                dimensions: [len, height, thickness],
                containers: []
              });
            }
          }

          // Extrude curved circles
          for (const circle of circlesToProcess) {
            const id = uuidv4();
            extrudedIds.push(id);

            const circleRadius = typeof circle.radius === 'number' && !isNaN(circle.radius) ? Math.max(0.01, circle.radius) : 1;
            const circleElevation = typeof circle.elevation === 'number' && !isNaN(circle.elevation) ? circle.elevation : 0;
            const circleThickness = typeof circle.thickness === 'number' && !isNaN(circle.thickness) ? Math.max(0.01, circle.thickness) : extThickness;
            const height = typeof wallHeight === 'number' && !isNaN(wallHeight) ? Math.max(0.1, wallHeight) : 10;
            const cx = typeof circle.centerX === 'number' && !isNaN(circle.centerX) ? circle.centerX : 0;
            const cz = typeof circle.centerZ === 'number' && !isNaN(circle.centerZ) ? circle.centerZ : 0;

            if (outputType === 'component') {
              bodies.push({
                id,
                name: operation === 'cut' ? `Subtractive Curve` : `Extruded Curve (R=${circleRadius.toFixed(1)}ft)`,
                type: 'solid-cylinder' as const,
                position: [cx, circleElevation, cz] as Vector3,
                rotation: 0,
                dimensions: [circleRadius, height, circleThickness] as Vector3,
                operation: operation,
                filletRadius: 0,
                chamferDist: 0
              });
            } else {
              newFurniture.push({
                id,
                name: `Curved Wall (R=${circleRadius.toFixed(1)}ft)`,
                modelId: 'wall-curved',
                position: [cx, circleElevation, cz],
                rotation: 0,
                dimensions: [circleRadius, height, circleThickness],
                containers: []
              });
            }
          }
        }

        // Save current sketch to active project before completing extrusion
        let updatedProjects = [...state.projects];
        const extrudeOp: SketchOperation = {
          id: uuidv4(),
          toolType: 'EXTRUDE',
          name: outputType === 'component' 
            ? `${operation === 'cut' ? 'Cut' : 'Extrude'} Solid ${state.sketchOperations.filter((o: SketchOperation) => o.toolType === 'EXTRUDE').length + 1}` 
            : `Extrude Walls ${state.sketchOperations.filter((o: SketchOperation) => o.toolType === 'EXTRUDE').length + 1}`,
          entityIds: outputType === 'component' ? bodies.map(b => b.id) : extrudedIds,
          createdAt: Date.now(),
          params: {
            height: wallHeight,
            thickness: extThickness,
            type: extType,
            outputType: outputType,
            bodies: bodies
          }
        };
        const updatedOperations = [...state.sketchOperations, extrudeOp];

        if (state.activeProjectId) {
          updatedProjects = updatedProjects.map(p => 
            p.id === state.activeProjectId 
              ? {
                  ...p,
                  points: state.sketchPoints,
                  lines: state.sketchLines,
                  circles: state.sketchCircles,
                  labels: state.sketchLabels,
                  thickness: state.sketchThickness,
                  wallHeight: state.sketchWallHeight,
                  featureMeta: state.sketchFeatureMeta,
                  operations: updatedOperations,
                }
              : p
          );
        }

        return {
          projects: updatedProjects,
          furniture: newFurniture,
          sketchOperations: updatedOperations,
          // Keep all sketch points, lines, circles, and labels so that the canvas is NOT wiped out!
          sketchStartPointId: null,
          sketchCurrentPoint: null,
          selectedPointId: null,
          selectedLineId: null,
          selectedCircleId: null,
          selectedLabelId: null,
          selectedBodyId: null,
          isSketchMode: true,
          cadWorkspaceMode: '3D',
          cameraView: 'ISO',
          cameraProjection: 'PERSPECTIVE'
        };
      }),
      setSketchThickness: (thickness: number) => set({ sketchThickness: thickness }),
      setSketchWallHeight: (height: number) => set({ sketchWallHeight: height }),
      setIsExtrudeDialogOpen: (open: boolean) => set({ isExtrudeDialogOpen: open }),
      setSelectedPointId: (id: string | null) => set({ selectedPointId: id }),
      setSelectedLineId: (id: string | null) => set({ selectedLineId: id }),
      setSelectedCircleId: (id: string | null) => set({ selectedCircleId: id }),
      setSelectedLabelId: (id: string | null) => set({ selectedLabelId: id }),
      setSelectedBodyId: (id: string | null) => set({ selectedBodyId: id }),
      updateBodyParams: (projectId: string, bodyId: string, patch: Partial<any>) => set((state: SpatialState) => {
        const updatedProjects = state.projects.map(p => {
          if (p.id !== projectId) return p;

          const updatedOps = (p.operations || []).map(op => {
            if (op.toolType === 'EXTRUDE' && op.params?.bodies) {
              const updatedBodies = op.params.bodies.map((body: any) => {
                if (body.id === bodyId) {
                  return { ...body, ...patch };
                }
                return body;
              });
              return {
                ...op,
                params: {
                  ...op.params,
                  bodies: updatedBodies
                }
              };
            }
            return op;
          });

          return {
            ...p,
            operations: updatedOps
          };
        });

        return {
          projects: updatedProjects
        };
      }),
      setSketchStartPointId: (id: string | null) => set({ sketchStartPointId: id }),
      setSketchCurrentPoint: (pt: [number, number] | null) => set({ sketchCurrentPoint: pt }),
      setSketchTimelineIndex: (idx: number | null) => set({ sketchTimelineIndex: idx }),
      setSketchWorkingPlane: (plane) => set({ sketchWorkingPlane: plane }),
      setHoveredSketchItemId: (id: string | null) => set({ hoveredSketchItemId: id }),
      suppressSketchFeature: (id: string) => set((state: SpatialState) => {
        const meta = state.sketchFeatureMeta[id] || { id, customName: null, suppressed: false };
        return {
          sketchFeatureMeta: {
            ...state.sketchFeatureMeta,
            [id]: { ...meta, suppressed: true }
          }
        };
      }),
      unsuppressSketchFeature: (id: string) => set((state: SpatialState) => {
        const meta = state.sketchFeatureMeta[id] || { id, customName: null, suppressed: false };
        return {
          sketchFeatureMeta: {
            ...state.sketchFeatureMeta,
            [id]: { ...meta, suppressed: false }
          }
        };
      }),
      renameSketchFeature: (id: string, name: string) => set((state: SpatialState) => {
        const meta = state.sketchFeatureMeta[id] || { id, customName: null, suppressed: false };
        return {
          sketchFeatureMeta: {
            ...state.sketchFeatureMeta,
            [id]: { ...meta, customName: name }
          }
        };
      }),
      addSketchLabel: (x: number, z: number, text: string) => {
        const id = uuidv4();
        set((state: SpatialState) => {
          const currentOp = state.currentOperationId;
          let updatedOperations = [...state.sketchOperations];
          if (currentOp) {
            updatedOperations = updatedOperations.map(o => o.id === currentOp ? { ...o, entityIds: [...o.entityIds, id] } : o);
          } else {
            const fallbackId = uuidv4();
            updatedOperations.push({
              id: fallbackId,
              toolType: 'ADD_LABEL',
              name: 'Label Sketch',
              entityIds: [id],
              createdAt: Date.now()
            });
          }
          return {
            sketchLabels: [...state.sketchLabels, { id, x, z, text, elevation: state.sketchWorkingPlane?.elevation ?? 0, createdAt: Date.now() }],
            sketchOperations: updatedOperations
          };
        });
        return id;
      },
      removeSketchLabel: (id: string) => set((state: SpatialState) => ({
        sketchLabels: state.sketchLabels.filter(l => l.id !== id),
        selectedLabelId: state.selectedLabelId === id ? null : state.selectedLabelId,
        sketchOperations: state.sketchOperations.map(o => ({ ...o, entityIds: o.entityIds.filter(eId => eId !== id) }))
      })),
      setHoveredSketchOperationId: (id: string | null) => set({ hoveredSketchOperationId: id }),
      removeSketchOperation: (id: string) => set((state: SpatialState) => {
        const op = state.sketchOperations.find(o => o.id === id);
        if (!op) return state;
        
        const idsToRemove = new Set(op.entityIds);
        
        return {
          sketchOperations: state.sketchOperations.filter(o => o.id !== id),
          sketchPoints: state.sketchPoints.filter(p => !idsToRemove.has(p.id)),
          sketchLines: state.sketchLines.filter(l => !idsToRemove.has(l.id)),
          sketchCircles: state.sketchCircles.filter(c => !idsToRemove.has(c.id)),
          sketchLabels: state.sketchLabels.filter(lbl => !idsToRemove.has(lbl.id))
        };
      }),
      updateSketchPointPosition: (id: string, x: number, z: number) => set((state: SpatialState) => ({
        sketchPoints: state.sketchPoints.map(p => p.id === id ? { ...p, x, z } : p)
      })),
      updateSketchLineProperty: (id: string, patch: Partial<SketchLine>) => set((state: SpatialState) => ({
        sketchLines: state.sketchLines.map(l => l.id === id ? { ...l, ...patch } : l)
      })),
      updateSketchCircleProperty: (id: string, patch: Partial<SketchCircle>) => set((state: SpatialState) => ({
        sketchCircles: state.sketchCircles.map(c => c.id === id ? { ...c, ...patch } : c)
      })),
      updateSketchLabelProperty: (id: string, patch: Partial<SketchLabel>) => set((state: SpatialState) => ({
        sketchLabels: state.sketchLabels.map(l => l.id === id ? { ...l, ...patch } : l)
      })),




      setSketchReferenceMode: (enabled: boolean) => set({ sketchReferenceMode: enabled }),
      addProject: (name: string) => set((state: SpatialState) => {
        let updatedProjects = [...state.projects];
        if (state.activeProjectId) {
          updatedProjects = updatedProjects.map(p => 
            p.id === state.activeProjectId 
              ? {
                  ...p,
                  points: state.sketchPoints,
                  lines: state.sketchLines,
                  circles: state.sketchCircles,
                  labels: state.sketchLabels,
                  thickness: state.sketchThickness,
                  wallHeight: state.sketchWallHeight,
                  featureMeta: state.sketchFeatureMeta,
                  operations: state.sketchOperations,
                }
              : p
          );
        }

        const newId = uuidv4();
        const newProj: SketchProject = {
          id: newId,
          name,
          points: [],
          lines: [],
          circles: [],
          labels: [],
          thickness: 0.375,
          wallHeight: 10,
          width: 0,
          depth: 0,
          centerX: 0,
          centerZ: 0,
          featureMeta: {},
          operations: []
        };

        return {
          projects: [...updatedProjects, newProj],
          activeProjectId: newId,
          sketchPoints: [],
          sketchLines: [],
          sketchCircles: [],
          sketchLabels: [],
          sketchStartPointId: null,
          sketchCurrentPoint: null,
          selectedPointId: null,
          selectedLineId: null,
          selectedCircleId: null,
          selectedLabelId: null,
          sketchThickness: 0.375,
          sketchWallHeight: 10,
          sketchFeatureMeta: {},
          sketchOperations: []
        };
      }),
      setActiveProjectId: (id: string | null) => set((state: SpatialState) => {
        let updatedProjects = [...state.projects];
        if (state.activeProjectId) {
          updatedProjects = updatedProjects.map(p => 
            p.id === state.activeProjectId 
              ? {
                  ...p,
                  points: state.sketchPoints,
                  lines: state.sketchLines,
                  circles: state.sketchCircles,
                  labels: state.sketchLabels,
                  thickness: state.sketchThickness,
                  wallHeight: state.sketchWallHeight,
                  featureMeta: state.sketchFeatureMeta,
                  operations: state.sketchOperations,
                }
              : p
          );
        }

        if (id === null) {
          return {
            projects: updatedProjects,
            activeProjectId: null,
            sketchPoints: [],
            sketchLines: [],
            sketchCircles: [],
            sketchLabels: [],
            sketchStartPointId: null,
            sketchCurrentPoint: null,
            selectedPointId: null,
            selectedLineId: null,
            selectedCircleId: null,
            selectedLabelId: null,
            sketchFeatureMeta: {},
            sketchOperations: [],
            currentOperationId: null,
            hoveredSketchOperationId: null
          };
        }

        const targetProj = updatedProjects.find(p => p.id === id);
        if (!targetProj) return { projects: updatedProjects };

        const loadedOps = targetProj.operations && targetProj.operations.length > 0
          ? targetProj.operations
          : buildOperationsFromGeometry(
              targetProj.points || [],
              targetProj.lines || [],
              targetProj.circles || [],
              targetProj.labels || []
            );

        return {
          projects: updatedProjects,
          activeProjectId: id,
          sketchPoints: targetProj.points || [],
          sketchLines: targetProj.lines || [],
          sketchCircles: targetProj.circles || [],
          sketchLabels: targetProj.labels || [],
          sketchThickness: targetProj.thickness ?? 0.375,
          sketchWallHeight: targetProj.wallHeight ?? 10,
          sketchFeatureMeta: targetProj.featureMeta || {},
          sketchOperations: loadedOps,
          sketchStartPointId: null,
          sketchCurrentPoint: null,
          selectedPointId: null,
          selectedLineId: null,
          selectedCircleId: null,
          selectedLabelId: null,
          currentOperationId: null,
          hoveredSketchOperationId: null
        };
      }),
      deleteProject: (id: string) => set((state: SpatialState) => {
        const remainingProjects = state.projects.filter(p => p.id !== id);
        const isActive = state.activeProjectId === id;

        const assetId = `project-${id}`;
        const updatedAssets = { ...state.assetDefinitions };
        delete updatedAssets[assetId];

        const updatedFurniture = state.furniture.filter((f: Furniture) => f.modelId !== assetId);

        if (isActive) {
          return {
            projects: remainingProjects,
            activeProjectId: null,
            assetDefinitions: updatedAssets,
            furniture: updatedFurniture,
            sketchPoints: [],
            sketchLines: [],
            sketchCircles: [],
            sketchLabels: [],
            sketchFeatureMeta: {},
            sketchOperations: [],
            currentOperationId: null,
            hoveredSketchOperationId: null,
            sketchStartPointId: null,
            sketchCurrentPoint: null,
            selectedPointId: null,
            selectedLineId: null,
            selectedCircleId: null,
            selectedLabelId: null
          };
        } else {
          return {
            projects: remainingProjects,
            assetDefinitions: updatedAssets,
            furniture: updatedFurniture
          };
        }
      }),
      saveProjectAsComponent: (id: string) => set((state: SpatialState) => {
        let updatedProjects = [...state.projects];
        if (state.activeProjectId === id) {
          updatedProjects = updatedProjects.map(p => 
            p.id === id 
              ? {
                  ...p,
                  points: state.sketchPoints,
                  lines: state.sketchLines,
                  circles: state.sketchCircles,
                  labels: state.sketchLabels,
                  thickness: state.sketchThickness,
                  wallHeight: state.sketchWallHeight,
                  featureMeta: state.sketchFeatureMeta,
                  operations: state.sketchOperations,
                }
              : p
          );
        }

        const project = updatedProjects.find(p => p.id === id);
        if (!project) return {};

        const points = project.points || [];
        const circles = project.circles || [];

        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        points.forEach((p: SketchPoint) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        });

        circles.forEach((c: SketchCircle) => {
          if (c.centerX - c.radius < minX) minX = c.centerX - c.radius;
          if (c.centerX + c.radius > maxX) maxX = c.centerX + c.radius;
          if (c.centerZ - c.radius < minZ) minZ = c.centerZ - c.radius;
          if (c.centerZ + c.radius > maxZ) maxZ = c.centerZ + c.radius;
        });

        if (minX === Infinity) {
          minX = -5; maxX = 5;
          minZ = -5; maxZ = 5;
        }

        const width = maxX - minX;
        const depth = maxZ - minZ;
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const height = project.wallHeight || 10;

        updatedProjects = updatedProjects.map(p => 
          p.id === id 
            ? { ...p, width, depth, centerX, centerZ }
            : p
        );

        const assetId = `project-${id}`;
        const assetDef: AuraAssetDefinition = {
          id: assetId,
          displayName: project.name || `Project (${id.substring(0, 4)})`,
          supportedFileType: 'generated',
          defaultDimensions: [width, height, depth],
          footprint: {
            width,
            depth,
            offset: [0, 0]
          },
          collision: [
            {
              id: `${assetId}-col`,
              name: 'Project Bounds',
              center: [0, height / 2, 0],
              size: [width, height, depth]
            }
          ],
          snapPoints: [],
          parts: [],
          materials: []
        };

        const updatedAssets = {
          ...state.assetDefinitions,
          [assetId]: assetDef
        };

        return {
          projects: updatedProjects,
          assetDefinitions: updatedAssets
        };
      }),
      updateProjectName: (id: string, name: string) => set((state: SpatialState) => {
        const updatedProjects = state.projects.map(p => 
          p.id === id ? { ...p, name } : p
        );
        
        const assetId = `project-${id}`;
        let updatedAssets = state.assetDefinitions;
        if (state.assetDefinitions[assetId]) {
          updatedAssets = {
            ...state.assetDefinitions,
            [assetId]: {
              ...state.assetDefinitions[assetId],
              displayName: name
            }
          };
        }
        
        return {
          projects: updatedProjects,
          assetDefinitions: updatedAssets
        };
      }),

      // --- Search Engine ---
      getSearchResults: () => {
        const { furniture, searchQuery } = get();
        if (!searchQuery.trim()) return [];
        
        const results: Array<{ item: Item, containerName: string, containerId: string, furnitureName: string, furnitureId: string }> = [];
        const lowerQuery = searchQuery.toLowerCase();

        furniture.forEach((f: Furniture) => {
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
      version: 7,
      migrate: (persistedState: any) => {
        const state = persistedState as Partial<SpatialState>;
        return {
          furniture: state.furniture ?? [],
          assetDefinitions: mergeWithDefaultAssetDefinitions(state.assetDefinitions),
          abyssDarkness: state.abyssDarkness ?? 0,
          gridOpacity: state.gridOpacity ?? 0.8,
          cameraProjection: state.cameraProjection ?? 'PERSPECTIVE',
          projects: state.projects ?? [],
          activeProjectId: state.activeProjectId ?? null,
          sketchReferenceMode: state.sketchReferenceMode ?? false,
        };
      },
      partialize: (state: SpatialState) => ({ 
        furniture: state.furniture,
        assetDefinitions: state.assetDefinitions,
        abyssDarkness: state.abyssDarkness,
        gridOpacity: state.gridOpacity,
        cameraProjection: state.cameraProjection,
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        sketchReferenceMode: state.sketchReferenceMode,
      }), // Only save the physical layout and critical visual preferences
    }
  )
);
