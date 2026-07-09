# AURA Current State Handoff

Last updated after native model import, unit-normalization, and ViewCube model planning.

## What The User Is Building

AURA is a spatial inventory and room-mapping app. The user wants a reliable, smartphone-friendly 3D workspace for remembering physical storage locations by spatial position. It should feel like a holographic building/facility survey, not a normal CAD app and not a game toy.

Core motive:

- Make real rooms, furniture, drawers, containers, and later small stored objects visually navigable.
- Keep navigation smooth and deterministic on phones.
- Make furniture snapping and geometry trustworthy.
- Support imported/custom furniture assets through a calibration pipeline.

## User Preferences And Constraints

- Mobile performance matters more than expensive realism.
- Avoid real physics unless absolutely necessary.
- Prefer deterministic kinematic movement for drawers/doors.
- Do not add flashy luxury features unless they help the app become useful.
- UI should be practical and categorized, not one huge scrolling panel.
- Visual style should be holographic, transparent, readable, and professional.
- Free color choice is risky; use curated palettes/swatches.

## Canvas And Navigation Work Completed

Major canvas problems addressed:

- Removed obsolete Top/Front/Iso controls because ViewCube exists.
- Fixed two-finger pan direction.
- Tuned pinch/wheel zoom toward deterministic response.
- Perspective/orthographic toggle was adjusted to preserve view location better.
- Added focus zoom behavior around cursor/ground point.
- Real shadows were removed as too costly.
- Lightweight floor remains as the depth reference.
- Room grid was removed again because the shader/grid experiments were either visually bounded or not visible enough. Do not re-add grid unless there is a clear visual/performance plan.

Important files:

- `packages/engine-3d/src/components/IsometricCamera.tsx`
- `apps/desktop-viewer/src/App.tsx`

## CAD Sketch Timeline Work Completed

We have built a Fusion 360-style bottom-docked timeline for the CAD Sketch mode to track and control drawing history.

Features:
- **Bottom-docked design**: Spans the entire width of the canvas drawing viewport (`bottom: 0, left: 0, right: 0`, height `42px`), presenting a cohesive engineering workspace.
- **Drag-to-scrub rollback handle**: Handles drag interactions on the yellow rollback handle, snapping to positions between operation cards and filtering out elements drawn after the rollback boundary.
- **Animation controls**: Play/Pause, step, and fast-forward controls for animating drawing construction.
- **Color-coded feature cards**: Clear icons indicating item type (`Plus` for Vertex, `Slash` for Line Wall, `Circle` for Circle Wall, `Edit3` for Label) with dedicated accents.
- **Context menus & tooltips**: Right-click to Delete or Select features directly from the timeline, and hover to see coordinates, lengths, and dimensions in a glassmorphic tooltip.

Important files:
- `apps/desktop-viewer/src/components/UIPanels.tsx` (contains `CADTimeline`)
- `apps/desktop-viewer/src/App.tsx` (mounts timeline inside CAD viewport)
- `packages/engine-3d/src/components/SketchOverlay3D.tsx` (filters elements reactively)
- `packages/state-store/src/store.ts` (manages `sketchTimelineIndex` and rollback triggers)

## Snapping And Geometry Work Completed

Furniture snapping now uses shared footprint logic instead of scattered assumptions.

Important files:

- `packages/engine-3d/src/furnitureGeometry.ts`
- `packages/engine-3d/src/SceneManager.tsx`
- `packages/engine-3d/src/components/SnapFootprints.tsx`
- `packages/engine-3d/src/components/AlignmentGuides.tsx`

Current behavior:

- Magnetic snapping caches nearby targets when dragging starts.
- It snaps center/edge to center/edge using standardized footprints.
- Alignment guide lines render while snapping.
- `Bounds` toggle shows snap footprints: selected object green, other objects orange.
- Cabinet footprint accounts for visual shell and drawer protrusion.

Important note:

- The current footprint system is axis-aligned after Y rotation, not full oriented polygon collision. This is okay for now but will need refinement for complex rotated furniture/collision.

## Asset Calibrator Work Completed

Asset calibration is now a separate workspace.

Open path:

- Room workspace left panel has an `Assets` button.
- Asset workspace has:
  - searchable asset browser
  - isolated asset preview canvas
  - right-side categorized editor

Editor categories:

- Setup: asset selection/name/default dimensions
- Bounds: footprint, collision boxes, snap points
- Parts: moving part axes/open/closed offsets
- Look: curated color swatches and opacity sliders

Import/runtime status:

- Native import currently supports `.glb`, `.gltf`, `.fbx`, `.obj`, and `.stl`.
- Imported files are stored offline in browser IndexedDB through `packages/state-store/src/assetFileStore.ts`.
- Imported asset metadata persists in Zustand and links to stored file blobs by `sourceStorageKey`.
- Imported assets appear in the Furniture panel under Imported Assets and use the click-to-place flow.
- The room renderer can load placed imported GLB/GLTF/FBX/OBJ/STL assets.
- FBX/OBJ/STL imports with very large raw dimensions are treated as millimeter CAD exports and converted to AURA feet using `1 ft = 304.8 mm`.
- Imported meshes are normalized with `sourceUnitScale` and `sourceModelOffset` so the model is centered on its footprint and rests on the floor.

