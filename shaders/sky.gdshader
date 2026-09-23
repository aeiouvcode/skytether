shader_type sky;

uniform vec3 top_color = vec3(0.22, 0.48, 0.88);
uniform vec3 horizon_color = vec3(0.74, 0.85, 0.95);
uniform vec3 ground_color = vec3(0.58, 0.62, 0.66);

float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * n2(p); p *= 2.03; a *= 0.5; }
	return v;
}

void sky() {
	vec3 d = EYEDIR;
	float y = max(d.y, 0.0);
	vec3 col = mix(horizon_color, top_color, pow(y, 0.5));
	if (d.y < 0.0) col = mix(horizon_color, ground_color, clamp(-d.y * 5.0, 0.0, 1.0));
	float sd = max(dot(d, LIGHT0_DIRECTION), 0.0);
	col += LIGHT0_COLOR * (pow(sd, 900.0) * 5.0 + pow(sd, 10.0) * 0.12);
	if (d.y > 0.0) {
		vec2 uv = d.xz / (d.y + 0.12) * 1.6;
		float c = fbm(uv + vec2(3.1, 7.7));
		c = smoothstep(0.5, 0.75, c) * smoothstep(0.0, 0.25, d.y);
		vec3 cloud = mix(vec3(0.82, 0.86, 0.92), vec3(1.0), smoothstep(0.5, 0.9, fbm(uv * 2.0 + 1.3)));
		col = mix(col, cloud, c * 0.92);
	}
	COLOR = pow(col, vec3(2.2));
}
