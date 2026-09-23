class_name Hero
extends CharacterBody3D
## Player controller: ground sprint, jump, pendulum web-swing, wall climb / wall run, ledge vault.
## The tether is a distance constraint solved every physics tick (a rope/pin constraint on the
## CharacterBody3D), with the anchor found by raycasting building facades.

enum St { GROUND, AIR, SWING, WALL }
const G := 26.0
const RUN := 8.0
const SPRINT := 17.0
const MAX_SPEED := 52.0

signal landed(speed: float)

var st := St.AIR
var cam_yaw := 0.0
var input_dir := Vector2.ZERO   # x = right, y = forward
var swing_held := false
var jump_pressed := false
var sprint := false

var anchor := Vector3.ZERO
var rope_len := 0.0
var rope_show := 0.0
var swing_side := 1
var swing_cool := 0.0
var wall_cool := 0.0
var wall_n := Vector3.ZERO
var air_time := 0.0
var face := Vector3.FORWARD
var model: HeroModel
var rope: MeshInstance3D
var swings := 0

func _ready() -> void:
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	collision_layer = 2
	collision_mask = 1
	floor_max_angle = deg_to_rad(50)
	floor_snap_length = 0.35
	model = HeroModel.new()
	add_child(model)
	rope = MeshInstance3D.new()
	rope.mesh = U.cyl(0.028, 1.0, 5)
	rope.material_override = U.unshaded(Color(0.95, 0.97, 1.0))
	rope.top_level = true
	rope.visible = false
	rope.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(rope)

func fwd_cam() -> Vector3:
	return Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))

func wish() -> Vector3:
	var f := fwd_cam()
	var r := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
	var w := r * input_dir.x + f * input_dir.y
	return w.limit_length(1.0)

func hvel() -> Vector3:
	return Vector3(velocity.x, 0, velocity.z)

func chest() -> Vector3:
	return global_position + Vector3(0, 1.3, 0)

func _physics_process(dt: float) -> void:
	swing_cool -= dt
	wall_cool -= dt
	match st:
		St.GROUND: _ground(dt)
		St.AIR: _air(dt)
		St.SWING: _swing(dt)
		St.WALL: _wall(dt)
	jump_pressed = false
	if velocity.length() > MAX_SPEED:
		velocity = velocity.normalized() * MAX_SPEED
	_orient(dt)
	_rope_visual(dt)

func _ground(dt: float) -> void:
	var w := wish()
	var hv := hvel()
	var target := w * (SPRINT if sprint else RUN)
	var acc := 70.0 if w.length() > 0.1 else 45.0
	if hv.length() > SPRINT + 1.0:
		acc = 12.0  # keep momentum from a swing landing
	hv = hv.move_toward(target, acc * dt)
	velocity.x = hv.x
	velocity.z = hv.z
	velocity.y -= G * dt
	if jump_pressed:
		velocity.y = 12.0 if sprint else 9.5
		st = St.AIR
	elif swing_held and swing_cool <= 0.0 and _try_attach(true):
		return
	move_and_slide()
	if not is_on_floor():
		air_time += dt
		if air_time > 0.12:
			st = St.AIR
	else:
		air_time = 0.0
	if st == St.GROUND and w.length() > 0.5 and wall_cool <= 0.0:
		_try_wall(w)

func _air(dt: float) -> void:
	velocity.y -= G * dt
	var w := wish()
	var hv := hvel()
	hv += w * 11.0 * dt
	var cap: float = max(hv.length(), SPRINT)
	hv = hv.limit_length(cap)
	velocity.x = hv.x
	velocity.z = hv.z
	if swing_held and swing_cool <= 0.0 and _try_attach(false):
		return
	move_and_slide()
	if is_on_floor():
		landed.emit(-velocity.y)
		st = St.GROUND
		air_time = 0.0
		return
	if wall_cool <= 0.0:
		var into := w if w.length() > 0.3 else hv.normalized()
		if is_on_wall():
			_try_wall(into)

