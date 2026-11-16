// Lumen Drift — tuning constants. One place for every number that shapes the
// feel of the game, so balance can be adjusted without touching the logic.
export const CONFIG = {
  // Reference playfield the tuning was built for; speeds and sizes scale
  // with the real canvas through world.scale.
  refWidth: 960,
  refHeight: 600,

  // The mote (player lantern).
  moteRadius: 13,
  moteSpeed: 265,          // px/s at scale 1
  moteAccel: 2400,         // px/s^2 toward the desired velocity
  moteFriction: 6.5,       // damping when no input is held
  dashSpeed: 820,          // burst speed while dashing
  dashTime: 0.18,          // seconds a dash lasts
  dashCooldown: 1.15,      // seconds before the next dash
  dashInvuln: 0.3,         // seconds of protection granted by a dash
  hitInvuln: 1.4,          // seconds of protection after taking a hit
  trailLength: 14,         // positions kept for the light trail

  // Lives and the win condition.
  startLives: 3,
  winWave: 10,             // reaching this wave wins the run (Dawn)
  shardsPerWave: 15,       // shards collected to advance one wave

  // Light shards (score pickups).
  shardRadius: 9,
  shardValue: 10,
  shardSpawnEvery: 0.65,   // seconds between shard spawns
  shardMax: 14,            // most shards alive at once
  shardLife: 14,           // seconds before a shard fades away
  shardDrift: 14,          // px/s idle drift
  comboWindow: 2.5,        // seconds to keep the combo alive
  comboStep: 5,            // combo hits per +1 multiplier
  comboMax: 8,             // highest multiplier

  // Shadow wisps (enemies).
  wispRadius: 15,
  wispBaseSpeed: 62,       // px/s at wave 1
  wispSpeedPerWave: 11,    // extra px/s per wave
  wispMaxSpeed: 235,
  wispSpawnEvery: 2.4,     // seconds between wisp spawns at wave 1
  wispSpawnFloor: 0.85,    // fastest spawn interval
  wispSpawnStep: 0.16,     // seconds shaved off per wave
  wispMax: 16,             // most wisps alive at once
  wispWander: 0.9,         // radians of steering noise
  wispChase: 0.55,         // how strongly a wisp steers at the mote

  // Power-ups (shield, magnet, slow).
  powerupRadius: 12,
  powerupEvery: 17,        // seconds between power-up spawns
  shieldTime: 10,
  magnetTime: 8,
  magnetRadius: 230,
  slowTime: 6,
  slowFactor: 0.45,        // wisp speed multiplier while slowed

  // Juice: particles, shake, floating text.
  particleBurst: 16,       // particles per shard pickup
  hitBurst: 26,
  shakeOnHit: 9,
  shakeOnDash: 2.5,
  shakeDecay: 26,

  // Cosmetic background.
  stars: 110,
  dust: 46,
};
