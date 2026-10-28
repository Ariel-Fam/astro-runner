"""Reproducible architecture kit; execute inside Blender through send.py."""
import bpy
import math
import json
import struct
import numpy as np
import random
from array import array
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/architecture'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'assets/architecture'
SOURCE.mkdir(parents=True, exist_ok=True)
# Work in a separate scene; preserve all existing user objects.
scene = bpy.data.scenes.new('New Eden Architecture / enhanced')
original_scene = bpy.context.window.scene
bpy.context.window.scene = scene

# One packed facade atlas for the whole kit. Windows are opaque, avoiding
# transparency sorting and expensive transmission materials in the city.
N = 1024
pixels = array('f', [0.0]) * (N * N * 4)
def rect(x, y, w, h, color):
    row = array('f', [*color, 1.0]) * w
    for yy in range(y, min(y+h, N)):
        start = (yy*N+x)*4
        pixels[start:start+w*4] = row

rect(0,0,N,N,(0.32,0.35,0.34))
rng = random.Random(27)
# 3 facade tiles, each 8 storeys by 4 bays.
for kind, ox, oy in [(0,0,0),(1,512,0),(2,0,512)]:
    base = [(0.64,0.63,0.56),(0.17,0.27,0.29),(0.44,0.29,0.23)][kind]
    rect(ox,oy,512,512,base)
    for floor in range(8):
        y=oy+floor*64
        if kind==2:
            for course in range(8):
                cy=y+course*8
                rect(ox,cy,512,1,(0.26,0.24,0.21))
                for bx in range(0,512,32):
                    xx=ox+((bx+(16 if course%2 else 0))%512)
                    rect(xx,cy,1,8,(0.27,0.24,0.21))
        for bay in range(4):
            x=ox+bay*128
            if kind==1:
                rect(x+2,y+2,124,60,(0.24+floor*.008,0.36+floor*.008,0.39+floor*.009))
                rect(x+4,y+4,120,42,(0.12,0.24+floor*.008,0.28+floor*.008))
                rect(x+10,y+8,3,35,(0.40,0.52,0.53))
                rect(x+2,y+48,124,10,(0.12,0.17,0.18))
                rect(x,y,2,64,(0.53,0.57,0.55))
            else:
                width=76 if kind==0 else 64
                left=x+(128-width)//2
                rect(left-4,y+9,width+8,45,(0.20,0.23,0.22))
                lit=rng.random()<.25
                glass=(0.70,0.62,0.39) if lit else (0.16,0.26+floor*.006,0.29+floor*.008)
                rect(left,y+13,width,36,glass)
                rect(left+3,y+15,width//3,31,tuple(v*1.18 for v in glass))
                rect(left+width//2,y+13,2,36,(0.45,0.47,0.43))
                rect(left,y+30,width,2,(0.33,0.36,0.33))
                rect(left-6,y+7,width+12,3,(0.76,0.75,0.66))
                rect(x,y,128,2,(0.40,0.41,0.36))
                if kind==0:
                    rect(x+2,y+3,1,58,(0.52,0.52,0.46))
# Palette swatches in the fourth quadrant, with gutters.
colors=[(0.70,0.70,0.63),(0.25,0.29,0.28),(0.43,0.47,0.44),
        (0.12,0.22,0.25),(0.52,0.35,0.25),(0.35,0.44,0.29),
        (0.72,0.78,0.57),(0.16,0.18,0.17)]
for i,c in enumerate(colors):
    rect(512+(i%4)*128,512+(i//4)*128,128,128,c)
# Roof membrane with seams.
rect(512,768,512,256,(0.32,0.36,0.35))
for x in range(512,1024,32): rect(x,768,1,256,(0.40,0.43,0.40))
# High resolution PBR textures share one UV atlas and one opaque material.
# NumPy builds surface detail in Blender; no runtime procedural texture cost.
RES=2048
base=np.asarray(pixels,dtype=np.float32).reshape(N,N,4)
color=np.repeat(np.repeat(base,2,axis=0),2,axis=1).copy()
noise=np.random.default_rng(27).normal(0,.007,(RES,RES)).astype(np.float32)
color[:,:,:3]+=noise[:,:,None]
height=np.full((RES,RES),.55,dtype=np.float32)
rough=np.full((RES,RES),.78,dtype=np.float32)
metal=np.full((RES,RES),.04,dtype=np.float32)
emission=np.zeros((RES,RES,4),dtype=np.float32);emission[:,:,3]=1

def region(x,y,w,h):return (slice(y*2,(y+h)*2),slice(x*2,(x+w)*2))
for kind,ox,oy in [(0,0,0),(1,512,0),(2,0,512)]:
    for floor in range(8):
        for bay in range(4):
            x=ox+bay*128; y=oy+floor*64
            left=x+4 if kind==1 else x+(128-(76 if kind==0 else 64))//2
            bottom=y+4 if kind==1 else y+13
            w=120 if kind==1 else (76 if kind==0 else 64)
            h=42 if kind==1 else 36
            ys,xs=region(left,bottom,w,h)
            yy,xx=np.mgrid[0:h*2,0:w*2]
            rng_room=np.random.default_rng(kind*1000+floor*4+bay)
            lit=rng_room.random()<.28
            # Reflected cool sky, dark room silhouettes, and curtain/blind detail.
            sky=.12+.18*(yy/(h*2))+.03*np.sin(xx/(w*2)*6+floor)
            pane=np.stack([sky*.65,sky*1.12,sky*1.35],axis=-1)
            if lit:
                pane+=np.array([.22,.145,.065])
                emission[ys,xs,:3]=pane*np.array([.8,.7,.5])
            partition=(np.abs(xx-w)<2)|(np.abs(yy-h)<1)
            pane[partition]=(.23,.27,.27)
            if (bay+floor)%3==0:
                blinds=(yy%9<2)&(yy>h*.9)
                pane[blinds]*=.52
            # Subtle interior silhouettes at the window base.
            furniture=(yy<h*.35)&((xx//17+floor)%4==0)
            pane[furniture]*=.42
            pane[:3,:,:]*=.35;pane[-3:,:,:]*=.7
            pane[:,:3,:]*=.45;pane[:,-3:,:]*=.45
            color[ys,xs,:3]=pane+noise[ys,xs,None]*.25
            height[ys,xs]=.22
            height[bottom*2:(bottom+h)*2,left*2:left*2+3]=.65
            rough[ys,xs]=.17 if kind==1 else .25
            metal[ys,xs]=.32
            # Fine stone joints and weather streaks outside the windows.
            if kind!=1:
                joint_y=(y+2)*2
                height[joint_y:joint_y+2,x*2:(x+128)*2]=.43
                color[joint_y:joint_y+2,x*2:(x+128)*2,:3]*=.82
# Roof panel seams and masonry joints affect the normal map too.
for y in range(1024,2048,16):height[y:y+1,:1024]=.45
for x in range(1024,2048,64):height[1536:2048,x:x+2]=.42
color[:,:,:3]=np.clip(color[:,:,:3],0,1)
color[:,:,3]=1
# Bake tangent-space normals. Broad planar walls remain smooth; recesses and
# stone joints perturb the light without adding hundreds of window meshes.
dy,dx=np.gradient(height)
norm=np.stack([-dx*3,-dy*3,np.ones_like(dx)],axis=-1)
norm/=np.linalg.norm(norm,axis=-1,keepdims=True)
normal=np.ones_like(color);normal[:,:,:3]=norm*.5+.5
orm=np.ones_like(color);orm[:,:,1]=rough;orm[:,:,2]=metal

def save_texture(name,data,non_color=False,jpeg=False):
    image=bpy.data.images.new(name,width=RES,height=RES)
    if non_color:image.colorspace_settings.name='Non-Color'
    image.pixels.foreach_set(np.clip(data,0,1).ravel())
    image.file_format='JPEG' if jpeg else 'PNG'
    image.filepath_raw=str(SOURCE/(name+('.jpg' if jpeg else '.png')))
    image.save();image.pack()
    return image
images={
    'color':save_texture('facades-hq',color,jpeg=True),
    'normal':save_texture('facades-normal',normal,True),
    'orm':save_texture('facades-orm',orm,True),
    'emission':save_texture('facades-emission',emission),
}
mat=bpy.data.materials.new('New Eden / detailed PBR architecture');mat.use_nodes=True;mat.use_backface_culling=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links
bsdf=nodes.get('Principled BSDF')
bsdf.inputs['Emission Strength'].default_value=.5
for key,img in images.items():
    tex=nodes.new('ShaderNodeTexImage');tex.image=img
    if key=='color':links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    elif key=='normal':
        n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.65
        links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],bsdf.inputs['Normal'])
    elif key=='orm':
        separate=nodes.new('ShaderNodeSeparateColor')
        links.new(tex.outputs['Color'],separate.inputs['Color'])
        links.new(separate.outputs['Green'],bsdf.inputs['Roughness'])
        links.new(separate.outputs['Blue'],bsdf.inputs['Metallic'])
    else:links.new(tex.outputs['Color'],bsdf.inputs['Emission Color'])

verts=[]; faces=[]; uv_faces=[]; low_models=[]
def uv_rect(tile):
    if isinstance(tile,int):
        x=512+(tile%4)*128+64; y=512+(tile//4)*128+64
        return [(x/N,y/N)]*4
    x,y,w,h=tile
    return [((x+2)/N,(y+2)/N),((x+w-2)/N,(y+2)/N),
            ((x+w-2)/N,(y+h-2)/N),((x+2)/N,(y+h-2)/N)]
STONE=(0,0,512,512); GLASS=(512,0,512,512); BRICK=(0,512,512,512); ROOF=(512,768,512,256)
def box(x,y,z,w,d,h,surface=0,top=2):
    start=len(verts)
    verts.extend([(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sx,sy,sz in
                  [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                   (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
    side_faces=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    for ids,tile in [((0,3,2,1),top),((4,5,6,7),top)]:
        faces.append(tuple(start+i for i in ids));uv_faces.append(uv_rect(tile))
    for ids in side_faces:
        if not isinstance(surface,int) and surface in [STONE,GLASS,BRICK]:
            # Quads carry independent UV ranges, sharing the same material.
            segments=max(1,math.ceil(h/28))
            for segment in range(segments):
                t0=segment/segments;t1=(segment+1)/segments
                lo0=Vector(verts[start+ids[0]]);lo1=Vector(verts[start+ids[1]])
                hi1=Vector(verts[start+ids[2]]);hi0=Vector(verts[start+ids[3]])
                offset=len(verts)
                verts.extend([tuple(lo0.lerp(hi0,t0)),tuple(lo1.lerp(hi1,t0)),
                              tuple(lo1.lerp(hi1,t1)),tuple(lo0.lerp(hi0,t1))])
                faces.append(tuple(range(offset,offset+4)))
                tx,ty,tw,th=surface
                tile_height=min(th,th*(h/segments)/28)
                uv_faces.append(uv_rect((tx,ty,tw,tile_height)))
        else:
            faces.append(tuple(start+i for i in ids));uv_faces.append(uv_rect(surface))

def parapet(w,d,z):
    for x in [-w/2,w/2]: box(x,0,z,.20,d+.2,.7,0)
    for y in [-d/2,d/2]: box(0,y,z,w,.20,.7,0)
def hvac(x,y,z):
    box(x,y,z+0.65,2.2,3,1.3,2)
    for n in range(4): box(x,y-1.51,z+.25+n*.25,1.85,.04,.08,7)
    box(x+.8,y,z+1.6,.22,.3,.6,1)
def finish(name):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces); mesh.update()
    uv=mesh.uv_layers.new(name='Atlas')
    for poly,coords in zip(mesh.polygons,uv_faces):
        for idx,co in zip(poly.loop_indices,coords): uv.data[idx].uv=co
    mesh.materials.append(mat)
    obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj)
    low=bpy.data.objects.new(name+'_LOD',mesh.copy());scene.collection.objects.link(low)
    low_models.append(low)
    obj['source']='Authored in Blender via local MCP'
    # Limit bevels to strong exposed angles; a single segment catches highlights.
    bevel=obj.modifiers.new('Architectural edge highlights','BEVEL')
    bevel.width=.045;bevel.segments=1;bevel.limit_method='ANGLE'
    bevel.angle_limit=.6
    bevel.affect='EDGES'
    bevel.harden_normals=True
    with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
        bpy.context.view_layer.objects.active=obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        obj.select_set(False)
    verts.clear(); faces.clear(); uv_faces.clear()
    return obj

# Architectural massing and real silhouette detail, all merged per building.
box(0,0,2,15,17,4,0)
box(0,0,22,13.8,15.8,36,STONE)
for x in [-6.9,-3.45,0,3.45,6.9]:
    for y in [-8,8]: box(x,y,22,.24,.35,36,0)
for z in [4,13,22,31,40]: box(0,0,z,14.2,16.2,.28,0)
box(0,0,47,10.8,12.8,14,STONE)
box(0,0,58,7.8,9.8,8,STONE)
for w,d,z in [(14,16,40),(11,13,54),(8,10,62)]: parapet(w,d,z)
box(0,0,63,4,5,2,2)
box(0,0,66,.18,.18,4,1)
hvac(3,2,40)
limestone=finish('LimestoneTower')

box(0,0,1.5,16,17,3,1)
box(-1.1,0,29,12.8,14.8,52,GLASS)
box(5.8,1.8,25,3,10,44,GLASS)
for z in range(4,56,4): box(-1.1,0,z,13,15,.16,2)
for x in [-7.5,-4.3,-1.1,2.1,5.3]:
    for y in [-7.5,7.5]: box(x,y,29,.12,.18,52,2)
box(-1.1,0,56.3,13.6,15.6,.5,0)
parapet(13.6,15.6,56.7)
box(-1.1,0,58.2,7,9,3,1)
hvac(-2,1,59.7)
# Cantilevered entrance canopy.
box(0,-9,3.5,10,3,.25,2)
for x in [-4,4]: box(x,-10,1.7,.18,.18,3.4,2)
glass=finish('GlassTower')

box(0,0,1,16,17,2,0)
for level in range(4):
    w=15-level*2; d=16-level*1.7; z=2+level*10
    box(0,level*.4,z+5,w,d,10,STONE)
    # Balconies, recessed dark door fronts, and open metal railings.
    for floor in range(3):
        zz=z+1+floor*3
        for side in [-1,1]:
            yy=level*.4+side*(d/2+.65)
            box(0,yy,zz,w,1.5,.18,0)
            box(0,yy+side*.68,zz+.85,w,.08,.08,1)
            for x in range(-int(w/2),int(w/2)+1,2):
                box(x,yy+side*.68,zz+.42,.06,.06,.84,1)
    parapet(w,d,z+10)
    if level<3:
        for side in [-1,1]:
            box(side*(w/2-.6),0,z+10.45,.7,8,.65,2)
            box(side*(w/2-.6),0,z+10.8,.6,7.8,.18,5)
hvac(0,2,42)
terraces=finish('TerraceApartments')

box(0,0,1,17,17,2,4)
box(0,0,14,16,16,24,BRICK)
for z in [2,10,18,26]: box(0,0,z,16.5,16.5,.3,0)
for x in [-7.8,0,7.8]:
    for y in [-8,8]: box(x,y,14,.45,.35,24,4)
parapet(16.5,16.5,26.5)
box(-2,1,28.5,9,10,4,BRICK)
box(-2,1,30.6,9.4,10.4,.3,0)
hvac(4,-3,26.8); hvac(4,2,26.8)
for x in [-5,-3]:
    box(x,3,33,.6,.6,6,4)
    box(x,3,36.1,.85,.85,.25,1)
# Roof skylight and service door.
box(0,-8.05,3,3,.15,4,7)
box(0,-9.1,5.1,4,2.5,.2,2)
box(-2,-2,31,5,4,.5,3)
brick=finish('BrickWorks')

models=[limestone,glass,terraces,brick]
# Export only the kit, not any original scene content.
bpy.ops.object.select_all(action='DESELECT')
for obj in models+low_models: obj.select_set(True)
bpy.context.view_layer.objects.active=limestone
bpy.ops.export_scene.gltf(filepath=str(OUT/'new-eden-kit-hq.glb'),export_format='GLB',
                          use_selection=True,use_active_scene=True,export_yup=True,export_materials='EXPORT',
                          export_normals=True,export_texcoords=True,export_animations=False)
export_path=OUT/'new-eden-kit-hq.glb'
raw=export_path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length])
names={'LimestoneTower','GlassTower','TerraceApartments','BrickWorks'}
names|={name+'_LOD' for name in list(names)}
for item in doc.get('nodes',[])+doc.get('meshes',[]):
    base=item.get('name','').split('.')[0]
    if base in names:item['name']=base
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
tail=raw[20+length:]
export_path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+
    struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
stats=[]
for obj in models+low_models:
    obj.data.calc_loop_triangles()
    stats.append({'name':obj.name.split('.')[0],'triangles':len(obj.data.loop_triangles),
                  'dimensions':list(obj.dimensions)})
(OUT/'manifest-hq.json').write_text(json.dumps({'models':stats,'atlas': [N,N],
    'materials':1,'textureMaps':4,'glbBytes':(OUT/'new-eden-kit-hq.glb').stat().st_size},indent=2))
# Save an editable isolated library, preserving the open user's .blend file.
# Arrange a non-exported preview of the kit in its separate scene.
for i,obj in enumerate(models): obj.location.x=(i-1.5)*24
for obj in low_models:obj.hide_set(True)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.shading.type='MATERIAL'
        region=area.spaces.active.region_3d
        region.view_distance=130
        region.view_location=Vector((0,0,26))
        from mathutils import Quaternion
        region.view_rotation=Quaternion((0.86,0.42,-0.12,-0.26)).normalized()
bpy.data.libraries.write(str(SOURCE/'new-eden-kit-hq.blend'),{scene},fake_user=True)
result={'models':stats,'glbBytes':(OUT/'new-eden-kit-hq.glb').stat().st_size,
        'originalScene':original_scene.name,'assetScene':scene.name}
