# Rigs a glove model to the 25 WebXR hand joints: flat bones, one per joint, named as ModelHandVisual expects
# (src/engine/xr/model-hand-visual.ts). Each vertex is weighted from its distance to the bones of its own finger (so
# touching fingers do not drag each other), then smoothed along the surface. Any rig the model came with is dropped.
#
# Each model is a profile: the joint positions measured from its mesh (another model needs its own) and, if its mesh is
# not already so, the turn and scale that put it in the frame all profiles share: a right hand in metres, wrist near the
# origin, fingers along -y, thumb towards +x, palm facing -z.
#   welding  the welding glove (asset-inbox/welding-glove, CC BY 4.0, see CREDITS.md); the default
#   cartoon  the white cartoon glove (asset-inbox/cartoon-glove, CC BY 4.0, see CREDITS.md)
#
#   test (renders rest, fist and grip poses into <outdir> and saves glove-rig.blend there):
#     blender -b --python scripts/blender/rig-glove.py -- asset-inbox/welding-glove/welding_glove.glb <outdir> test
#   export (one hand; the left is the right mirrored; textures shrunk to 512 px WebP):
#     blender -b --python scripts/blender/rig-glove.py -- asset-inbox/welding-glove/welding_glove.glb <outdir> export \
#       src/assets/models/hands/glove-right.glb right
#     ... export src/assets/models/hands/glove-left.glb left
#   another profile: add --profile <name> at the end, e.g.
#     blender -b --python scripts/blender/rig-glove.py -- asset-inbox/cartoon-glove/cartoon_glove.glb <outdir> export \
#       src/assets/models/hands/cartoon-glove-right.glb right --profile cartoon
import bpy, sys, math
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
profile = 'welding'
if '--profile' in argv:
    i = argv.index('--profile')
    profile = argv[i + 1]
    del argv[i:i + 2]
src, outdir, mode = argv[0], argv[1], argv[2]  # mode: test | export

V = Vector
SMOOTH_PASSES = 4
PARTS = ('metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip')
J = {}
# The mesh's turn and scale into the shared frame, applied after the import's own transforms; and where the wrist's
# weighting segment starts (it runs from there to the wrist joint, up the cuff).
PREP = Matrix.Identity(4)

if profile == 'welding':
    J['wrist'] = V((0.005, 0.0, 0.007))
    fingers = {
        # name: (mcp x, tip x, tip y, cmc (x, z), phalanx lengths)
        'index': (0.050, 0.0415, -0.227, (0.030, 0.010), (0.040, 0.024, 0.020)),
        'middle': (0.0155, 0.018, -0.237, (0.011, 0.012), (0.044, 0.028, 0.021)),
        'ring': (-0.0135, -0.014, -0.237, (-0.008, 0.011), (0.041, 0.026, 0.020)),
        'pinky': (-0.049, -0.048, -0.224, (-0.026, 0.009), (0.032, 0.019, 0.018)),
    }
    MCP_Y, MCP_Z, TIP_Z, CMC_Y = -0.112, 0.020, 0.011, -0.030
    for f, (mx, tx, ty, (cx, cz), ph) in fingers.items():
        mcp = V((mx, MCP_Y, MCP_Z))
        tip = V((tx, ty + 0.006, TIP_Z))
        total = sum(ph)
        a = ph[0] / total
        b = (ph[0] + ph[1]) / total
        J[f'{f}-finger-metacarpal'] = V((cx, CMC_Y, cz))
        J[f'{f}-finger-phalanx-proximal'] = mcp
        J[f'{f}-finger-phalanx-intermediate'] = mcp.lerp(tip, a)
        J[f'{f}-finger-phalanx-distal'] = mcp.lerp(tip, b)
        J[f'{f}-finger-tip'] = tip
    J['thumb-metacarpal'] = V((0.050, -0.040, -0.004))
    J['thumb-phalanx-proximal'] = V((0.077, -0.098, -0.012))
    J['thumb-phalanx-distal'] = V((0.086, -0.133, -0.022))
    J['thumb-tip'] = V((0.096, -0.166, -0.027))
    CUFF = V((0.005, 0.11, 0.007))
