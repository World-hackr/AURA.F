# AURA Spatial Inventory Tracker - Agent Context

## Project Core Philosophy
* **Goal:** A visual, spatial memory system for dense shops (hardware, electronics).
* **The Problem:** Translating text/database locations into physical locations causes cognitive friction.
* **The Solution:** A "Physicalized Filesystem" (Room -> Furniture -> Compartments -> Items).
* **Vibe:** Dark, minimal, low-poly, technical, "Tron/CAD" aesthetic. Calm and visual.

## Strict Architectural Rules
1. **Extreme Modularity:** The project is a Monorepo. `packages/engine-3d` must be completely ignorant of `apps/desktop`. Components must be reusable in other future projects.
2. **Visuals:** Isometric tilted camera ONLY. No free 3D orbiting to prevent users from getting lost. 
3. **Detail Level:** Render *Containers* (boxes, pouches, racks) NOT tiny items (screws, LEDs).
4. **Interaction:** "Minecraft/Sims" style pick-and-place with grid snapping. No architectural wall drafting. 
5. **Tech Stack:** Vite + React + Three.js (R3F) + Zustand. Desktop wrapper (Tauri) to come later.

## Agent Collaboration Rules
* **Zero Unapproved Files:** Never modify a file outside the active task without user clarification.
* **No Feature Creep:** If it doesn't help the user find an item faster, delay or remove it.
* **Update `architecture.md`:** When adding major modules, update `architecture.md` so Graphify can visualize the tree.

## Current Phase
**Phase 1: The Core Prototype**
- [ ] Setup Monorepo Workspace (pnpm)
- [ ] Scaffold `packages/engine-3d` (Vite library)
- [ ] Build Dark Neon Grid component
- [ ] Build basic Draggable Box component with grid-snap
- [ ] Build Fixed Isometric Camera
- [ ] Scaffold `apps/desktop-viewer` (Vite app) to render the engine