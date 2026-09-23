class_name Synth
extends AudioStreamPlayer
## All sound is synthesized here at 22.05 kHz: speed wind, web launch, landing thud,
## footsteps and soft UI chimes. Levels stay low and highs are filtered (soft, never harsh).

const RATE := 22050.0
var pb: AudioStreamGeneratorPlayback
var speed := 0.0          # set by main each frame (m/s)
var voices: Array = []    # {k: kind, t: age, a: amp, f: freq}
var wind_lp := 0.0
var wind_lp2 := 0.0
var out_lp := 0.0
var rng := RandomNumberGenerator.new()
var master := 0.8

func _ready() -> void:
	var g := AudioStreamGenerator.new()
	g.mix_rate = RATE
	g.buffer_length = 0.12
	stream = g
	volume_db = -4.0
	play()
	pb = get_stream_playback()

func web() -> void:
	voices.append({"k": 0, "t": 0.0, "a": 1.0, "f": rng.randf_range(0.9, 1.1)})

func thud(impact: float) -> void:
	voices.append({"k": 1, "t": 0.0, "a": clamp(impact / 30.0, 0.25, 1.0), "f": 1.0})

func step() -> void:
	voices.append({"k": 2, "t": 0.0, "a": rng.randf_range(0.6, 1.0), "f": rng.randf_range(0.9, 1.15)})

func chime(high := false) -> void:
	voices.append({"k": 3, "t": 0.0, "a": 1.0, "f": 1.5 if high else 1.0})

func alert() -> void:
	voices.append({"k": 4, "t": 0.0, "a": 1.0, "f": 1.0})

func _process(_dt: float) -> void:
	if pb == null:
		return
	var n := pb.get_frames_available()
	if n <= 0:
		return
	var dt := 1.0 / RATE
	var w: float = clamp((speed - 6.0) / 45.0, 0.0, 1.0)
	var wind_amp := w * w * 0.16
	var cut := 0.02 + w * 0.10
	for i in n:
		var noise := rng.randf() * 2.0 - 1.0
		wind_lp += (noise - wind_lp) * cut
		wind_lp2 += (wind_lp - wind_lp2) * cut
		var s := wind_lp2 * wind_amp * 3.0
		for v in voices:
			var t: float = v.t
			match v.k:
				0:  # web launch: filtered hiss plus a falling tone
					s += (noise * 0.35 + sin(TAU * (520.0 - t * 1400.0) * v.f * t)) * exp(-t * 22.0) * 0.07
				1:  # landing: low sine drop
					s += sin(TAU * (68.0 - t * 30.0) * t) * exp(-t * 9.0) * 0.32 * v.a
				2:  # footstep: short muted tick
					s += sin(TAU * 140.0 * v.f * t) * exp(-t * 45.0) * 0.07 * v.a
				3:  # chime: two soft partials with a gentle attack
					var e := (1.0 - exp(-t * 60.0)) * exp(-t * 2.6)
					s += (sin(TAU * 523.25 * v.f * t) + 0.5 * sin(TAU * 784.0 * v.f * t)) * e * 0.06
				4:  # alert: two-note low pulse
					var f := 330.0 if t < 0.16 else 262.0
					s += sin(TAU * f * t) * exp(-fmod(t, 0.16) * 10.0) * (1.0 if t < 0.32 else 0.0) * 0.07
			v.t = t + dt
		out_lp += (s - out_lp) * 0.45   # soften the top end
		var y := tanh(out_lp * 1.4) * master
		pb.push_frame(Vector2(y, y))
	for k in range(voices.size() - 1, -1, -1):
		if voices[k].t > 1.6:
			voices.remove_at(k)
