class_name City
extends Node3D
## Procedural grid city: blocks, towers, sidewalks, park, trees, props, districts, relay beacons.

const N := 9
const P := 80.0
const S := 20.0
const BLOCK := 60.0
const MAP_LAYER := 1 << 19

var H := N * P * 0.5
var rng := RandomNumberGenerator.new()
var park_rect := Rect2()
var park_block := Vector2i(6, 2)  # block i, j (and j+1)
var no_traffic_z_line := 3        # street inside the park
var buildings: Array = []         # {rect: Rect2, h: float}
var beacons: Array = []           # {pos: Vector3, district: int, node: Node3D, map: Node3D}
var district_fog: Array = []
const DISTRICTS := ["ASHFORD", "MERIDIAN", "LOWBRIDGE", "KILN YARDS"]
const DISTRICT_TAG := ["Old stone quarter", "Glass downtown", "Brick lowrise", "Warehouse yards"]

var body: StaticBody3D

static func district_of(p: Vector3) -> int:
	# 0 = NW (x<0,z<0) 1 = NE 2 = SW 3 = SE
	return (1 if p.x >= 0.0 else 0) + (2 if p.z >= 0.0 else 0)

func line(k: int) -> float:
	return -H + k * P

func block_rect(i: int, j: int) -> Rect2:
	return Rect2(Vector2(line(i) + S * 0.5, line(j) + S * 0.5), Vector2(BLOCK, BLOCK))

func build() -> void:
	rng.seed = 20260923
	body = StaticBody3D.new()
	body.collision_layer = 1
	add_child(body)
	var pr := block_rect(park_block.x, park_block.y)
	park_rect = pr.merge(block_rect(park_block.x, park_block.y + 1))
	_ground()
	_blocks()
	_park()
	_street_trees_and_props()
	_skyline()
	_beacons()
	_map()