func _try_attach(from_ground: bool) -> bool:
	var space := get_world_3d().direct_space_state
	var hv := hvel()
	var f := hv.normalized() if hv.length() > 4.0 else fwd_cam()
	if wish().length() > 0.3 and hv.length() < 10.0:
		f = wish().normalized()
	var origin := chest()
	var best := Vector3.ZERO
	var best_score := -1e9
	var best_side := 0
	for side in [-1, 1]:
		for yaw_off in [12.0, 28.0, 45.0]:
			for elev in [42.0, 56.0, 70.0]:
				var d := f.rotated(Vector3.UP, deg_to_rad(yaw_off) * side)
				var e := deg_to_rad(elev)
				d = (d * cos(e) + Vector3.UP * sin(e)).normalized()
				var q := PhysicsRayQueryParameters3D.create(origin, origin + d * 95.0, 1)
				var hit := space.intersect_ray(q)
				if hit.is_empty():
					continue
				var p: Vector3 = hit.position
				var dist := origin.distance_to(p)
				var hgt := p.y - origin.y
				if hgt < 6.0 or dist < 9.0:
					continue
				var score: float = -abs(dist - 36.0) * 0.7 + min(hgt, 40.0) * 0.25
				var flat := Vector3(p.x - origin.x, 0, p.z - origin.z).normalized()
				score += flat.dot(f) * 14.0
				if side == swing_side:
					score += 5.0
				if score > best_score:
					best_score = score
					best = p
					best_side = side
	if best_score < -1e8:
		return false
	anchor = best
	rope_len = origin.distance_to(anchor) * 0.94
	swing_side = best_side
	st = St.SWING
	rope_show = 0.0
	swings += 1
	# attach kick: pull forward so a standing start becomes a swing
	var boost := f * (7.0 if hv.length() < 20.0 else 2.5)
	if from_ground:
		boost += Vector3.UP * 9.0
	velocity += boost
	return true

func release(extra := true) -> void:
	st = St.AIR
	swing_cool = 0.28
	swing_side = -swing_side
	if extra:
		velocity.y += 5.0
		velocity += hvel().normalized() * 2.5

func _swing(dt: float) -> void:
	if not swing_held:
		release()
		return
	velocity.y -= G * dt
	var w := wish()
	velocity += w * 10.0 * dt
	# gentle reel-in keeps tension and lifts the arc
	rope_len = max(rope_len - 3.0 * dt, 7.0)
	var origin := chest()
	var pred := origin + velocity * dt
	var r := pred - anchor
	if r.length() > rope_len:
		pred = anchor + r.normalized() * rope_len
		velocity = (pred - origin) / dt
	move_and_slide()
	if origin.y > anchor.y - 2.5 and velocity.y > 0.0:
		release()
		return
	if is_on_floor():
		st = St.GROUND
		swing_cool = 0.3
		return
	if is_on_wall() and wall_cool <= 0.0:
		if _try_wall(hvel().normalized() if hvel().length() > 1.0 else fwd_cam()):
			swing_cool = 0.3
			return

func _try_wall(dir: Vector3) -> bool:
	if dir.length() < 0.1:
		return false
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(chest(), chest() + dir.normalized() * 1.2, 1)
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return false
	var n: Vector3 = hit.normal
	if abs(n.y) > 0.3:
		return false
	wall_n = Vector3(n.x, 0, n.z).normalized()
	st = St.WALL
	velocity = Vector3(0, max(velocity.y, 2.0), 0) + (hvel() - wall_n * hvel().dot(wall_n)) * 0.5
	return true

