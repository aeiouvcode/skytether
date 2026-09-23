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

## Cycle 2 (sound, logic, UI, security)
- `scripts/synth.gd`: all audio synthesized in code (AudioStreamGenerator, 22.05 kHz): speed wind, web launch, landing thud, footsteps, chimes for crime stopped / district synced, soft alert for new crime. Output lowpassed and soft-clipped. Measured on a 10 s demo recording: mean -36.9 dB, peak -15.3 dB.
- Title gate: "TAP/CLICK TO PLAY" (also unlocks browser audio). Demo mode skips it.
- Traffic signals: streets along x and z alternate (9 s green, 1 s all-red); cars hold before the crossing.
- Minimap: lighter roads, darker blocks, lighter district fog.
- Facade shader fades the window grid to its average where it would alias (distant shimmer).
- JUMP button raised at phone sizes.
- `build.sh`: web export plus strict CSP (no unsafe-eval, no network). Query string read via JavaScriptBridge.get_interface, not eval.

## Honest gaps (cycle 1)
- Tether is a scripted pendulum constraint on the CharacterBody3D, not a PinJoint3D (PinJoint needs RigidBody).
- No car/pedestrian collision with the hero. Cars in the same lane can still overlap (no car-following).
- Facades read flatter and greyer than the reference.
- Crime resolution = reach the marker (no combat). District sync = reach the rooftop beacon.
- Phone frame rate not measured on a real device.
