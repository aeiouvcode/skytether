# SKYTETHER (Godot track) - handoff

Godot 4.5.2, GL Compatibility renderer, web export without threads (works on GitHub Pages, no COOP/COEP needed).
Everything is generated in code from `main.tscn` -> `scripts/main.gd`.

## Files
- `scripts/city.gd` - 9x9 grid city (80 m pitch, 20 m streets), multimesh towers with facade shader, sidewalks, 2-block park with pond/paths/benches, autumn street trees, signal poles, water towers, far skyline, 4 districts + relay beacons, minimap layer (layer 20).
- `scripts/hero.gd` - CharacterBody3D: ground run/sprint, jump, swing (distance constraint to a raycast facade anchor, solved each tick; momentum kept on release), wall climb / wall run, ledge vault.
- `scripts/hero_model.gd` - original hero "Rook": graphite suit, teal panels, amber chevron + visor, procedural poses.
- `scripts/traffic.gd` - instanced cars, vans, pedestrians on lanes.
- `scripts/hud.gd` - objective card, progress, district banner, toasts, SubViewport minimap + compass.
- `scripts/touch.gd` - stick, look-drag, SWING/JUMP/SPRINT.
- `shaders/` - facade, road markings, sky with clouds.

## QA
- `--demo` (desktop) or `?demo=1` (web) runs a scripted autopilot for frame capture.
- `--touch` / `?touch=1` forces touch controls.
- Frames: `xvfb-run Godot --rendering-driver opengl3 --write-movie out.avi --fixed-fps 30 --quit-after 330 --resolution 1280x720 -- --demo`
- Web: `Godot --headless --export-release Web export/index.html`

## Honest gaps (cycle 1)
- Tether is a scripted pendulum constraint on the CharacterBody3D, not a PinJoint3D (PinJoint needs RigidBody).
- No car/pedestrian collision; cars pass through each other at intersections (no signals).
- Facades read flatter and greyer than the reference; far window grids alias.
- Minimap road contrast is weak.
- Crime resolution = reach the marker (no combat). District sync = reach the rooftop beacon.
- Phone frame rate not measured on a real device.