func _wall(dt: float) -> void:
	var facing := -wall_n
	var right := facing.cross(Vector3.UP)
	var up_speed := 13.0 if sprint else 6.0
	var target_up := input_dir.y * up_speed
	if input_dir.y <= 0.05:
		target_up = -1.5 if input_dir.y > -0.5 else -8.0
	velocity.y = move_toward(velocity.y, target_up, 40.0 * dt)
	var lat := right * input_dir.x * (9.0 if sprint else 5.0)
	var cur_lat := velocity - wall_n * velocity.dot(wall_n)
	cur_lat.y = 0
	cur_lat = cur_lat.move_toward(lat, 30.0 * dt)
	velocity.x = cur_lat.x - wall_n.x * 2.0
	velocity.z = cur_lat.z - wall_n.z * 2.0
	if jump_pressed:
		velocity = wall_n * 9.0 + Vector3.UP * 10.0 + fwd_cam() * 3.0
		st = St.AIR
		wall_cool = 0.4
		return
	if swing_held and swing_cool <= 0.0:
		wall_cool = 0.4
		st = St.AIR
		if _try_attach(false):
			return
	move_and_slide()
	var space := get_world_3d().direct_space_state
	var hi := space.intersect_ray(PhysicsRayQueryParameters3D.create(chest() + Vector3.UP * 0.6, chest() + Vector3.UP * 0.6 + facing * 1.3, 1))
	var lo := space.intersect_ray(PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 0.3, global_position + Vector3.UP * 0.3 + facing * 1.3, 1))
	if hi.is_empty() and not lo.is_empty() and velocity.y > 0.0:
		# ledge vault onto the roof
		velocity = Vector3.UP * 8.5 + facing * 6.0
		st = St.AIR
		wall_cool = 0.6
		return
	if hi.is_empty() and lo.is_empty():
		st = St.AIR
		wall_cool = 0.3
		return
	if not hi.is_empty():
		var n: Vector3 = hi.normal
		if abs(n.y) < 0.3:
			wall_n = Vector3(n.x, 0, n.z).normalized()
	if is_on_floor() and input_dir.y <= 0.05:
		st = St.GROUND
		wall_cool = 0.5

func _orient(dt: float) -> void:
	var up := Vector3.UP
	var dir := face
	var hv := hvel()
	match st:
		St.WALL:
			dir = -wall_n
			# body leans into the wall; feet on the facade while wall-running
			up = (Vector3.UP * 0.35 + wall_n * 0.94).normalized() if (sprint and velocity.y > 4.0) else Vector3.UP
			if up != Vector3.UP:
				dir = Vector3.UP.slide(up).normalized()
		St.SWING:
			if hv.length() > 1.0:
				dir = hv.normalized()
			up = (anchor - chest()).normalized().lerp(Vector3.UP, 0.35).normalized()
			dir = dir.slide(up).normalized()
		_:
			var w := wish()
			if hv.length() > 1.0:
				dir = hv.normalized()
			elif w.length() > 0.2:
				dir = w.normalized()
	if dir.length() < 0.1:
		dir = face
	face = face.slerp(dir, 1.0 - exp(-10.0 * dt)).normalized() if face.dot(dir) > -0.95 else dir
	var cur_up := model.global_transform.basis.y.slerp(up, 1.0 - exp(-10.0 * dt)).normalized()
	var fdir := face.slide(cur_up).normalized()
	if fdir.length() < 0.1:
		fdir = face
	model.global_transform.basis = Basis.looking_at(fdir, cur_up)
	var rise := 0.0
	if st == St.SWING:
		rise = velocity.y / 20.0
	model.pose(int(st), dt, hv.length(), {"vy": velocity.y, "side": 1 if swing_side > 0 else 0, "rise": rise})

func _rope_visual(dt: float) -> void:
	if st != St.SWING:
		rope.visible = false
		return
	rope_show = min(rope_show + dt * 9.0, 1.0)
	var a := model.hand_pos(1 if swing_side > 0 else 0)
	var b := a.lerp(anchor, rope_show)
	var d := b - a
	var L := d.length()
	if L < 0.05:
		rope.visible = false
		return
	var y := d / L
	var x := y.cross(Vector3.UP)
	if x.length() < 0.01:
		x = Vector3.RIGHT
	x = x.normalized()
	var z := x.cross(y).normalized()
	rope.global_transform = Transform3D(Basis(x, y * L, z), (a + b) * 0.5)
	rope.visible = true
