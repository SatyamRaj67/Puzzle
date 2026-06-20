# Voxel Engine Architecture Context

**Tech Stack**: TypeScript, WebGPU, Web Workers.
**Design Paradigm**: Vercidium-style GPU compute architecture (SSBOs, Indirect Drawing).

## 1. Data Formats

- **Chunk Size**: 16x128x16.
- **Vertex Format (12 bytes / 3 Uint32s)**:
  - `Data1` (32-bit): X (4), Y (7), Z (4), TextureID (7), Width (5), Height (5).
  - `Data2` (32-bit): AO (8), ChunkX (12), ChunkZ (12).
  - `Data3` (32-bit): LightLevel (8), FaceDirection (5), Reserved (19).
- **Lighting**: 8-bit split (4-bit Sunlight, 4-bit Blocklight). Calculated via BFS Flood-Fill on a Web Worker.

## 2. Multithreading & Meshing

- `ChunkStore` holds `Uint8Array` data for physics and lighting.
- The `Worker` generates terrain, runs the BFS light updates (with a darkness removal pass), and executes `GreedyMesher.mesh()`.
- The `GreedyMesher` outputs 16 arrays. `[0-5]` = Opaque solid faces. `[6-9]` = Flora/Cross planes. `[10-15]` = Translucent liquid faces.

## 3. GPU Rendering (The Vercidium Pipeline)

- We do not use small vertex buffers. The `BufferArena` allocator manages two massive SSBOs: `opaqueArena` (64MB) and `translucentArena` (16MB).
- **Compute Culling**: `cull.wgsl` runs over an array of chunk bounding boxes. It executes Frustum culling (Plane dot products). If visible, it atomically writes a draw command into an Indirect Buffer.
- **Render Pass**: CPU issues a single `renderPass.drawIndirect()` loop reading directly from the compute shader's output. Dual-pass renders opaque first, translucent second (with `depthWriteEnabled: false`).

## 4. Shaders

- `chunk.wgsl`: Unpacks the 12-byte vertex, applies directional global sun + dynamic torch point-lights + baked BFS voxel light, and handles texture animation.
- `sky.wgsl`: Procedural skybox with rotating voxel 3D stars, day/night gradients, sun, and moon. Bound to the same `GlobalUniform` (112 bytes).
