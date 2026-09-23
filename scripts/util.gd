class_name U
extends RefCounted

static func mat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m

static func vmat(rough := 0.8) -> StandardMaterial3D:
	# albedo comes from per-instance MultiMesh colour
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = true
	m.roughness = rough
	return m

static func emissive(c: Color, e := 2.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = e
	return m

static func unshaded(c: Color, transparent := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = c
	if transparent:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

## Merge primitive meshes into one ArrayMesh. parts: Array of [PrimitiveMesh, Transform3D, material_index]
static func merge(parts: Array, mats: Array) -> ArrayMesh:
	var am := ArrayMesh.new()
	for mi in mats.size():
		var st := SurfaceTool.new()
		var any := false
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for p in parts:
			if p[2] == mi:
				st.append_from(p[0], 0, p[1])
				any = true
		if any:
			st.commit(am)
			am.surface_set_material(am.get_surface_count() - 1, mats[mi])
	return am

static func box(sz: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = sz
	return b

static func cyl(r: float, h: float, seg := 10, r2 := -1.0) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = r if r2 < 0.0 else r2
	c.bottom_radius = r
	c.height = h
	c.radial_segments = seg
	c.rings = 1
	return c

static func sph(r: float, seg := 10, rings := 6) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = seg
	s.rings = rings
	return s

static func caps(r: float, h: float) -> CapsuleMesh:
	var c := CapsuleMesh.new()
	c.radius = r
	c.height = h
	c.radial_segments = 10
	c.rings = 3
	return c

static func mm(mesh: Mesh, count: int, colors := true, custom := false) -> MultiMeshInstance3D:
	var m := MultiMesh.new()
	m.transform_format = MultiMesh.TRANSFORM_3D
	m.use_colors = colors
	m.use_custom_data = custom
	m.mesh = mesh
	m.instance_count = count
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = m
	return inst

static func xf(pos: Vector3, scl := Vector3.ONE, yaw := 0.0) -> Transform3D:
	var b := Basis(Vector3.UP, yaw) * Basis.from_scale(scl)
	return Transform3D(b, pos)
