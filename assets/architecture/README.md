# New Eden architecture

The current runtime uses `public/models/architecture/new-eden-kit-hq.glb`.
Open `new-eden-kit-hq.blend` for the editable Blender source; the original
lightweight kit and source remain available as earlier versions.

## Enhanced building graphics

Four original Blender buildings use one shared opaque PBR material with 2048×2048
base-color, normal, roughness/metalness, and emissive atlases. Facades include room
silhouettes, blind details, stone joints, and lit windows. Glass reflects the nebula
with lower roughness than stone and brick. Exposed edges are beveled to catch
light. Facade UVs maintain approximately 3.5m story height on tower setbacks.

| Building | Nearby triangles | Distant triangles |
| --- | ---: | ---: |
| Limestone tower | 1,628 | 476 |
| Glass tower | 1,756 | 508 |
| Terraced apartments | 10,564 | 2,916 |
| Brick works | 1,564 | 444 |

The shared runtime kit is 2,203,504 bytes, with eight mesh primitives and four
embedded images. Six spatial blocks use static instancing and independent
frustum culling. Three.js LOD switches to the cheaper geometry beyond 155m with
12% hysteresis. Only one detail level renders per block/type, keeping the skyline
at a maximum of 24 building draw calls. Both levels share the same textures.
Textures use up to 8× anisotropic filtering, capped by device support.

The playable rooftop slabs and supports use the same PBR material, with roof
membrane UVs on top and correctly oriented facade UVs on the sides. Geometry and
collision dimensions remain unchanged. Scene lighting balances ambient fill with
directional light so material and surface differences remain visible.

Run `python3 scripts/blender/send.py scripts/blender/build_city.py` with Blender's
MCP add-on listening on localhost:9876 to rebuild. Each run creates a separate
Blender scene and preserves existing user objects. Asset tests check the actual
runtime kit for a 2.5MB download budget, one opaque material, complete PBR maps,
matching LOD bounds, and per-model geometry budgets. These limits are not a
device FPS guarantee.

## Street and paving kit

`new-eden-streets.blend` contains a 105m street module authored through Blender
MCP. The runtime `new-eden-streets.glb` is 393,172 bytes, with 1,638 triangles,
one opaque material, and one embedded 512×512 asphalt/paver/tactile/grate atlas.
It includes a central boulevard, service roads, cross streets, zebra crossings,
stop bars, curbs, tactile ramps, drains, manholes, benches, planters, and modeled
streetlights. Streetlights are scenery and do not add real-time point lights.

`Streets.tsx` repeats eight static instances in one draw call (13,104 triangles).
The ground is at Y=-40, matching building bases. `data/city.ts` reserves 14m
plus half each building's depth at cross streets, so buildings do not occupy the
carriageways. The rooftop platform route and gameplay collisions are unchanged.

Rebuild with `python3 scripts/blender/send.py scripts/blender/build_streets.py`.
The original open Blender scenes are preserved. Street tests enforce road
clearance in every district, a 450KB asset limit, fewer than 2,000 triangles per
module, and one opaque material/primitive/texture.

## District platform finishes

`platform-surfaces.blend` is the editable Blender MCP texture palette. Rebuild it
with `python3 scripts/blender/send.py scripts/blender/build_platform_surfaces.py`.
The 640,048-byte runtime `platform-surfaces.glb` embeds a single opaque PBR
material and four shared 1024×512 maps (color, normal, roughness/metalness, and
emission), divided into eight 256px district tiles:

1. Skyline: olive roof panels with lime service inlays.
2. Undercity: slate service grating with violet inlays.
3. Solar Array: blue collector cells with warm bronze seams.
4. Cloud Gardens: moss-jointed stone pavers with green inlays.
5. Neon Exchange: charcoal panels with pink signal inlays.
6. Zero Point: alloy plates with cyan inlays and fasteners.
7. The Spire: limestone with warm gold joints.
8. The Driftworks: freight tread with orange hazard edges.

`platformRoofData` repeats the selected tile every 4m, cropping the final tile
instead of stretching it. All top triangles remain exactly at the platform's
original collision height and face upward. Building facades remain on the sides.
One additional draw per platform renders its roof using the shared palette;
supports retain the original single material. No new lights or animated shaders
are added. Tests cover every generated platform in all eight districts for exact
surface coverage, orientation, and atlas bounds, plus the asset's 750KB budget.
