# Engine TODO & Roadmap

## The Data-Driven Architecture Overhaul
- [ ] Create `/config/` directory.
- [ ] Create `player.json` (speed, sprint multiplier, jump height, gravity, hitbox).
- [ ] Create `entities.json` (array of mobs with health, behavior, speed, hitboxes).
- [ ] Create `properties.json` (block specific traits like `isCollidable`, replacing hardcoded `isPlant` logic).
- [ ] Update `AssetsCompiler.ts` to fetch and parse these JSONs on startup.
- [ ] Inject JSON stats into `Player.ts` and `Entity.ts` constructors.

## Future "Game Feel" Polish

- [ ] **Particle System:** Spawn miniature block textures with bouncing physics when a block is broken.
- [ ] **Custom Entity Textures:** Update WGSL UV mapping to wrap specific animal skins (Cow, Sheep) onto entity models.
- [ ] **Combat Knockback:** Apply directional velocity to entities when hit by the player.
