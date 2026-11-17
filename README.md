# Lumen Drift

An original neon arcade game for the make.fun **best-game-01** bounty.

Guide the last lantern through the dark. Gather light shards to build a
combo, dodge the shadow wisps, grab power-ups, and carry the light through
all 10 waves to bring the Dawn.

- **Move:** WASD / arrow keys / mouse
- **Dash:** Space or click (brief shield while dashing — dash *through*
  wisps to destroy them for bonus score)
- **Pause:** P · **Mute:** M
- **Enemies:** chasers, telegraphed dashers (Wave 3+), splitters that break
  into minis (Wave 4+), armoured tanks that take two dash hits (Wave 5+)
- **Bosses:** the Gloom Warden guards Wave 5; the Umbral Sovereign must be
  beaten at Wave 10 before the Dawn. Dash through a boss to wound it.
- **Power-ups:** shield, magnet, slow time, extra life, and nova (purges
  the field and wounds the boss)
- **Win:** beat the Sovereign at Wave 10, then endless mode · **Lose:**
  run out of lives

Built with plain HTML + canvas + vanilla JavaScript. No libraries, no
network requests, no build step — open `game/index.html` in a desktop
browser and play. Sound is synthesized live with WebAudio.

Serve locally with `node serve.ts`, then open http://localhost:8080.

License: MIT.