func _col_box(center: Vector3, size: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = size
	cs.shape = b
	cs.position = center
	body.add_child(cs)

func _ground() -> void:
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(3000, 3000)
	g.mesh = pm
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/ground.gdshader")
	sm.set_shader_parameter("pitch", P)
	sm.set_shader_parameter("half_extent", H)
	g.material_override = sm
	add_child(g)
	_col_box(Vector3(0, -0.5, 0), Vector3(3000, 1, 3000))

func _is_park(i: int, j: int) -> bool:
	return i == park_block.x and (j == park_block.y or j == park_block.y + 1)

func _blocks() -> void:
	var specs: Array = []  # [pos(base centre), size, style, color]
	var slabs: Array = []
	var roof_props: Array = []
	var palette := [
		Color(0.52, 0.24, 0.18), Color(0.78, 0.74, 0.64), Color(0.58, 0.6, 0.62),
		Color(0.3, 0.4, 0.46), Color(0.4, 0.28, 0.22)]
	for i in N:
		for j in N:
			if _is_park(i, j):
				continue
			var r := block_rect(i, j)
			slabs.append(r)
			var c := r.get_center()
			var d := district_of(Vector3(c.x, 0, c.y))
			var centre: float = 1.0 - clamp(c.length() / (H * 1.1), 0.0, 1.0)
			var lots: Array = []
			var mode := rng.randi_range(0, 3)
			if d == 1 and rng.randf() < 0.45:
				mode = 0
			match mode:
				0:
					lots.append(r.grow(-rng.randf_range(1.0, 5.0)))
				1:
					lots.append(Rect2(r.position, Vector2(r.size.x * 0.5, r.size.y)))
					lots.append(Rect2(r.position + Vector2(r.size.x * 0.5, 0), Vector2(r.size.x * 0.5, r.size.y)))
				2:
					lots.append(Rect2(r.position, Vector2(r.size.x, r.size.y * 0.5)))
					lots.append(Rect2(r.position + Vector2(0, r.size.y * 0.5), Vector2(r.size.x, r.size.y * 0.5)))
				_:
					for a in 2:
						for b in 2:
							lots.append(Rect2(r.position + Vector2(a, b) * r.size * 0.5, r.size * 0.5))
			for lot in lots:
				var l: Rect2 = lot.grow(-rng.randf_range(0.2, 1.4))
				var h: float
				var style: int
				match d:
					0:
						h = rng.randf_range(24, 70) * (0.7 + centre)
						style = [1, 1, 2, 0][rng.randi() % 4]
					1:
						h = rng.randf_range(45, 120) * (0.6 + centre)
						style = [3, 3, 2, 1][rng.randi() % 4]
					2:
						h = rng.randf_range(12, 30)
						style = [0, 0, 4, 1][rng.randi() % 4]
					_:
						h = rng.randf_range(18, 55) * (0.7 + centre * 0.6)
						style = [0, 4, 2, 2][rng.randi() % 4]
				h = snappedf(clamp(h, 12.0, 160.0), 3.6)
				var col: Color = palette[style]
				col = col.lightened(rng.randf_range(-0.08, 0.08))
				specs.append([Vector3(l.get_center().x, 0, l.get_center().y), Vector3(l.size.x, h, l.size.y), style, col])
				buildings.append({"rect": l, "h": h, "district": d})
				# setback crown on tall towers
				if h > 60 and rng.randf() < 0.6:
					var cs := Vector3(l.size.x * rng.randf_range(0.5, 0.75), rng.randf_range(8, 24), l.size.y * rng.randf_range(0.5, 0.75))
					specs.append([Vector3(l.get_center().x, h, l.get_center().y), cs, style, col.darkened(0.05)])
					buildings.append({"rect": Rect2(l.get_center() - Vector2(cs.x, cs.z) * 0.5, Vector2(cs.x, cs.z)), "h": h + cs.y, "district": d})
				else:
					roof_props.append([l, h, style])
	# building multimesh
	var box := U.box(Vector3.ONE)
	var inst := U.mm(box, specs.size(), true, true)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/building.gdshader")
	inst.material_override = sm
	for n in specs.size():
		var s: Array = specs[n]
		var pos: Vector3 = s[0]
		var sz: Vector3 = s[1]
		inst.multimesh.set_instance_transform(n, U.xf(pos + Vector3(0, sz.y * 0.5, 0), sz))
		inst.multimesh.set_instance_color(n, s[3])
		inst.multimesh.set_instance_custom_data(n, Color(float(s[2]) / 4.0, rng.randf(), (pos.y + sz.y) / 200.0, 0))
		_col_box(pos + Vector3(0, sz.y * 0.5, 0), sz)
	add_child(inst)
	# sidewalks
	var slab := U.mm(U.box(Vector3.ONE), slabs.size(), false)
	slab.material_override = U.mat(Color(0.6, 0.6, 0.58), 0.9)
	for n in slabs.size():
		var r: Rect2 = slabs[n]
		var c := r.get_center()
		slab.multimesh.set_instance_transform(n, U.xf(Vector3(c.x, 0.1, c.y), Vector3(r.size.x + 6, 0.2, r.size.y + 6)))
		_col_box(Vector3(c.x, 0.1, c.y), Vector3(r.size.x + 6, 0.2, r.size.y + 6))
	add_child(slab)
	_roof_props(roof_props)

func _roof_props(list: Array) -> void:
	var towers: Array = []
	var acs: Array = []
	for e in list:
		var l: Rect2 = e[0]
		var h: float = e[1]
		if (e[2] == 0 or e[2] == 4) and rng.randf() < 0.55:
			var p := l.position + Vector2(rng.randf_range(3, l.size.x - 3), rng.randf_range(3, l.size.y - 3))
			towers.append(Vector3(p.x, h, p.y))
		for k in rng.randi_range(0, 3):
			var p := l.position + Vector2(rng.randf_range(2, l.size.x - 2), rng.randf_range(2, l.size.y - 2))
			acs.append(Vector3(p.x, h, p.y))
	# water tower: tank + conical cap + legs
	var wood := U.mat(Color(0.42, 0.3, 0.2), 0.9)
	var steel := U.mat(Color(0.25, 0.25, 0.27), 0.6, 0.4)
	var parts := [
		[U.cyl(1.6, 3.0, 12), Transform3D(Basis(), Vector3(0, 3.5, 0)), 0],
		[U.cyl(1.7, 1.2, 12, 0.05), Transform3D(Basis(), Vector3(0, 5.6, 0)), 1]]
	for a in 4:
		var ang := a * PI * 0.5 + 0.78
		parts.append([U.cyl(0.08, 2.0, 5), Transform3D(Basis(), Vector3(cos(ang) * 1.2, 1.0, sin(ang) * 1.2)), 1])
	var tm := U.merge(parts, [wood, steel])
	var ti := U.mm(tm, towers.size(), false)
	for n in towers.size():
		ti.multimesh.set_instance_transform(n, U.xf(towers[n]))
	add_child(ti)
	var ai := U.mm(U.box(Vector3(2.4, 1.4, 1.6)), acs.size(), false)
	ai.material_override = U.mat(Color(0.7, 0.71, 0.72), 0.5, 0.3)
	for n in acs.size():
		ai.multimesh.set_instance_transform(n, U.xf(acs[n] + Vector3(0, 0.7, 0), Vector3.ONE, rng.randf() * PI))
	add_child(ai)

func _park() -> void:
	var r := park_rect.grow(3.0)
	var grass := MeshInstance3D.new()
	grass.mesh = U.box(Vector3(r.size.x, 0.3, r.size.y))
	grass.position = Vector3(r.get_center().x, 0.15, r.get_center().y)
	grass.material_override = U.mat(Color(0.33, 0.48, 0.2), 1.0)
	add_child(grass)
	_col_box(grass.position, Vector3(r.size.x, 0.3, r.size.y))
	# walking paths
	var path_mat := U.mat(Color(0.52, 0.5, 0.46), 0.95)
	var c := r.get_center()
	for k in 3:
		var p := MeshInstance3D.new()
		p.mesh = U.box(Vector3(3.5, 0.05, r.size.y - 4))
		p.position = Vector3(c.x - 18 + k * 18, 0.31, c.y)
		p.material_override = path_mat
		add_child(p)
	for k in 4:
		var p := MeshInstance3D.new()
		p.mesh = U.box(Vector3(r.size.x - 4, 0.05, 3.5))
		p.position = Vector3(c.x, 0.31, c.y - 54 + k * 36)
		p.material_override = path_mat
		add_child(p)
	# pond
	var pond := MeshInstance3D.new()
	pond.mesh = U.cyl(9, 0.1, 24)
	pond.position = Vector3(c.x + 9, 0.33, c.y + 20)
	pond.material_override = U.mat(Color(0.2, 0.36, 0.45), 0.1, 0.2)
	add_child(pond)
	# trees and benches
	var pts: Array = []
	for n in 90:
		var p := Vector2(rng.randf_range(r.position.x + 3, r.end.x - 3), rng.randf_range(r.position.y + 3, r.end.y - 3))
		if abs(fmod(p.x - (c.x - 18) + 100.0, 18.0)) < 2.5:
			continue
		if p.distance_to(Vector2(c.x + 9, c.y + 20)) < 11:
			continue
		pts.append(Vector3(p.x, 0.3, p.y))
	_trees(pts, 1.25)
	var benches: Array = []
	for n in 16:
		benches.append(Vector3(c.x - 18 + (n % 3) * 18 + 2.6, 0.3, c.y - 66 + n * 8.4))
	var wood := U.mat(Color(0.45, 0.3, 0.18), 0.9)
	var iron := U.mat(Color(0.12, 0.13, 0.12), 0.5, 0.5)
	var bm := U.merge([
		[U.box(Vector3(0.5, 0.08, 1.8)), Transform3D(Basis(), Vector3(0, 0.45, 0)), 0],
		[U.box(Vector3(0.08, 0.45, 1.8)), Transform3D(Basis(), Vector3(-0.25, 0.75, 0)), 0],
		[U.box(Vector3(0.5, 0.45, 0.08)), Transform3D(Basis(), Vector3(0, 0.22, 0.8)), 1],
		[U.box(Vector3(0.5, 0.45, 0.08)), Transform3D(Basis(), Vector3(0, 0.22, -0.8)), 1]], [wood, iron])
	var bi := U.mm(bm, benches.size(), false)
	for n in benches.size():
		bi.multimesh.set_instance_transform(n, U.xf(benches[n]))
	add_child(bi)

var _tree_palette := [Color(0.88, 0.47, 0.1), Color(0.92, 0.72, 0.16), Color(0.72, 0.22, 0.08),
	Color(0.46, 0.56, 0.16), Color(0.95, 0.58, 0.14), Color(0.8, 0.35, 0.1), Color(0.35, 0.5, 0.18)]

func _trees(points: Array, scale_mul := 1.0) -> void:
	var trunks := U.mm(U.cyl(0.2, 1.0, 6, 0.14), points.size(), false)
	trunks.material_override = U.mat(Color(0.28, 0.2, 0.14), 0.95)
	var blobs: Array = []
	for n in points.size():
		var p: Vector3 = points[n]
		var s := rng.randf_range(0.85, 1.2) * scale_mul
		trunks.multimesh.set_instance_transform(n, U.xf(p + Vector3(0, 1.8 * s, 0), Vector3(s, 3.6 * s, s)))
		var col: Color = _tree_palette[rng.randi() % _tree_palette.size()]
		for k in 4:
			var o := Vector3(rng.randf_range(-1.1, 1.1), rng.randf_range(3.6, 5.6), rng.randf_range(-1.1, 1.1)) * s
			blobs.append([p + o, rng.randf_range(1.3, 2.1) * s, col.lightened(rng.randf_range(-0.12, 0.1))])
	add_child(trunks)
	var fi := U.mm(U.sph(1.0, 8, 5), blobs.size(), true)
	fi.material_override = U.vmat(0.95)
	for n in blobs.size():
		var b: Array = blobs[n]
		fi.multimesh.set_instance_transform(n, U.xf(b[0], Vector3.ONE * b[1], rng.randf() * TAU))
		fi.multimesh.set_instance_color(n, b[2])
	add_child(fi)

func _street_trees_and_props() -> void:
	var pts: Array = []
	var lamps: Array = []
	for k in range(0, N + 1):
		for side in [-1.0, 1.0]:
			var off: float = line(k) + side * 8.6
			var t := -H + 14.0
			while t < H - 10:
				var fx := fmod(t + H, P)
				var near_x: bool = min(fx, P - fx) < 12.0
				if not near_x:
					var a := Vector3(off, 0.2, t)
					var b := Vector3(t, 0.2, off)
					if rng.randf() < 0.5 and not park_rect.grow(4).has_point(Vector2(a.x, a.z)):
						pts.append(a)
					if rng.randf() < 0.5 and not park_rect.grow(4).has_point(Vector2(b.x, b.z)):
						pts.append(b)
				t += 11.0
	_trees(pts, 0.8)
	# traffic signal poles at intersection corners
	for i in range(1, N):
		for j in range(1, N):
			lamps.append(Vector3(line(i) + 9.2, 0.2, line(j) + 9.2))
			lamps.append(Vector3(line(i) - 9.2, 0.2, line(j) - 9.2))
	var dark := U.mat(Color(0.15, 0.16, 0.17), 0.5, 0.5)
	var amber := U.mat(Color(0.85, 0.62, 0.1), 0.6)
	var pole := U.merge([
		[U.cyl(0.12, 6.0, 6), Transform3D(Basis(), Vector3(0, 3.0, 0)), 0],
		[U.box(Vector3(0.12, 0.12, 5.5)), Transform3D(Basis(), Vector3(0, 5.8, -2.7)), 0],
		[U.box(Vector3(0.4, 1.1, 0.35)), Transform3D(Basis(), Vector3(0, 5.2, -4.8)), 1]], [dark, amber])
	var li := U.mm(pole, lamps.size(), false)
	for n in lamps.size():
		li.multimesh.set_instance_transform(n, U.xf(lamps[n], Vector3.ONE, 0.0 if n % 2 == 0 else PI))
	add_child(li)

func _skyline() -> void:
	# far silhouettes outside the playable grid (no collision)
	var list: Array = []
	for n in 140:
		var ang := rng.randf() * TAU
		var dist := rng.randf_range(H + 90, H + 520)
		var p := Vector2(cos(ang), sin(ang)) * dist
		p.x = clamp(p.x, -H - 600, H + 600)
		list.append([Vector3(p.x, 0, p.y), Vector3(rng.randf_range(20, 45), rng.randf_range(30, 170), rng.randf_range(20, 45))])
	var inst := U.mm(U.box(Vector3.ONE), list.size(), true, true)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/building.gdshader")
	inst.material_override = sm
	for n in list.size():
		var sz: Vector3 = list[n][1]
		inst.multimesh.set_instance_transform(n, U.xf(list[n][0] + Vector3(0, sz.y * 0.5, 0), sz))
		inst.multimesh.set_instance_color(n, Color(0.55, 0.62, 0.68))
		inst.multimesh.set_instance_custom_data(n, Color(0.75, rng.randf(), sz.y / 200.0, 0))
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(inst)

func _beacons() -> void:
	var picks := [null, null, null, null]
	var order := buildings.duplicate()
	order.shuffle()
	for b in order:
		var d: int = b["district"]
		var h: float = b["h"]
		if picks[d] == null and h > 26 and h < 75:
			picks[d] = b
	var core := U.emissive(Color(1.0, 0.62, 0.15), 3.0)
	var beam := U.unshaded(Color(1.0, 0.7, 0.25, 0.28), true)
	for d in 4:
		var b = picks[d]
		if b == null:
			continue
		var r: Rect2 = b["rect"]
		var top := Vector3(r.get_center().x, b["h"], r.get_center().y)
		var node := Node3D.new()
		node.position = top
		var mast := MeshInstance3D.new()
		mast.mesh = U.cyl(0.35, 4.0, 8, 0.2)
		mast.position.y = 2.0
		mast.material_override = core
		node.add_child(mast)
		var ray := MeshInstance3D.new()
		ray.mesh = U.cyl(0.8, 120.0, 8)
		ray.position.y = 64.0
		ray.material_override = beam
		ray.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		ray.name = "Beam"
		node.add_child(ray)
		add_child(node)
		var mk := MeshInstance3D.new()
		mk.mesh = U.cyl(6.0, 1.0, 4)
		mk.material_override = U.unshaded(Color(1.0, 0.66, 0.2))
		mk.layers = MAP_LAYER
		mk.position = Vector3(top.x, -95, top.z)
		add_child(mk)
		beacons.append({"pos": top, "district": d, "node": node, "map": mk})

func _map() -> void:
	# flat minimap layer, only seen by the minimap camera
	var base := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(3000, 3000)
	base.mesh = pm
	base.material_override = U.unshaded(Color(0.12, 0.16, 0.22))
	base.layers = MAP_LAYER
	base.position.y = -100
	add_child(base)
	var roads := MeshInstance3D.new()
	var rp := PlaneMesh.new()
	rp.size = Vector2(N * P + S, N * P + S)
	roads.mesh = rp
	roads.material_override = U.unshaded(Color(0.86, 0.92, 0.95))
	roads.layers = MAP_LAYER
	roads.position.y = -99.5
	add_child(roads)
	var blocks := U.mm(U.box(Vector3.ONE), N * N, true)
	blocks.material_override = U.vmat(1.0)
	blocks.material_override.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	blocks.layers = MAP_LAYER
	var n := 0
	for i in N:
		for j in N:
			var r := block_rect(i, j)
			var col := Color(0.23, 0.42, 0.62)
			if _is_park(i, j):
				r = park_rect if j == park_block.y else Rect2()
				col = Color(0.3, 0.6, 0.32)
			var c := r.get_center()
			blocks.multimesh.set_instance_transform(n, U.xf(Vector3(c.x, -99, c.y), Vector3(max(r.size.x, 0.01), 0.1, max(r.size.y, 0.01))))
			blocks.multimesh.set_instance_color(n, col)
			n += 1
	add_child(blocks)
	for d in 4:
		var fog := MeshInstance3D.new()
		fog.mesh = U.box(Vector3(H + 12, 0.1, H + 12))
		fog.material_override = U.unshaded(Color(0.05, 0.07, 0.1, 0.45), true)
		fog.layers = MAP_LAYER
		var sx := 1.0 if d % 2 == 1 else -1.0
		var sz := 1.0 if d >= 2 else -1.0
		fog.position = Vector3(sx * (H + 12) * 0.5, -97, sz * (H + 12) * 0.5)
		add_child(fog)
		district_fog.append(fog)

## Street lanes used by traffic and pedestrians: [axis (0 = along x, 1 = along z), fixed coordinate]
func lanes() -> Array:
	var out: Array = []
	for k in range(1, N):
		out.append([1, line(k)])
		if k != no_traffic_z_line:
			out.append([0, line(k)])
	return out
