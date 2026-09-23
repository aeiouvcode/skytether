shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx;

// Procedural facade: window grid in world space, per-instance style/seed.
varying vec3 wpos;
varying vec3 wnrm;
varying vec4 cust;
varying vec3 bcol;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	cust = INSTANCE_CUSTOM;
	bcol = COLOR.rgb;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void fragment() {
	vec3 n = normalize(wnrm);
	int style = int(cust.r * 4.0 + 0.5);
	float seed = cust.g * 97.0;
	float top = cust.b * 200.0;
	if (n.y > 0.5) {
		float g = hash(floor(wpos.xz * 1.5));
		ALBEDO = pow(vec3(0.40, 0.395, 0.39) * (0.85 + 0.15 * g), vec3(2.2));
		ROUGHNESS = 0.95;
	} else {
		float u = abs(n.x) > 0.5 ? wpos.z : wpos.x;
		float y = wpos.y;
		float fh = 3.6;
		float ww = 3.0;
		if (style == 3) { fh = 4.2; ww = 1.6; }
		if (style == 1) { ww = 2.6; }
		vec2 cell = vec2(u / ww, y / fh);
		vec2 id = floor(cell) + seed;
		vec2 f = fract(cell);
		float win;
		if (style == 3) {
			win = step(0.1, f.y) * step(f.x, 0.93);
		} else {
			win = step(0.24, f.x) * step(f.x, 0.76) * step(0.24, f.y) * step(f.y, 0.80);
		}
		float h = hash(id);
		vec3 wall = bcol * (0.9 + 0.12 * hash(vec2(id.y, seed)));
		float sky = clamp(y / 140.0, 0.0, 1.0);
		vec3 glass = mix(vec3(0.13, 0.18, 0.25), vec3(0.50, 0.63, 0.76), 0.25 + 0.45 * h * h + 0.25 * sky);
		if (style == 3) glass = mix(vec3(0.2, 0.3, 0.38), vec3(0.55, 0.7, 0.82), 0.3 + 0.4 * h * 0.5 + 0.3 * sky);
		if (h > 0.94) glass = vec3(0.78, 0.7, 0.52);
		vec3 col = mix(wall, glass, win);
		float rough = mix(0.88, 0.12, win);
		float metal = mix(0.0, 0.25, win);
		// floor ledge lines on masonry
		if (style != 3) {
			float ledge = step(0.93, f.y);
			col = mix(col, wall * 1.15, ledge * (1.0 - win));
		}
		// cornice just under the roof
		float cor = step(top - 1.2, y);
		col = mix(col, wall * 0.75, cor);
		// ground floor storefronts
		if (y < 5.0) {
			float sf = step(0.1, fract(u / 6.5)) * step(0.5, y) * step(y, 4.0);
			float band = step(4.0, y) * step(y, 4.9);
			col = mix(bcol * 0.55, vec3(0.1, 0.12, 0.14), sf);
			col = mix(col, vec3(0.16, 0.2, 0.22), band);
			rough = mix(0.8, 0.15, sf);
			metal = 0.0;
		}
		col *= mix(0.72, 1.0, clamp(y / 8.0, 0.0, 1.0));
		ALBEDO = pow(col, vec3(2.2));
		ROUGHNESS = rough;
		METALLIC = metal;
	}
}
