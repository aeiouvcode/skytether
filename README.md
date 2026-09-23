# SKYTETHER

Open-world tether-swinging game in a procedural Manhattan-style grid city. Built with Three.js, no external assets: every texture, building, vehicle, tree and the hero are generated in code.

Play: open `index.html` (GitHub Pages serves the repo root).

## Controls
- Desktop: WASD move, mouse look, hold left click or E to tether-swing, release to launch, Space to jump / wall-kick, Shift to sprint, M for the map. Run into a wall to climb it.
- Phone: left thumb moves, right drag looks, hold TETHER to swing, JUMP to jump or kick off walls.

## What's in it
- 8 x 26 block city across five districts (Harbor Point, Foundry Row, Spire Heights, Greenline, Northgate) plus Warden Park
- Pendulum rope physics with raycast facade anchors, momentum on release, wall run / climb / vault
- Instanced traffic (taxis, cars, vans, buses) with signals and car-following, sidewalk pedestrians, autumn trees
- Sun with hard shadows, sky reflections on glass, avenue haze
- HUD: compass, rotating minimap, crime events with world beacons, district sync banner, XP

## Build
```
npm install three esbuild
./build.sh   # bundles src/ into dist/; copy dist/* to the repo root to publish
```
