extends Node3D
## SKYTETHER: builds the world, routes input, runs crimes and district sync.

var city: City
var traffic: Traffic
var hero: Hero
var rig: Node3D
var arm: SpringArm3D
var cam: Camera3D
var hud: Hud
var pad: TouchPad
var yaw := 0.0
var pitch := -0.22
var manual_t := 0.0
var touch_mode := false
var demo := false
var demo_t := 0.0
var demo_hold := 0.0
var crime: Dictionary = {}
var crime_wait := 2.0
var crimes_stopped := 0
var synced := [false, false, false, false]
var cur_district := -1
var rng := RandomNumberGenerator.new()
var marker_mat := U.emissive(Color(1.0, 0.18, 0.2), 2.5)
var beam_mat := U.unshaded(Color(1.0, 0.2, 0.2, 0.22), true)
const CRIME_NAMES := [["STREET THEFT", "Bag snatch in progress"], ["MUGGING", "Civilian cornered"],
	["CAR PURSUIT", "Stolen vehicle fleeing"], ["STOREFRONT ROBBERY", "Alarm tripped"]]

func _ready() -> void:
	rng.randomize()
	var args := OS.get_cmdline_user_args()
	demo = "--demo" in args
	touch_mode = "--touch" in args
	if OS.has_feature("web"):
		var q = JavaScriptBridge.eval("window.location.search", true)
		if typeof(q) == TYPE_STRING:
			demo = demo or q.find("demo=1") != -1
			touch_mode = q.find("touch=1") != -1
	touch_mode = touch_mode or DisplayServer.is_touchscreen_available()
	_inputs()
	_environment()
	city = City.new()
	add_child(city)
	city.build()
	traffic = Traffic.new()
	add_child(traffic)
	traffic.build(city, 110 if touch_mode else 150, 150 if touch_mode else 220)
	hero = Hero.new()
	add_child(hero)
	hero.landed.connect(_on_landed)
	var start := Vector3(city.line(4), 0.3, city.line(6) - 20.0)
	if demo:
		start = Vector3(city.line(4), 26.0, city.line(8) - 30.0)
		hero.velocity = Vector3(0, 2, -22)
	hero.global_position = start
	yaw = 0.0
	_camera()
	hud = Hud.new()
	add_child(hud)
	hud.build(get_world_3d())
	if touch_mode:
		pad = TouchPad.new()
		hud.add_child(pad)
		get_viewport().scaling_3d_scale = 0.75
	get_viewport().size_changed.connect(_resized)
	_resized()

func _resized() -> void:
	var win := get_window()
	var real := Vector2(win.size)
	var s: float = clamp(min(real.x, real.y) / 620.0, 0.6, 3.0)
	win.content_scale_size = Vector2i(real / s)
	var logical := real / s
	hud.layout(logical)
	hud.set_touch_mode(touch_mode, logical)
	if pad:
		pad.position = Vector2.ZERO
		pad.size = logical
		pad.queue_redraw()

func _inputs() -> void:
	var keys := {"fwd": [KEY_W, KEY_UP], "back": [KEY_S, KEY_DOWN], "left": [KEY_A, KEY_LEFT],
		"right": [KEY_D, KEY_RIGHT], "jump": [KEY_SPACE], "sprint": [KEY_SHIFT], "swing": [KEY_E, KEY_Q]}
	for a in keys:
		if not InputMap.has_action(a):
			InputMap.add_action(a)
		for k in keys[a]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(a, ev)
	var mb := InputEventMouseButton.new()
	mb.button_index = MOUSE_BUTTON_LEFT
	InputMap.action_add_event("swing", mb)

func _environment() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/sky.gdshader")
	sky.sky_material = sm
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.6
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.74, 0.82, 0.9)
	env.fog_density = 0.0021
	env.fog_sky_affect = 0.15
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-48), deg_to_rad(-32), 0)
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 170.0
	sun.shadow_bias = 0.06
	add_child(sun)

func _camera() -> void:
	rig = Node3D.new()
	add_child(rig)
	rig.top_level = true
	rig.global_position = hero.global_position + Vector3(0, 1.6, 0)
	arm = SpringArm3D.new()
	arm.spring_length = 6.0
	arm.collision_mask = 1
	arm.margin = 0.3
	var sp := SphereShape3D.new()
	sp.radius = 0.25
	arm.shape = sp
	arm.add_excluded_object(hero.get_rid())
	rig.add_child(arm)
	cam = Camera3D.new()
	cam.fov = 72
	cam.far = 1400.0
	cam.near = 0.1
	cam.cull_mask = 0xFFFFF & ~City.MAP_LAYER
	arm.add_child(cam)
	cam.current = true

