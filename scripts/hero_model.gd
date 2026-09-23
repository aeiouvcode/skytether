class_name HeroModel
extends Node3D
## Procedural articulated hero ("Rook"): graphite suit, teal panels, amber chevron and visor.
## Faces -Z. Poses are driven by state each frame.

var hips: Node3D
var torso: Node3D
var head: Node3D
var sh := [null, null]   # shoulder pivots L, R
var el := [null, null]   # elbow pivots
var th := [null, null]   # thigh pivots
var kn := [null, null]   # knee pivots
var phase := 0.0
var tgt := {}

var m_dark := U.mat(Color(0.08, 0.09, 0.11), 0.45, 0.2)
var m_teal := U.mat(Color(0.04, 0.5, 0.52), 0.35, 0.3)
var m_amber := U.emissive(Color(1.0, 0.6, 0.12), 1.2)
var m_visor := U.emissive(Color(1.0, 0.72, 0.3), 2.5)

func _part(parent: Node3D, mesh: Mesh, m: Material, pos: Vector3, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi

func _pivot(parent: Node3D, pos: Vector3) -> Node3D:
	var n := Node3D.new()
	n.position = pos
	parent.add_child(n)
	return n

func _ready() -> void:
	hips = _pivot(self, Vector3(0, 0.98, 0))
	_part(hips, U.caps(0.16, 0.4), m_dark, Vector3(0, 0.02, 0), Vector3(0, 0, PI / 2))
	_part(hips, U.box(Vector3(0.36, 0.06, 0.24)), m_amber, Vector3(0, 0.12, 0))
	torso = _pivot(hips, Vector3(0, 0.12, 0))
	_part(torso, U.caps(0.17, 0.62), m_dark, Vector3(0, 0.28, 0))
	_part(torso, U.box(Vector3(0.36, 0.3, 0.22)), m_dark, Vector3(0, 0.42, 0))
	_part(torso, U.box(Vector3(0.3, 0.26, 0.05)), m_teal, Vector3(0, 0.42, -0.11))
	# chevron emblem
	_part(torso, U.box(Vector3(0.05, 0.16, 0.02)), m_amber, Vector3(-0.045, 0.43, -0.14), Vector3(0, 0, 0.6))
	_part(torso, U.box(Vector3(0.05, 0.16, 0.02)), m_amber, Vector3(0.045, 0.43, -0.14), Vector3(0, 0, -0.6))
	_part(torso, U.box(Vector3(0.04, 0.4, 0.05)), m_teal, Vector3(0, 0.36, 0.12))
	head = _pivot(torso, Vector3(0, 0.66, 0))
	_part(head, U.sph(0.125, 14, 8), m_dark, Vector3(0, 0.1, 0))
	_part(head, U.box(Vector3(0.2, 0.045, 0.06)), m_visor, Vector3(0, 0.12, -0.1))
	_part(head, U.box(Vector3(0.03, 0.12, 0.22)), m_teal, Vector3(0, 0.2, 0.0))
	for s in 2:
		var sx := -1.0 if s == 0 else 1.0
		sh[s] = _pivot(torso, Vector3(0.23 * sx, 0.54, 0))
		_part(sh[s], U.sph(0.09, 10, 6), m_teal, Vector3.ZERO)
		_part(sh[s], U.caps(0.065, 0.32), m_dark, Vector3(0, -0.15, 0))
		el[s] = _pivot(sh[s], Vector3(0, -0.3, 0))
		_part(el[s], U.caps(0.055, 0.3), m_teal, Vector3(0, -0.13, 0))
		_part(el[s], U.box(Vector3(0.09, 0.05, 0.09)), m_amber, Vector3(0, -0.2, 0))
		_part(el[s], U.sph(0.055, 8, 5), m_dark, Vector3(0, -0.3, 0))
		th[s] = _pivot(hips, Vector3(0.1 * sx, -0.05, 0))
		_part(th[s], U.caps(0.085, 0.46), m_dark, Vector3(0, -0.21, 0))
		_part(th[s], U.box(Vector3(0.03, 0.3, 0.02)), m_amber, Vector3(0.08 * sx, -0.2, 0))
		kn[s] = _pivot(th[s], Vector3(0, -0.43, 0))
		_part(kn[s], U.caps(0.07, 0.44), m_teal, Vector3(0, -0.2, 0))
		_part(kn[s], U.box(Vector3(0.11, 0.07, 0.24)), m_dark, Vector3(0, -0.44, -0.05))

## Right hand world position (rope origin)
func hand_pos(s := 1) -> Vector3:
	return el[s].global_transform * Vector3(0, -0.32, 0)

func _ease(key: String, v: float, dt: float, rate := 12.0) -> void:
	tgt[key] = lerp(float(tgt.get(key, 0.0)), v, 1.0 - exp(-rate * dt))

func pose(state: int, dt: float, speed: float, extra: Dictionary) -> void:
	# state: 0 ground, 1 air, 2 swing, 3 wall
	var run := 0.0
	var tuck := 0.0
	var arm_up := [0.0, 0.0]
	var arm_out := [0.25, 0.25]
	var lean := 0.0
	var legs := [0.0, 0.0]
	var knees := [0.05, 0.05]
	var elb := [-0.3, -0.3]
	match state:
		0:
			var amp: float = clamp(speed / 10.0, 0.0, 1.0)
			phase += dt * (4.0 + speed * 0.75)
			var s := sin(phase)
			legs = [s * 1.0 * amp, -s * 1.0 * amp]
			knees = [0.1 + max(0.0, -cos(phase)) * 1.5 * amp, 0.1 + max(0.0, cos(phase)) * 1.5 * amp]
			arm_up = [-s * 0.9 * amp, s * 0.9 * amp]
			elb = [-0.3 - 1.0 * amp, -0.3 - 1.0 * amp]
			lean = -0.08 - 0.3 * clamp(speed / 16.0, 0.0, 1.0)
			if speed < 0.5:
				phase += dt * 1.5
				arm_up = [sin(phase * 0.5) * 0.04, -sin(phase * 0.5) * 0.04]
		1:
			var vy: float = extra.get("vy", 0.0)
			legs = [-0.6, 0.2]
			knees = [1.3, 0.6]
			arm_out = [1.1, 1.1]
			arm_up = [-0.4, -0.4]
			lean = clamp(-vy * 0.02, -0.4, 0.4)
			if vy < -12.0:
				legs = [-0.2, 0.3]
				knees = [0.5, 0.3]
				arm_out = [1.4, 1.4]
		2:
			var side: int = extra.get("side", 1)
			var rise: float = extra.get("rise", 0.0)
			arm_up[side] = 2.9
			arm_out[side] = 0.15
			elb[side] = -0.1
			arm_up[1 - side] = -0.5
			arm_out[1 - side] = 0.9
			elb[1 - side] = -1.2
			var t: float = clamp(rise, -1.0, 1.0)
			legs = [-0.9 + t * 0.9, -0.5 + t * 0.9]
			knees = [1.6 - t * 1.2, 1.1 - t * 0.9]
			lean = -0.2
		3:
			phase += dt * (3.0 + speed * 0.8)
			var s2 := sin(phase)
			arm_up = [2.4 + s2 * 0.6, 2.4 - s2 * 0.6]
			arm_out = [0.35, 0.35]
			elb = [-0.9 + s2 * 0.5, -0.9 - s2 * 0.5]
			legs = [-0.9 - s2 * 0.5, -0.9 + s2 * 0.5]
			knees = [1.2 + s2 * 0.4, 1.2 - s2 * 0.4]
			lean = 0.1
	for s in 2:
		var sx := -1.0 if s == 0 else 1.0
		_ease("su%d" % s, arm_up[s], dt)
		_ease("so%d" % s, arm_out[s], dt)
		_ease("e%d" % s, elb[s], dt)
		_ease("t%d" % s, legs[s], dt)
		_ease("k%d" % s, knees[s], dt)
		sh[s].rotation = Vector3(tgt["su%d" % s], 0, tgt["so%d" % s] * sx)
		el[s].rotation = Vector3(-tgt["e%d" % s], 0, 0)
		th[s].rotation = Vector3(-tgt["t%d" % s], 0, 0.04 * sx)
		kn[s].rotation = Vector3(-tgt["k%d" % s], 0, 0)
	_ease("lean", lean, dt)
	torso.rotation.x = tgt["lean"]
