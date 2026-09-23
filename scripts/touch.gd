class_name TouchPad
extends Control
## On-screen controls: left stick, right-side look drag, SWING (hold), JUMP, SPRINT toggle.

var move := Vector2.ZERO
var look := Vector2.ZERO
var swing := false
var jump := false
var sprint := true
var stick_id := -1
var stick_origin := Vector2.ZERO
var stick_pos := Vector2.ZERO
var look_id := -1
var look_last := Vector2.ZERO
var swing_id := -1
var font: Font

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	font = ThemeDB.fallback_font

func _btn() -> Dictionary:
	var s := size
	var r: float = clamp(min(s.x, s.y) * 0.11, 40.0, 70.0)
	return {
		"swing": [Vector2(s.x - r * 1.5, s.y - r * 1.9), r * 1.15],
		"jump": [Vector2(s.x - r * 3.6, s.y - r * 1.0), r * 0.8],
		"sprint": [Vector2(s.x - r * 1.2, s.y - r * 4.2), r * 0.65],
	}

func _hit(p: Vector2) -> String:
	var b := _btn()
	for k in b:
		if p.distance_to(b[k][0]) < b[k][1] * 1.15:
			return k
	return ""

func _input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch:
		var p: Vector2 = ev.position / get_viewport().get_canvas_transform().get_scale()
		if ev.pressed:
			var k := _hit(p)
			if k == "swing":
				swing_id = ev.index
				swing = true
			elif k == "jump":
				jump = true
			elif k == "sprint":
				sprint = not sprint
			elif p.x < size.x * 0.45 and stick_id == -1:
				stick_id = ev.index
				stick_origin = p
				stick_pos = p
			elif look_id == -1:
				look_id = ev.index
				look_last = p
		else:
			if ev.index == stick_id:
				stick_id = -1
				move = Vector2.ZERO
			if ev.index == look_id:
				look_id = -1
			if ev.index == swing_id:
				swing_id = -1
				swing = false
		queue_redraw()
	elif ev is InputEventScreenDrag:
		var p: Vector2 = ev.position / get_viewport().get_canvas_transform().get_scale()
		if ev.index == stick_id:
			stick_pos = p
			var d := (p - stick_origin) / 60.0
			move = Vector2(d.x, -d.y).limit_length(1.0)
		elif ev.index == look_id:
			look += p - look_last
			look_last = p
		queue_redraw()

func consume_look() -> Vector2:
	var l := look
	look = Vector2.ZERO
	return l

func consume_jump() -> bool:
	var j := jump
	jump = false
	return j

func _circle(c: Vector2, r: float, col: Color, label: String, active := false) -> void:
	draw_circle(c, r, Color(0.04, 0.06, 0.09, 0.45 if not active else 0.7))
	draw_arc(c, r, 0, TAU, 40, col, 3.0, true)
	var fs := int(r * 0.34)
	var tw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
	draw_string(font, c + Vector2(-tw * 0.5, fs * 0.35), label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

func _draw() -> void:
	var amber := Color(1.0, 0.64, 0.18)
	var b := _btn()
	_circle(b.swing[0], b.swing[1], amber, "SWING", swing)
	_circle(b.jump[0], b.jump[1], Color(0.85, 0.93, 1.0), "JUMP")
	_circle(b.sprint[0], b.sprint[1], amber if sprint else Color(0.7, 0.75, 0.8), "SPRINT", sprint)
	var base := stick_origin if stick_id != -1 else Vector2(110, size.y - 120)
	draw_circle(base, 62, Color(0.04, 0.06, 0.09, 0.35))
	draw_arc(base, 62, 0, TAU, 40, Color(1, 1, 1, 0.5), 2.0, true)
	var knob := base + Vector2(move.x, -move.y) * 60.0
	draw_circle(knob, 26, Color(1, 1, 1, 0.55))

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()

func _process(_dt: float) -> void:
	if Engine.get_process_frames() % 10 == 0:
		queue_redraw()
