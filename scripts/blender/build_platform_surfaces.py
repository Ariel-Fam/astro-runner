"""Author eight compact PBR platform finishes in Blender through MCP."""
import bpy, math, json, struct
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models/architecture';SOURCE=ROOT/'assets/architecture'
scene=bpy.data.scenes.new('New Eden / district platform finishes');bpy.context.window.scene=scene
W,H,T=1024,512,256
color=np.ones((H,W,4),np.float32);normal=np.ones_like(color);orm=np.ones_like(color);emissive=np.zeros_like(color);emissive[:,:,3]=1
height=np.zeros((H,W),np.float32)
# Muted base surfaces keep route markers legible; accent colors follow maps.ts.
accents=['d4f86a','b9a1fa','ffbe79','9fe5bc','ff8fba','9adcf1','efdf99','f6aa68']
bases=[(.30,.34,.29),(.20,.23,.29),(.14,.21,.25),(.41,.48,.41),(.24,.23,.30),(.43,.50,.53),(.51,.48,.39),(.30,.32,.29)]
names=['Skyline / roof panels','Undercity / service grating','Solar / collector cells','Gardens / mossy stone','Neon / signal tiles','Orbital / alloy plates','Spire / limestone inlay','Driftworks / freight tread']
y,x=np.mgrid[0:T,0:T]
rng=np.random.default_rng(71)
for i,base in enumerate(bases):
    ox=(i%4)*T;oy=(i//4)*T
    ys,xs=slice(oy,oy+T),slice(ox,ox+T)
    accent=np.array([int(accents[i][n:n+2],16)/255 for n in (0,2,4)])
    tile=np.ones((T,T,3),np.float32)*np.array(base)
    tile+=rng.normal(0,.009,(T,T,1))
    relief=np.full((T,T),.5,np.float32)
    rough=np.full((T,T),.82,np.float32);metal=np.full((T,T),.08,np.float32)
    joints=(x%128<3)|(y%64<3)
    if i==1:
        joints=(x%16<3)|(y%64<3);metal[:]=.55;rough[:]=.6
        tile[joints]*=.28;relief[joints]=.22
    elif i==2:
        joints=(x%32<2)|(y%64<3)
        tile[:]=np.array(base)*(1+.08*np.sin(x[:,:,None]/12))
        tile[joints]=(.44,.39,.28);relief[joints]=.58;metal[:]=.52;rough[:]=.32
        tile[(y%8==0)&~joints]*=1.16
    elif i==3:
        joints=((x+(y//64%2)*32)%64<3)|(y%64<3)
        tile[joints]=(.17,.25,.17);relief[joints]=.34
        tile+=((x//64+y//64)%3)[:,:,None]*.012
    elif i==5:
        joints=(x%128<3)|(y%128<3);metal[:]=.65;rough[:]=.45
        tile[joints]*=.45;relief[joints]=.3
    elif i==6:
        joints=(x%64<2)|(y%128<2)
        tile[joints]=accent*.44;relief[joints]=.37
    elif i==7:
        joints=(x%128<3)|(y%128<3);metal[:]=.5;rough[:]=.72
        tread=(((x+y)%32<3)&((x-y)%32<13))
        tile[tread]*=1.25;relief[tread]=.63
        tile[joints]*=.4;relief[joints]=.28
    else:
        tile[joints]*=.62;relief[joints]=.36
    # Small colored service inlays; no full glowing floor or visual obstruction.
    stripe=((x>10)&(x<13)&(y>16)&(y<53))|((y>10)&(y<13)&(x>16)&(x<53))
    tile[stripe]=accent*.65;relief[stripe]=.52
    emissive[ys,xs,:3][stripe]=accent*.13
    for bx in [7,121,135,249]:
        for by in [7,121,135,249]:
            bolt=(x-bx)**2+(y-by)**2<3
            tile[bolt]=(.53,.55,.5);relief[bolt]=.6
    if i==7:
        hazard=(x<9)&(((x+y)//10)%2==0)
        tile[hazard]=accent*.72
    color[ys,xs,:3]=np.clip(tile,0,1)
    height[ys,xs]=relief
    orm[ys,xs,1]=rough;orm[ys,xs,2]=metal
# Compute each tile's normals independently to keep atlas boundaries clean.
for i in range(8):
    ox=(i%4)*T;oy=(i//4)*T;ys,xs=slice(oy,oy+T),slice(ox,ox+T)
    dy,dx=np.gradient(height[ys,xs]);v=np.stack([-dx*2,-dy*2,np.ones_like(dx)],-1)
    v/=np.linalg.norm(v,axis=-1,keepdims=True);normal[ys,xs,:3]=v*.5+.5
material=bpy.data.materials.new('New Eden district platform PBR');material.use_nodes=True;material.use_backface_culling=True
bsdf=material.node_tree.nodes.get('Principled BSDF');nodes=material.node_tree.nodes;links=material.node_tree.links
for key,data in [('color',color),('normal',normal),('orm',orm),('emissive',emissive)]:
    img=bpy.data.images.new('platform-'+key,width=W,height=H)
    if key in ['normal','orm']:img.colorspace_settings.name='Non-Color'
    img.pixels.foreach_set(data.ravel());img.file_format='PNG';img.filepath_raw=str(SOURCE/('platform-'+key+'.png'));img.save();img.pack()
    tex=nodes.new('ShaderNodeTexImage');tex.image=img
    if key=='color':links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    elif key=='normal':
        n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.5
        links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],bsdf.inputs['Normal'])
    elif key=='orm':
        split=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],split.inputs['Color'])
        links.new(split.outputs['Green'],bsdf.inputs['Roughness']);links.new(split.outputs['Blue'],bsdf.inputs['Metallic'])
    else:links.new(tex.outputs['Color'],bsdf.inputs['Emission Color'])
bsdf.inputs['Emission Strength'].default_value=.3
verts=[];faces=[]
for i in range(8):
    xx=(i%4)*5;yy=(i//4)*5;k=len(verts)
    verts.extend([(xx,yy,0),(xx+4,yy,0),(xx+4,yy+4,0),(xx,yy+4,0)]);faces.append((k,k+1,k+2,k+3))
mesh=bpy.data.meshes.new('PlatformSurfacePalette');mesh.from_pydata(verts,[],faces);mesh.materials.append(material)
uv=mesh.uv_layers.new(name='District atlas')
for i,poly in enumerate(mesh.polygons):
    ox=(i%4)*T;oy=(i//4)*T
    for idx,(u,v) in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[idx].uv=((ox+2+u*252)/W,(oy+2+v*252)/H)
obj=bpy.data.objects.new('PlatformSurfacePalette',mesh);scene.collection.objects.link(obj)
with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(OUT/'platform-surfaces.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False)
path=OUT/'platform-surfaces.glb';raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
for item in doc.get('meshes',[])+doc.get('nodes',[]):
    if item.get('name','').startswith('PlatformSurfacePalette'):item['name']='PlatformSurfacePalette'
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+length:]
path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
bpy.data.libraries.write(str(SOURCE/'platform-surfaces.blend'),{scene},fake_user=True)
manifest={'atlas':[W,H],'tileSize':T,'tileWorldSize':4,'themes':names,'bytes':path.stat().st_size,'materials':1}
(OUT/'platform-surfaces.json').write_text(json.dumps(manifest,indent=2))
result=manifest
