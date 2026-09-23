class_name Traffic
extends Node3D
## Instanced cars, vans and pedestrians moving along the street grid.

var city: City
var cars: Array = []   # {lane, dir, off, s, v, kind, idx, stopped}
var peds: Array = []
var car_mm: MultiMeshInstance3D
var van_mm: MultiMeshInstance3D
var ped_mm: MultiMeshInstance3D
var rng := RandomNumberGenerator.new()
var t := 0.0

func build(c: City, n_cars := 150, n_peds := 220) -> void:
	city = c
	rng.seed = 77
	var lanes := city.lanes()
	var body := U.vmat(0.35)
	body.metallic = 0.3
	var glass := U.mat(Color(0.08, 0.1, 0.13), 0.1, 0.5)
	var tyre := U.mat(Color(0.05, 0.05, 0.05), 0.9)
	var lights := U.emissive(Color(1.0, 0.9, 0.7), 0.6)
	var parts := [
		[U.box(Vector3(1.9, 0.75, 4.4)), Transform3D(Basis(), Vector3(0, 0.62, 0)), 0],
		[U.box(Vector3(1.7, 0.6, 2.3)), Transform3D(Basis(), Vector3(0, 1.28, 0.2)), 1],
		[U.box(Vector3(1.6, 0.14, 0.05)), Transform3D(Basis(), Vector3(0, 0.75, -2.21)), 3]]
	for wx in [-0.88, 0.88]:
		for wz in [-1.35, 1.35]:
			parts.append([U.cyl(0.34, 0.26, 10), Transform3D(Basis(Vector3.FORWARD, PI / 2), Vector3(wx, 0.34, wz)), 2])
	var car_mesh := U.merge(parts, [body, glass, tyre, lights])
	var vparts := [
		[U.box(Vector3(2.1, 2.1, 5.4)), Transform3D(Basis(), Vector3(0, 1.35, 0.2)), 0],
		[U.box(Vector3(1.95, 0.8, 0.05)), Transform3D(Basis(), Vector3(0, 1.75, -2.52)), 1]]
	for wx in [-0.95, 0.95]:
		for wz in [-1.7, 1.8]:
			vparts.append([U.cyl(0.38, 0.28, 10), Transform3D(Basis(Vector3.FORWARD, PI / 2), Vector3(wx, 0.38, wz)), 2])
	var van_mesh := U.merge(vparts, [body, glass, tyre])
	var palette := [Color(0.95, 0.75, 0.1), Color(0.95, 0.75, 0.1), Color(0.95, 0.75, 0.1),
		Color(0.85, 0.85, 0.87), Color(0.1, 0.1, 0.12), Color(0.55, 0.08, 0.08), Color(0.2, 0.3, 0.5),
		Color(0.5, 0.52, 0.55), Color(0.9, 0.9, 0.92)]
	var nv := 0
	for n in n_cars:
		var lane: Array = lanes[n % lanes.size()]
		var dir := 1.0 if (n / lanes.size()) % 2 == 0 else -1.0
		var kind := 1 if rng.randf() < 0.18 else 0
		var e := {"lane": lane, "dir": dir, "off": 3.5 * dir, "s": rng.randf_range(-city.H, city.H),
			"v": rng.randf_range(9.0, 14.0), "kind": kind, "idx": 0, "stopped": false,
			"col": palette[rng.randi() % palette.size()] if kind == 0 else Color(0.92, 0.92, 0.9)}
		cars.append(e)
		if kind == 1:
			nv += 1
	car_mm = U.mm(car_mesh, n_cars - nv, true)
	van_mm = U.mm(van_mesh, nv, true)
	var ci := 0
	var vi := 0
	for e in cars:
		if e.kind == 0:
			e.idx = ci
			car_mm.multimesh.set_instance_color(ci, e.col)
			ci += 1
		else:
			e.idx = vi
			van_mm.multimesh.set_instance_color(vi, e.col)
			vi += 1
	add_child(car_mm)
	add_child(van_mm)
	# pedestrians: capsule body (instance colour) + head
	var cloth := U.vmat(0.9)
	var skin := U.mat(Color(0.72, 0.55, 0.42), 0.8)
	var ped_mesh := U.merge([
		[U.caps(0.22, 1.35), Transform3D(Basis(), Vector3(0, 0.72, 0)), 0],
		[U.sph(0.13, 8, 5), Transform3D(Basis(), Vector3(0, 1.55, 0)), 1]], [cloth, skin])
	ped_mm = U.mm(ped_mesh, n_peds, true)
	var cloth_cols := [Color(0.15, 0.18, 0.25), Color(0.5, 0.2, 0.15), Color(0.8, 0.78, 0.7), Color(0.25, 0.35, 0.3),
		Color(0.1, 0.1, 0.1), Color(0.6, 0.45, 0.25), Color(0.3, 0.3, 0.55)]
	for n in n_peds:
		var lane: Array = lanes[rng.randi() % lanes.size()]
		var side := 1.0 if rng.randf() < 0.5 else -1.0
		var p := {"lane": lane, "off": side * rng.randf_range(8.2, 9.4), "s": rng.randf_range(-city.H, city.H),
			"v": rng.randf_range(1.0, 1.7) * (1.0 if rng.randf() < 0.5 else -1.0), "ph": rng.randf() * TAU}
		peds.append(p)
		ped_mm.multimesh.set_instance_color(n, cloth_cols[rng.randi() % cloth_cols.size()].lightened(rng.randf_range(-0.1, 0.15)))
	add_child(ped_mm)
	ped_mm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func lane_pos(lane: Array, s: float, off: float) -> Vector3:
	if lane[0] == 0:
		return Vector3(s, 0.0, lane[1] + off)
	return Vector3(lane[1] - off, 0.0, s)

func car_pos(i: int) -> Vector3:
	var e: Dictionary = cars[i]
	return lane_pos(e.lane, e.s, e.off)

func _process(dt: float) -> void:
	t += dt
	var span := city.H * 2.0
	for e in cars:
		if not e.stopped:
			e.s += e.v * e.dir * dt
			if e.s > city.H:
				e.s -= span
			elif e.s < -city.H:
				e.s += span
		var pos := lane_pos(e.lane, e.s, e.off)
		var fwd := Vector3(e.dir, 0, 0) if e.lane[0] == 0 else Vector3(0, 0, e.dir)
		var b := Basis.looking_at(fwd, Vector3.UP)
		var xf := Transform3D(b, pos)
		if e.kind == 0:
			car_mm.multimesh.set_instance_transform(e.idx, xf)
		else:
			van_mm.multimesh.set_instance_transform(e.idx, xf)
	for n in peds.size():
		var p: Dictionary = peds[n]
		p.s += p.v * dt
		if p.s > city.H:
			p.s -= span
		elif p.s < -city.H:
			p.s += span
		var pos := lane_pos(p.lane, p.s, p.off)
		if city.park_rect.grow(2).has_point(Vector2(pos.x, pos.z)):
			pos.y = 0.3
		else:
			pos.y = 0.2
		pos.y += abs(sin(t * 6.0 + p.ph)) * 0.06
		var dir: float = sign(p.v)
		var fwd := Vector3(dir, 0, 0) if p.lane[0] == 0 else Vector3(0, 0, dir)
		ped_mm.multimesh.set_instance_transform(n, Transform3D(Basis.looking_at(fwd, Vector3.UP), pos))