func _unhandled_input(ev: InputEvent) -> void:
	if touch_mode or demo:
		return
	if ev is InputEventMouseButton and ev.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if ev is InputEventKey and ev.pressed and ev.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_look(ev.relative * 0.0035)

func _look(d: Vector2) -> void:
	yaw -= d.x
	pitch = clamp(pitch - d.y, -1.2, 0.5)
	manual_t = 1.6

func _process(dt: float) -> void:
	_read_input(dt)
	_update_camera(dt)
	_crimes(dt)
	_districts()
	var hv := Vector3(hero.velocity.x, 0, hero.velocity.z)
	hud.update(dt, hero.global_position, yaw)
	hud.status.text = "DISTRICTS %d/4    CRIMES STOPPED %d\n%d km/h" % [synced.count(true), crimes_stopped, int(hero.velocity.length() * 3.6)]

func _read_input(dt: float) -> void:
	var mv := Vector2.ZERO
	var swing := false
	var jump := false
	var sprint := false
	if demo:
		_autopilot(dt)
		return
	if touch_mode and pad:
		mv = pad.move
		swing = pad.swing
		jump = pad.consume_jump()
		sprint = pad.sprint
		var l := pad.consume_look()
		if l.length() > 0.0:
			_look(l * 0.006)
	mv.x += Input.get_action_strength("right") - Input.get_action_strength("left")
	mv.y += Input.get_action_strength("fwd") - Input.get_action_strength("back")
	swing = swing or Input.is_action_pressed("swing")
	jump = jump or Input.is_action_just_pressed("jump")
	sprint = sprint or Input.is_action_pressed("sprint")
	hero.input_dir = mv.limit_length(1.0)
	hero.swing_held = swing
	if jump:
		hero.jump_pressed = true
	hero.sprint = sprint
	hero.cam_yaw = yaw

func _autopilot(dt: float) -> void:
	# scripted player for QA frames: sprint forward along avenues, chain swings, turn at the edge
	demo_t += dt
	hero.cam_yaw = yaw
	hero.sprint = true
	var p := hero.global_position
	# steer back to the centre of the avenue we are travelling along
	var f := Vector3(-sin(yaw), 0, -cos(yaw))
	var r := Vector3(cos(yaw), 0, -sin(yaw))
	var e := Vector3.ZERO
	if abs(f.z) > abs(f.x):
		e.x = p.x - (round((p.x + city.H) / City.P) * City.P - city.H)
	else:
		e.z = p.z - (round((p.z + city.H) / City.P) * City.P - city.H)
	hero.input_dir = Vector2(clamp(-e.dot(r) / 5.0, -1.0, 1.0), 1.0)
	if hero.st == Hero.St.WALL:
		hero.jump_pressed = true
	if abs(p.x) > city.H - 60 or abs(p.z) > city.H - 60:
		var to_c := -Vector2(p.x, p.z).normalized()
		var target_yaw := atan2(-to_c.x, -to_c.y)
		yaw = lerp_angle(yaw, snappedf(target_yaw, PI / 2), dt * 2.0)
	if hero.st == Hero.St.SWING:
		demo_hold -= dt
		hero.swing_held = demo_hold > 0.0
	else:
		hero.swing_held = hero.velocity.y < -1.0 or hero.st == Hero.St.GROUND
		demo_hold = 1.5
	if hero.st == Hero.St.GROUND and fmod(demo_t, 3.0) < dt:
		hero.jump_pressed = true

func _update_camera(dt: float) -> void:
	var tp := hero.global_position + Vector3(0, 1.6, 0)
	rig.global_position = rig.global_position.lerp(tp, 1.0 - exp(-14.0 * dt))
	manual_t -= dt
	var hv := Vector2(hero.velocity.x, hero.velocity.z)
	if manual_t <= 0.0 and hv.length() > 4.0 and hero.st != Hero.St.WALL and not (demo and (abs(hero.global_position.x) > city.H - 60 or abs(hero.global_position.z) > city.H - 60)):
		var desired := atan2(-hv.x, -hv.y)
		yaw = lerp_angle(yaw, desired, 1.0 - exp(-1.6 * dt))
	if hero.st == Hero.St.WALL and manual_t <= 0.0:
		pitch = lerp(pitch, 0.25, dt * 2.0)
	elif manual_t <= 0.0:
		pitch = lerp(pitch, -0.2, dt * 1.5)
	rig.rotation = Vector3(pitch, yaw, 0)
	var speed := hero.velocity.length()
	arm.spring_length = lerp(arm.spring_length, 5.0 + clamp(speed / 40.0, 0.0, 1.0) * 3.5, dt * 3.0)
	cam.fov = lerp(cam.fov, 70.0 + clamp(speed / 45.0, 0.0, 1.0) * 16.0, dt * 3.0)

