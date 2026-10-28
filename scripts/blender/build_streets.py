"""Create a textured, merged 105m streetscape module through Blender MCP."""
import bpy
import json
import struct
import math
import random
from array import array
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/architecture'
SOURCE = ROOT / 'assets/architecture'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('New Eden Streets')
bpy.context.window.scene = scene
N=512
pixels=array('f',[0.0])*(N*N*4)
rng=random.Random(41)
# Asphalt aggregate, jointed concrete pavers, and tactile paving in one atlas.
for y in range(N):
    for x in range(N):
        noise=rng.uniform(-.025,.025)
        if x<256 and y<256:
            v=.17+noise
            color=(v*.94,v,v*1.03)
            # Fine sealed cracks and faint wear, without extra geometry.
            if abs((x+int(5*math.sin(y*.05)))%113-56)<1: color=(.105,.115,.12)
        elif x>=256 and y<256:
            xx=x-256
            joint=(xx%32<2 or (y+(16 if (xx//32)%2 else 0))%32<2)
            v=.29 if joint else .53+noise+((xx//32+y//32)%3)*.015
            color=(v,v*.99,v*.94)
        elif x<256:
            xx=x; yy=y-256
            stud=((xx%16-8)**2+(yy%16-8)**2)<8
            v=.58 if stud else .46+noise
            color=(v,v*.78,v*.34)
        else:
            color=(.33,.36,.35)
        k=(y*N+x)*4
        pixels[k:k+4]=array('f',(*color,1))
def rect(x,y,w,h,c):
    row=array('f',(*c,1))*w
    for yy in range(y,y+h):
        k=(yy*N+x)*4; pixels[k:k+w*4]=row
palette=[(.78,.78,.68),(.75,.55,.15),(.20,.24,.23),(.49,.51,.46),
         (.13,.19,.16),(.35,.24,.15),(.34,.40,.31),(.65,.68,.57)]
for i,c in enumerate(palette):rect(256+(i%4)*64,256+(i//4)*64,64,64,c)
# Drain texture: metal bars over a dark recessed grate.
rect(256,384,128,128,(.10,.12,.12))
for x in range(260,384,12):rect(x,388,4,120,(.38,.40,.37))
image=bpy.data.images.new('New Eden street surface atlas',width=N,height=N)
image.pixels.foreach_set(pixels)
image.filepath_raw=str(SOURCE/'streets.png'); image.file_format='PNG'; image.save(); image.pack()
material=bpy.data.materials.new('New Eden / asphalt and paving'); material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Roughness'].default_value=.94
tex=material.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
material.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
V=[]; F=[]; U=[]
ASPHALT=(0,0,256,256); PAVERS=(256,0,256,256); TACTILE=(0,256,256,128); GRATE=(256,384,128,128)
def uv(tile,n=4):
    if isinstance(tile,int):
        x=256+(tile%4)*64+32; y=256+(tile//4)*64+32
        return [(x/N,y/N)]*n
    x,y,w,h=tile
    return [((x+2)/N,(y+2)/N),((x+w-2)/N,(y+2)/N),
            ((x+w-2)/N,(y+h-2)/N),((x+2)/N,(y+h-2)/N)]
def face(points,tile):
    start=len(V);V.extend(points);F.append(tuple(range(start,start+len(points))));U.append(uv(tile,len(points)))
def plane(x,y,z,w,d,tile):
    face([(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x-w/2,y+d/2,z)],tile)
def tiled(x0,x1,y0,y1,z,tile,step=12):
    nx=math.ceil((x1-x0)/step); ny=math.ceil((y1-y0)/step)
    w=(x1-x0)/nx;d=(y1-y0)/ny
    for ix in range(nx):
        for iy in range(ny):plane(x0+(ix+.5)*w,y0+(iy+.5)*d,z,w,d,tile)
def box(x,y,z,w,d,h,tile):
    pts=[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sx,sy,sz in
        [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    for ids in [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:face([pts[i] for i in ids],tile)
def disk(x,y,z,r,tile):
    for i in range(12):
        a=i*math.tau/12;b=(i+1)*math.tau/12
        face([(x,y,z),(x+r*math.cos(a),y+r*math.sin(a),z),(x+r*math.cos(b),y+r*math.sin(b),z)],tile)
# Paved city blocks. Road surface sits above these quads and never z-fights.
tiled(-174,174,0,105,-.025,PAVERS,12)
# Central boulevard and two outer service streets.
for x,w in [(0,24),(-148,14),(148,14)]:
    tiled(x-w/2,x+w/2,0,105,0,ASPHALT,20)
# Cross street at the start of each module; neighboring tiles share its junction.
tiled(-174,174,-9,9,.015,ASPHALT,20)
for side in [-1,1]:
    # Raised sidewalk lips and wide promenade paving along the boulevard.
    tiled(side*15-2.7,side*15+2.7,13.5,91.5,.16,PAVERS,6)
    box(side*12.15,52.5,.08,.3,78,.32,7)
    # Cross-street curbs stop at intersections with the outer roads.
    for y in [-9.2,9.2]:
        for lo,hi in [(18,140),(156,174)]:
            box(side*(lo+hi)/2,y,.08,hi-lo,.35,.32,7)
    # Edge lines, broken lane dividers, and a narrow double yellow centerline.
    for y in range(18,92,9):
        plane(side*5.9,y,.025,.12,4,0)
    plane(side*11.2,52.5,.025,.12,77,0)
    plane(side*.16,52.5,.028,.10,77,1)
    # Tactile curb ramps at the pedestrian crossings.
    for y in [-12,12]:plane(side*14.6,y,.18,3.8,1.2,TACTILE)
    # Zebra crossings across the cross street on either side of the junction.
    for y in range(-7,8,2):plane(side*21,y,.035,3,.9,0)
    # Drains, lamp posts, benches, and low planted verge boxes.
    for y in [25,52,81]:
        plane(side*11.7,y,.04,.38,1.8,GRATE)
    for y in [29,77]:
        x=side*16.5
        box(x,y,3.2,.16,.16,6.1,2)
        box(x-side*.7,y,6.25,1.6,.18,.15,2)
        box(x-side*1.4,y,6.13,1,.45,.12,7)
        box(x,y,.25,.45,.45,.5,3)
    for y in [39,67]:
        x=side*15
        for dx in [-.7,.7]:box(x+dx,y,.36,.10,.55,.72,2)
        for slat in range(3):box(x,y-.22+slat*.22,.75,2,.16,.10,5)
        box(x,y+.35,1.1,2,.09,.6,5)
    for y in [23,84]:
        x=side*16
        box(x,y,.45,1.4,3,.58,3)
        box(x,y,.79,1.15,2.75,.16,4)
        box(x,y,1.05,.95,2.5,.4,6)
# Zebra stripes across the central boulevard, before and after each junction.
for y in [-12,12]:
    for x in range(-10,11,2):plane(x,y,.04,.9,3.3,0)
# Stop bars, turn arrows, utility covers and service-road lane dashes.
for side in [-1,1]:
    plane(side*6,side*16,.03,10,.25,0)
    for y in [43,72]:
        x=side*8.5
        plane(x,y,.03,.24,3,0)
        tip=y+side*2
        arrow=[(x-.8,y+side*1,.03),(x+.8,y+side*1,.03),(x,tip,.03)]
        face(arrow if side>0 else list(reversed(arrow)),0)
    for y in range(18,94,10):plane(side*148,y,.025,.12,4,0)
    disk(side*4,34,.035,.5,2)
    disk(side*148,62,.035,.5,2)
mesh=bpy.data.meshes.new('StreetBlock');mesh.from_pydata(V,[],F);mesh.update()
layer=mesh.uv_layers.new(name='Street atlas')
for poly,coords in zip(mesh.polygons,U):
    for idx,co in zip(poly.loop_indices,coords):layer.data[idx].uv=co
mesh.materials.append(material)
obj=bpy.data.objects.new('StreetBlock',mesh);scene.collection.objects.link(obj)
obj['moduleLength']=105;obj['groundElevation']=-40
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=str(OUT/'new-eden-streets.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
    export_yup=True,export_materials='EXPORT',export_normals=True,export_texcoords=True,export_animations=False)
# Blender adds numeric suffixes when rerunning beside the previous scene.
# Keep the runtime node contract stable without renaming existing user objects.
export_path=OUT/'new-eden-streets.glb'
raw=export_path.read_bytes()
json_length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+json_length])
for item in doc.get('nodes',[])+doc.get('meshes',[]):
    if item.get('name','').split('.')[0]=='StreetBlock':item['name']='StreetBlock'
encoded=json.dumps(doc,separators=(',',':')).encode()
encoded+=b' ' *((-len(encoded))%4)
tail=raw[20+json_length:]
export_path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+
    struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
mesh.calc_loop_triangles()
stats={'name':'StreetBlock','triangles':len(mesh.loop_triangles),'materials':1,'atlas':[N,N],
       'moduleLength':105,'groundElevation':-40,'glbBytes':(OUT/'new-eden-streets.glb').stat().st_size}
(OUT/'streets-manifest.json').write_text(json.dumps(stats,indent=2))
bpy.data.libraries.write(str(SOURCE/'new-eden-streets.blend'),{scene},fake_user=True)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.shading.type='MATERIAL'
        region=area.spaces.active.region_3d
        region.view_distance=230;region.view_location=Vector((0,45,0))
        region.view_rotation=Quaternion((.88,.39,-.10,-.23)).normalized()
result=stats