elif profile == 'cartoon':
    # Its mesh has fingers along +z, thumb towards +y, palm facing +x, about 6.8 units long. Measured in the turned frame
    # before scaling (units), from the centrelines of the fingers' vertices; the knuckles at the welding glove's phalanx
    # proportions along each finger's (slightly curled) centreline.
    TURN = Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0))).to_4x4()
    WRIST_U = V((0.50, -1.90, -1.00))
    SCALE = 0.05  # wrist to middle fingertip 4.8 units: 0.24 m, as the welding glove's
    PREP = Matrix.Scale(SCALE, 4) @ Matrix.Translation(-WRIST_U) @ TURN
    U = {
        'wrist': WRIST_U,
        'thumb-metacarpal': V((1.65, -2.00, -1.40)),
        'thumb-phalanx-proximal': V((2.47, -2.64, -1.47)),
        'thumb-phalanx-distal': V((3.09, -3.00, -1.80)),
        'thumb-tip': V((3.75, -3.62, -1.92)),
    }
    for f, (cmc, mcp, mid, dist, tip) in {
        'index': ((1.00, -2.30, -0.90), (1.45, -3.90, -0.55), (1.28, -5.00, -0.65), (1.30, -5.80, -0.98), (1.21, -6.35, -1.27)),
        'middle': ((0.45, -2.30, -0.90), (0.42, -4.10, -0.60), (0.25, -5.25, -0.80), (0.18, -6.00, -1.15), (0.08, -6.62, -1.60)),
        'ring': ((-0.05, -2.30, -0.95), (-0.52, -3.80, -0.75), (-0.62, -4.85, -1.12), (-0.82, -5.50, -1.55), (-0.93, -6.00, -1.95)),
        'pinky': ((-0.45, -2.25, -1.00), (-1.10, -3.45, -0.90), (-1.55, -4.21, -1.25), (-1.80, -4.65, -1.50), (-2.03, -5.05, -1.73)),
    }.items():
        for part, p in zip(PARTS, (cmc, mcp, mid, dist, tip)):
            U[f'{f}-finger-{part}'] = V(p)
    for k, p in U.items():
        J[k] = SCALE * (p - WRIST_U)
    CUFF = SCALE * (V((0.50, 0.00, -0.90)) - WRIST_U)
    fingers = {f: None for f in ('index', 'middle', 'ring', 'pinky')}
else:
    raise SystemExit(f'unknown profile {profile}')

THUMB = ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
ORDER = ['wrist'] + THUMB
for f in fingers:
    ORDER += [f'{f}-finger-{p}' for p in PARTS]
CHILD = {'wrist': 'middle-finger-metacarpal'}
for i in range(3):
    CHILD[THUMB[i]] = THUMB[i + 1]
for f in fingers:
    n = [f'{f}-finger-{p}' for p in PARTS]
    for i in range(4):
        CHILD[n[i]] = n[i + 1]

# Weighting segments: bone -> (a, b, chain). The wrist's runs up the cuff.
SEG = {'wrist': (CUFF, J['wrist'], 'palm')}
for f in fingers:
    n = [f'{f}-finger-{p}' for p in PARTS]
    SEG[n[0]] = (J[n[0]], J[n[1]], 'palm')
    for i in range(1, 4):
        SEG[n[i]] = (J[n[i]], J[n[i + 1]], f)
for i in range(3):
    SEG[THUMB[i]] = (J[THUMB[i]], J[THUMB[i + 1]], 'thumb')


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t)).length


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.context.view_layer.update()
# The model's mesh is its largest (a file may carry strays, such as a stray icosphere).
mesh = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
# Bake the import's parent transforms (and the profile's turn and scale) into the mesh, and drop everything else: the
# empties, other meshes, and any rig it came with.
mw = PREP @ mesh.matrix_world
mesh.parent = None
mesh.data.transform(mw)
if mw.determinant() < 0:
    mesh.data.flip_normals()
