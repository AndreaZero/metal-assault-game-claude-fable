# METAL ASSAULT — browser run & gun

A *Metal Slug*-style clone built entirely with **HTML5 Canvas + vanilla JavaScript**.
No dependencies, no build step, no external assets: pixel-art sprites, level, sound effects, and music are all procedurally generated in code.

## How to run

Open `index.html` in any modern browser (double-click is enough).
It also works via `file://`, no server required.

## Controls

| Key               | Action                                          |
| ----------------- | ----------------------------------------------- |
| Arrow keys / WASD | Move                                            |
| Down / S          | Crouch (Down + Jump on platforms: drop through) |
| Up / W            | Aim upward                                      |
| Space / K         | Jump                                            |
| J / Z             | Shoot (auto knife at close range)               |
| L / X             | Throw grenade (cannon while riding the SLUG)    |
| Enter             | Start / confirm                                 |
| P                 | Pause                                           |
| M                 | Toggle audio                                    |

## Gameplay

* **Two modes**: *Arcade Mission* (single mission ~7600px with final boss) and *Survival* (endless waves in an arena, separate high score). Mode selected from menu with Up/Down.
* **Enemies**: rifle soldiers, grenadiers, melee attackers, elite bazooka troops, sandbag turrets, helicopters, and tanks.
* **Mini-boss**: Gunship helicopter with HP bar, bullet spreads, and bombing runs.
* **Final boss**: General Morden’s armored fortress with arc cannon, machine gun, and infantry reinforcements. Enrages below 35% HP.
* **Chain combo**: close-range kills increase score multiplier (up to x3). Chain breaks if hit.
* **POWs**: rescue bound prisoners for points and weapon crates.
* **Weapons**: Pistol (infinite), Heavy Machine Gun (H), Spread (S), Rocket (R), Flame Shot (F), plus grenade stock (G).
* **Rideable SLUG tank**: hop in by touching it, drive with 3 armor points, turret machine gun (fire key, aim up supported), main cannon (grenade key), hop with Jump, eject with Down + Jump. It crushes infantry, blocks light bullets, and explodes ejecting the pilot when armor runs out. Parked along the mission and awarded every 6 survival waves.
* **Destructibles**: wooden crates (loot: weapons, grenades, points) and red explosive barrels that chain-react and damage everyone — bait enemies near them.
* **Boss phase 2**: below 60% HP the fortress loses its armor plating and starts telegraphed mortar rains (watch the blinking ground markers).
* **Lives**: 3 lives with respawn and temporary invincibility. Bonus score for remaining lives at end of mission. High scores saved in `localStorage`.
* **Game feel**: hit-stop on impact, recoil, shell casings, impact sparks, dust, screen shake, jump input buffering + coyote time, and adaptive music intensity that increases during bosses and late waves.

## Code structure

```
index.html      — page, canvas, script loader
js/audio.js     — WebAudio synthesis: sound effects + music loop
js/input.js     — keyboard handling (down / just-pressed)
js/sprites.js   — pixel art from character maps + rectangle-based vehicles
js/level.js     — terrain, platforms, parallax scenery, spawn table
js/entities.js  — player, enemy AI, bosses, bullets, explosions, POW, pickups
js/game.js      — fixed timestep loop (60 Hz), states, camera, HUD, menu
```
