class_name Hud
extends CanvasLayer
## Original HUD: objective card, progress, district banner, event toasts, SubViewport minimap + compass.

var root: Control
var obj_title: Label
var obj_sub: Label
var obj_card: PanelContainer
var status: Label
var banner: VBoxContainer
var banner_top: Label
var banner_name: Label
var banner_t := 0.0
var toast_box: VBoxContainer
var map_vp: SubViewport
var map_cam: Camera3D
var map_rect: TextureRect
var map_panel: Panel
var compass: Label
var arrow: Polygon2D
var hint: Label
var title: Label
var title_t := 4.0
var amber := Color(1.0, 0.64, 0.18)

func _style(bg: Color, border_left := 0, radius := 4) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_width_left = border_left
	s.border_color = amber
	s.corner_radius_top_left = radius
	s.corner_radius_top_right = radius
	s.corner_radius_bottom_left = radius
	s.corner_radius_bottom_right = radius
	s.content_margin_left = 12
	s.content_margin_right = 12
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	return s

func _label(txt: String, size: int, col := Color.WHITE, outline := 0) -> Label:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	if outline > 0:
		l.add_theme_constant_override("outline_size", outline)
		l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	return l

func build(world: World3D) -> void:
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	# objective card
	obj_card = PanelContainer.new()
	obj_card.add_theme_stylebox_override("panel", _style(Color(0.04, 0.06, 0.09, 0.72), 4))
	obj_card.position = Vector2(16, 16)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	obj_title = _label("// NO ACTIVE CRIME", 17, Color.WHITE)
	obj_sub = _label("Patrol the city", 13, Color(0.75, 0.82, 0.88))
	v.add_child(obj_title)
	v.add_child(obj_sub)
	obj_card.add_child(v)
	root.add_child(obj_card)
	# status, top right
	status = _label("", 14, Color(0.9, 0.95, 1.0), 4)
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	status.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	status.offset_left = -360
	status.offset_right = -16
	status.offset_top = 14
	root.add_child(status)
	# banner
	banner = VBoxContainer.new()
	banner.set_anchors_preset(Control.PRESET_CENTER_TOP)
	banner.offset_left = -300
	banner.offset_right = 300
	banner.offset_top = 70
	banner.alignment = BoxContainer.ALIGNMENT_CENTER
	banner_top = _label("DISTRICT SYNCED", 16, amber, 5)
	banner_top.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_name = _label("", 40, Color.WHITE, 8)
	banner_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.add_child(banner_top)
	banner.add_child(banner_name)
	banner.modulate.a = 0.0
	banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(banner)
	# toasts
	toast_box = VBoxContainer.new()
	toast_box.position = Vector2(16, 96)
	toast_box.add_theme_constant_override("separation", 6)
	root.add_child(toast_box)
	# minimap
	map_vp = SubViewport.new()
	map_vp.size = Vector2i(256, 192)
	map_vp.world_3d = world
	map_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	map_vp.transparent_bg = false
	add_child(map_vp)
	map_cam = Camera3D.new()
	map_cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	map_cam.size = 230.0
	map_cam.cull_mask = City.MAP_LAYER
	map_cam.near = 1.0
	map_cam.far = 400.0
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.1, 0.13, 0.18)
	map_cam.environment = env
	map_vp.add_child(map_cam)
	map_panel = Panel.new()
	var ps := _style(Color(0.04, 0.06, 0.09, 0.85), 0, 6)
	ps.border_width_top = 2
	ps.border_width_bottom = 2
	ps.border_width_left = 2
	ps.border_width_right = 2
	ps.border_color = Color(0.6, 0.75, 0.85, 0.6)
	map_panel.add_theme_stylebox_override("panel", ps)
	map_panel.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	root.add_child(map_panel)
	map_rect = TextureRect.new()
	map_rect.texture = map_vp.get_texture()
	map_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	map_rect.stretch_mode = TextureRect.STRETCH_SCALE
	map_panel.add_child(map_rect)
	arrow = Polygon2D.new()
	arrow.polygon = PackedVector2Array([Vector2(0, -11), Vector2(8, 8), Vector2(0, 4), Vector2(-8, 8)])
	arrow.color = amber
	map_panel.add_child(arrow)
	compass = _label("", 13, Color(0.85, 0.92, 1.0), 3)
	compass.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(compass)
	hint = _label("WASD move · Shift sprint · Space jump · hold Mouse/E to swing · push into walls to climb", 13, Color(1, 1, 1, 0.8), 4)
	hint.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hint.offset_left = 16
	hint.offset_top = -30
	root.add_child(hint)
	title = _label("SKYTETHER", 54, Color.WHITE, 10)
	title.set_anchors_preset(Control.PRESET_CENTER)
	title.offset_left = -300
	title.offset_right = 300
	title.offset_top = -60
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(title)

func layout(size: Vector2) -> void:
	var w: float = clamp(size.x * 0.24, 150.0, 260.0)
	var h := w * 0.75
	map_panel.offset_left = -w - 16
	map_panel.offset_top = -h - 16
	map_panel.offset_right = -16
	map_panel.offset_bottom = -16
	map_rect.position = Vector2(2, 2)
	map_rect.size = Vector2(w - 4, h - 4)
	arrow.position = Vector2(w * 0.5, h * 0.5)
	compass.position = Vector2(size.x - w - 16, size.y - h - 40)
	compass.size = Vector2(w, 20)
	obj_card.custom_minimum_size.x = min(300.0, size.x * 0.5)

func set_touch_mode(on: bool, size: Vector2) -> void:
	hint.visible = not on
	if on:
		# map moves to the top-right on touch screens so the thumbs stay free
		var w: float = clamp(size.x * 0.3, 130.0, 200.0)
		var h := w * 0.75
		map_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		map_panel.offset_left = -w - 12
		map_panel.offset_right = -12
		map_panel.offset_top = 40
		map_panel.offset_bottom = 40 + h
		map_rect.size = Vector2(w - 4, h - 4)
		arrow.position = Vector2(w * 0.5, h * 0.5)
		compass.position = Vector2(size.x - w - 12, 40 + h + 2)
		compass.size = Vector2(w, 20)
		status.offset_top = 12

func toast(txt: String, col := Color.WHITE) -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _style(Color(0.04, 0.06, 0.09, 0.72), 3))
	var l := _label(txt, 14, col)
	p.add_child(l)
	toast_box.add_child(p)
	var tw := create_tween()
	tw.tween_interval(3.2)
	tw.tween_property(p, "modulate:a", 0.0, 0.6)
	tw.tween_callback(p.queue_free)

func show_banner(top: String, name: String) -> void:
	banner_top.text = top
	banner_name.text = name
	banner_t = 4.0

func update(dt: float, player_pos: Vector3, yaw: float) -> void:
	map_cam.global_position = Vector3(player_pos.x, 0.0, player_pos.z)
	map_cam.rotation = Vector3(-PI / 2, yaw, 0)
	banner_t -= dt
	banner.modulate.a = clamp(banner_t, 0.0, 1.0)
	title_t -= dt
	title.modulate.a = clamp(title_t, 0.0, 1.0)
	title.visible = title_t > 0.0
	# compass: heading letters
	var deg := fposmod(-rad_to_deg(yaw), 360.0)
	var names := ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
	var i := int(round(deg / 45.0)) % 8
	compass.text = "< %s >   %03d°" % [names[i], int(deg)]