Known import behavior:

- Fusion 360 FBX exports can preserve separate bodies as separate mesh nodes. Example inspected file: `viewcube.fbx` exported two meshes, `Body2` and `Body3`, with raw bounds `[280, 100, 100]` in millimeters.
- Imported model opacity has a minimum visible clamp in renderer/editor to avoid fully invisible imported assets against the black workspace.
- Asset Workspace object URLs are kept alive for the workspace lifetime. Do not recreate/revoke model URLs on material slider changes because that previously blanked the preview/UI.

Important files:

- `apps/desktop-viewer/src/components/AssetWorkspace.tsx`
- `apps/desktop-viewer/src/components/UIPanels.tsx`
- `packages/state-store/src/types.ts`
- `packages/state-store/src/store.ts`

## AURA Asset Format Direction

The intended future pipeline is:

```txt
3D model file + AURA metadata = usable furniture asset
```

Recommended structure:

```txt
metal_cabinet.glb
metal_cabinet.aura.json
```

GLB/gLTF should be the main target because it works well with Three.js, mobile/web, offline caching, named meshes, hierarchy, materials, and animations.

AURA metadata should store:

- visual role/material role
- footprint
- collision bounds
- snap points
- moving parts
- drawer/door motion
- container bounds
- app-specific behavior

Supported file strategy:

- Best runtime target: `.glb` / `.gltf`
- Currently supported direct imports: `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`
- Good Fusion 360 export choice right now: `.fbx`
- OBJ/GLTF companion files are not fully packaged yet; future work should support one asset with a main model file plus companion files like `.mtl`, `.bin`, and textures.
- CAD/proprietary formats such as STEP/IGES/SAT/SMT/F3D/IPT/DWG/SKP/USDZ are not yet supported directly in AURA.

Important rule:

- If a drawer/door is exported as a separate mesh/node, AURA can move it.
- If everything is merged into one mesh, AURA can still use it as static furniture but cannot reliably animate a drawer/door separately.

## Current Hologram Theme

Theme data is centralized in:

- `packages/state-store/src/hologramTheme.ts`

Current palette concept:

- background: near black
- building/walls: light cyan, very transparent, bright outline
- furniture body: cyan/teal, transparent, strong outline
- inner parts/drawers: darker contrasting color, currently rose/red in the main palette
- handles/small details: bright cyan-white
- selection: white
- snap guides: pink/red
- collision/debug: green

Important: user does not want arbitrary color picker. Use curated swatches only.

## Recent Visual Fix

The cabinet body showed diagonal lines in Asset preview due to geometry-derived edge rendering on transparent box geometry. The fix was to replace generic edge helpers on key boxes with explicit 12-edge rectangular outlines.

Important files:

- `packages/engine-3d/src/components/ParametricCabinet.tsx`
- `apps/desktop-viewer/src/components/AssetWorkspace.tsx`

## Current Known Risks / Next Work

Recommended next work:

1. Build real import pipeline for `.glb/.gltf`.
2. In Asset Calibrator, list model mesh/node hierarchy.
3. Allow selecting a mesh/node and assigning role: static, drawer, door, handle, container.
4. Auto-generate footprint/collision from bounding boxes.
5. Save/load `.aura.json`.
6. Add calibrated asset instances to the room catalog.
7. Later: item/container placement inside drawers as local drawer-space children.

Avoid next:

- Do not add real physics for drawers/items yet.
- Do not add unrestricted color picker.
- Do not mix asset tools into the normal room panel again.

## Custom ViewCube Pipeline Notes

The user made prototype ViewCube geometry in Fusion 360 and wants to eventually use a custom colorful model in the UI as the actual ViewCube.

Preferred approach:

- Keep ViewCube camera/orientation interaction logic in code.
- Use the imported model only for the visual ViewCube shell.
- Render the model inside the existing ViewCube/Gizmo area.
- Assign colors/materials by mesh/component names rather than relying on arbitrary model materials.
- Keep clickable zones in code for faces/edges/corners so navigation remains stable.

Preferred authoring/export guidance:

- Export FBX from Fusion 360 for now, or GLB if available through another tool.
- Make visible pieces separate named components/bodies:
  - `body`
  - `face_front`, `face_back`, `face_left`, `face_right`, `face_top`, `face_bottom`
  - `edge_*`
  - `corner_*`
- Raised/popping edge and corner geometry is better than subtle chamfers because the hologram style and transparent materials can hide tiny bevels.
- Later implementation can map part names to curated colors:
  - body: cyan/blue transparent
  - faces: lighter cyan
  - edges: bright teal/white
  - corners/active highlights: pink/white

## Commands

Run from `D:\Desktop\AURA.2\AURA_Spatial_Tracker`:

```bash
pnpm --filter desktop-viewer lint
pnpm --filter desktop-viewer build
pnpm --filter desktop-viewer dev -- --host 0.0.0.0 --port 5176
```

Known build note:

- `pnpm --filter desktop-viewer build` may fail inside the managed Windows sandbox with Vite `spawn EPERM`.
- Rerun the same command with escalation. If successful, ignore the current large bundle warning unless the user asks to optimize bundle size.
