shader_type spatial;
render_mode diffuse_lambert;

uniform float pitch = 80.0;
uniform float half_extent = 360.0;

varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void fragment() {
	vec2 p = wpos.xz;
	float fx = mod(p.x + half_extent, pitch);
	float dx = min(fx, pitch - fx);
	float fz = mod(p.y + half_extent, pitch);
	float dz = min(fz, pitch - fz);
	float grain = hash(floor(p * 3.0));
	vec3 col = vec3(0.23, 0.235, 0.245) * (0.9 + 0.1 * grain);
	vec3 yellow = vec3(0.85, 0.68, 0.18);
	vec3 white = vec3(0.86);
	// road running along x (constant z line): |dz| < 7, away from intersections
	if (dz < 7.0 && dx > 10.0) {
		if (dz < 0.28 && dz > 0.08) col = yellow;
		if (abs(dz - 3.5) < 0.1 && mod(p.x, 7.0) < 3.5) col = white;
		if (dx < 13.5 && fract(p.y / 1.3) < 0.55) col = white;
	}
	if (dx < 7.0 && dz > 10.0) {
		if (dx < 0.28 && dx > 0.08) col = yellow;
		if (abs(dx - 3.5) < 0.1 && mod(p.y, 7.0) < 3.5) col = white;
		if (dz < 13.5 && fract(p.x / 1.3) < 0.55) col = white;
	}
	// darker tyre tracks
	float lane = min(abs(dz - 3.5), abs(dx - 3.5));
	col *= 1.0 - 0.06 * smoothstep(1.2, 0.0, abs(lane - 0.0));
	ALBEDO = col;
	ROUGHNESS = 0.92;
}