mesh.matrix_world = Matrix.Identity(4)
for m in list(mesh.modifiers):
    mesh.modifiers.remove(m)
mesh.vertex_groups.clear()
for o in list(bpy.context.scene.objects):
    if o is not mesh:
        bpy.data.objects.remove(o)
mesh.name = 'Glove'
# The glove is a right hand; the left is its mirror image (across x), skeleton and all.
if len(argv) > 4 and argv[4] == 'left':
    mesh.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    mesh.data.flip_normals()
    for k in J:
        J[k] = V((-J[k].x, J[k].y, J[k].z))
    for k, (a, b, ch) in list(SEG.items()):
        SEG[k] = (V((-a.x, a.y, a.z)), V((-b.x, b.y, b.z)), ch)

arm_data = bpy.data.armatures.new('HandRig')
arm = bpy.data.objects.new('HandRig', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for name in ORDER:
    eb = arm_data.edit_bones.new(name)
    eb.head = J[name]
    if name in CHILD:
        eb.tail = J[CHILD[name]]
    else:  # a tip: continue its finger a little
        parent = [k for k, c in CHILD.items() if c == name][0]
        eb.tail = J[name] + (J[name] - J[parent]).normalized() * 0.01
    eb.use_deform = True
bpy.ops.object.mode_set(mode='OBJECT')

# Weights: the nearest bone picks the chain (a finger, the thumb or the palm); the vertex blends only within it.
groups = {n: mesh.vertex_groups.new(name=n) for n in ORDER}
W = []  # per vertex: {bone: weight}
for v in mesh.data.vertices:
    p = v.co
    d = {n: seg_dist(p, a, b) for n, (a, b, ch) in SEG.items()}
    best = min(d, key=d.get)
    chain = SEG[best][2]
    if chain == 'palm':
        cand = [n for n in SEG if SEG[n][2] == 'palm']
    elif chain == 'thumb':
        cand = [n for n in SEG if SEG[n][2] == 'thumb'] + ['wrist']
    else:
        cand = [n for n in SEG if SEG[n][2] == chain] + [f'{chain}-finger-metacarpal']
    ws = sorted(((1.0 / (d[n] + 0.002) ** 5, n) for n in cand), reverse=True)[:3]
    tot = sum(w for w, _ in ws)
    W.append({n: w / tot for w, n in ws})

# The import splits the mesh at texture seams: vertices at one position are welded for smoothing and share weights.
key = {}
weld = []
for v in mesh.data.vertices:
    k = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
    weld.append(key.setdefault(k, len(key)))
nbr = [set() for _ in range(len(key))]
for e in mesh.data.edges:
    a, b = weld[e.vertices[0]], weld[e.vertices[1]]
    if a != b:
        nbr[a].add(b)
        nbr[b].add(a)
GW = [dict() for _ in range(len(key))]
cnt = [0] * len(key)
for i, w in enumerate(W):
    g = weld[i]
    cnt[g] += 1
    for n, x in w.items():
        GW[g][n] = GW[g].get(n, 0.0) + x
for g in range(len(key)):
    GW[g] = {n: x / cnt[g] for n, x in GW[g].items()}
# Smooth along the surface's edges (never across the gaps between fingers), softening the knuckles and the thumb's seam.
for _ in range(SMOOTH_PASSES):
    nxt = []
    for g in range(len(key)):
        acc = {n: 0.5 * x for n, x in GW[g].items()}
        if nbr[g]:
            share = 0.5 / len(nbr[g])
            for h in nbr[g]:
                for n, x in GW[h].items():
                    acc[n] = acc.get(n, 0.0) + share * x
        else:
            acc = {n: 2 * x for n, x in acc.items()}
        top = sorted(acc.items(), key=lambda t: -t[1])[:4]
        tot = sum(x for _, x in top)
        nxt.append({n: x / tot for n, x in top if x / tot > 0.01})
    GW = nxt
for i in range(len(W)):
    for n, x in GW[weld[i]].items():
        groups[n].add([i], x, 'REPLACE')
mesh.parent = arm
mod = mesh.modifiers.new('Armature', 'ARMATURE')
mod.object = arm


def pose(curl):
    """curl: bone -> (axis, degrees). Moves each chain by forward kinematics over the flat bones."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    chains = [THUMB] + [[f'{f}-finger-{p}' for p in PARTS[1:]] for f in fingers]
    for ch in chains:
        q = Quaternion()
        head = J[ch[0]].copy()
        for i, name in enumerate(ch):
            if name in curl:
                axis, deg = curl[name]
                q = Quaternion(axis, math.radians(deg)) @ q
            rest = arm.data.bones[name].matrix_local
            arm.pose.bones[name].matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ rest.to_3x3().to_4x4()
            bpy.context.view_layer.update()
            if i + 1 < len(ch):
                head = head + q @ (J[ch[i + 1]] - J[name])
    bpy.ops.object.mode_set(mode='OBJECT')


X = V((1, 0, 0))
ta = (J['thumb-tip'] - J['thumb-metacarpal']).normalized().cross(V((0, 0, -1))).normalized()
FIST = {}
for f in fingers:
    FIST[f'{f}-finger-phalanx-proximal'] = (X, 75)
    FIST[f'{f}-finger-phalanx-intermediate'] = (X, 95)
    FIST[f'{f}-finger-phalanx-distal'] = (X, 55)
FIST['thumb-metacarpal'] = (ta, 25)
FIST['thumb-phalanx-proximal'] = (ta, 35)
FIST['thumb-phalanx-distal'] = (ta, 30)
GRIP = {
    'index-finger-phalanx-proximal': (X, 35),
    'index-finger-phalanx-intermediate': (X, 35),
    'index-finger-phalanx-distal': (X, 20),
    'thumb-metacarpal': (ta, 30),
    'thumb-phalanx-proximal': (ta, 20),
    'thumb-phalanx-distal': (ta, 10),
}
for f in ('middle', 'ring', 'pinky'):
    GRIP[f'{f}-finger-phalanx-proximal'] = (X, 60)
    GRIP[f'{f}-finger-phalanx-intermediate'] = (X, 80)
    GRIP[f'{f}-finger-phalanx-distal'] = (X, 45)


def render(tag):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 420
    scene.render.resolution_y = 420
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    cam = scene.camera
    if cam is None:
        cd = bpy.data.cameras.new('cam')
        cd.type = 'ORTHO'
        cd.ortho_scale = 0.4
        cam = bpy.data.objects.new('cam', cd)
        scene.collection.objects.link(cam)
        scene.camera = cam
    c = V((0.015, -0.11, 0.0))
    for name, d, up in (('top', V((0, 0, 1)), 'Y'), ('side', V((1, 0, 0)), 'Z'), ('persp', V((0.7, -0.5, 0.6)).normalized(), 'Z')):
        cam.location = c + d * 0.5
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', up).to_euler()
        scene.render.filepath = f'{outdir}/{tag}-{name}.png'
        bpy.ops.render.render(write_still=True)


if mode == 'test':
    render('rest')
    pose(FIST)
    render('fist')
    pose(GRIP)
    render('grip')
    pose({})
    bpy.ops.wm.save_as_mainfile(filepath=f'{outdir}/glove-rig.blend')
else:
    pose({})
    for img in bpy.data.images:
        if img.size[0] > 512:
            img.scale(512, 512)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=argv[3], export_format='GLB', use_selection=True, export_skins=True,
                              export_animations=False, export_image_format='WEBP', export_image_quality=80,
                              export_yup=True, export_apply=False)
    print('EXPORTED', argv[3])