func _on_landed(v: float) -> void:
	if v > 22.0:
		hud.toast("Hard landing", Color(0.8, 0.85, 0.9))

# ---------------- crimes ----------------
func _crimes(dt: float) -> void:
	if crime.is_empty():
		crime_wait -= dt
		if crime_wait <= 0.0:
			_spawn_crime()
		hud.obj_title.text = "// PATROL"
		hud.obj_sub.text = "Scanning police band…"
		return
	var pos: Vector3 = crime.pos
	if crime.car >= 0:
		pos = traffic.car_pos(crime.car)
	crime.node.global_position = pos
	crime.node.get_child(0).position.y = 4.5 + sin(Time.get_ticks_msec() * 0.004) * 0.4
	crime.node.get_child(0).rotation.y += dt * 2.0
	crime.map.global_position = Vector3(pos.x, -95, pos.z)
	var hp := hero.global_position
	var dist := Vector2(hp.x - pos.x, hp.z - pos.z).length()
	hud.obj_title.text = "// %s" % crime.name
	hud.obj_sub.text = "%s · %d m" % [crime.sub, int(dist)]
	if dist < 7.0 and hp.y < pos.y + 7.0:
		if crime.car >= 0:
			traffic.cars[crime.car].stopped = true
		crimes_stopped += 1
		hud.toast("CRIME STOPPED  ·  %s  ·  +150 XP" % crime.name, Color(1.0, 0.72, 0.3))
		crime.node.queue_free()
		crime.map.queue_free()
		crime = {}
		crime_wait = 3.0

func _spawn_crime() -> void:
	var kind := rng.randi() % CRIME_NAMES.size()
	var pos := Vector3.ZERO
	var car := -1
	if kind == 2:
		car = rng.randi() % traffic.cars.size()
		pos = traffic.car_pos(car)
	else:
		var lanes := city.lanes()
		for tries in 20:
			var lane: Array = lanes[rng.randi() % lanes.size()]
			pos = traffic.lane_pos(lane, rng.randf_range(-city.H + 40, city.H - 40), 8.8 * (1 if rng.randf() < 0.5 else -1))
			var d := pos.distance_to(hero.global_position)
			if d > 90.0 and d < 320.0:
				break
	pos.y = 0.2
	var node := Node3D.new()
	var gem := MeshInstance3D.new()
	gem.mesh = U.sph(0.7, 4, 2)
	gem.material_override = marker_mat
	gem.scale = Vector3(1, 1.4, 1)
	node.add_child(gem)
	var beam := MeshInstance3D.new()
	beam.mesh = U.cyl(0.5, 60.0, 6)
	beam.position.y = 30.0
	beam.material_override = beam_mat
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.add_child(beam)
	if car < 0:
		var thug := U.mat(Color(0.35, 0.06, 0.08), 0.8)
		for k in 3:
			var t := MeshInstance3D.new()
			t.mesh = U.caps(0.26, 1.7)
			t.material_override = thug
			t.position = Vector3(cos(k * 2.1) * 1.8, 0.85, sin(k * 2.1) * 1.8)
			node.add_child(t)
	add_child(node)
	node.global_position = pos
	var mk := MeshInstance3D.new()
	mk.mesh = U.cyl(5.0, 1.0, 12)
	mk.material_override = U.unshaded(Color(1.0, 0.2, 0.22))
	mk.layers = City.MAP_LAYER
	add_child(mk)
	crime = {"pos": pos, "car": car, "name": CRIME_NAMES[kind][0], "sub": CRIME_NAMES[kind][1], "node": node, "map": mk}
	hud.toast("NEW CRIME  ·  %s" % CRIME_NAMES[kind][0], Color(1.0, 0.45, 0.45))

# ---------------- districts ----------------
func _districts() -> void:
	var p := hero.global_position
	var d := City.district_of(p)
	if d != cur_district:
		cur_district = d
		if not synced[d]:
			hud.toast("ENTERING %s  ·  find the relay beacon" % City.DISTRICTS[d], Color(0.8, 0.9, 1.0))
		else:
			hud.toast("%s  ·  %s" % [City.DISTRICTS[d], City.DISTRICT_TAG[d]], Color(0.8, 0.9, 1.0))
	for b in city.beacons:
		var di: int = b.district
		if synced[di]:
			continue
		var bp: Vector3 = b.pos
		if Vector2(p.x - bp.x, p.z - bp.z).length() < 16.0 and p.y > bp.y - 3.0:
			synced[di] = true
			hud.show_banner("DISTRICT SYNCED", City.DISTRICTS[di])
			hud.toast("FAST TRAVEL POINT UNLOCKED  ·  %s" % City.DISTRICTS[di], Color(1.0, 0.72, 0.3))
			city.district_fog[di].visible = false
			b.node.get_node("Beam").visible = false
