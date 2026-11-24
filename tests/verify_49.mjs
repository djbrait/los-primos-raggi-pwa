import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { GameEngine } from '../public/js/engine.js';
import { buildLevels, GROUND_Y, VIEW_H } from '../public/js/levels.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PUBLIC = path.join(ROOT, 'public');

// Mock silencioso de SoundManager para pruebas automatizadas
function createMockSound() {
  const calls = [];
  return new Proxy({ calls }, {
    get(target, prop) {
      if (prop === 'calls') return calls;
      return (...args) => calls.push([String(prop), args]);
    },
  });
}

function createTestEngine(overrides = {}) {
  const events = { toasts: [], transitions: [], gameOvers: 0, victories: 0, lastHud: null };
  const sound = createMockSound();
  const engine = new GameEngine({}, sound, {
    onHudUpdate: (h) => { events.lastHud = h; },
    onToast: (m) => events.toasts.push(m),
    onTransition: (title, cb) => events.transitions.push({ title, cb }),
    onGameOver: () => { events.gameOvers += 1; },
    onVictory: () => { events.victories += 1; },
    ...overrides,
  });
  return { engine, events, sound };
}

function stepFrames(engine, frames, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) {
    engine.update(dt);
  }
}

const tests = [];
function test(num, name, fn) {
  tests.push({ num, name, fn });
}

// =========================================================================
// BLOQUE 1: ASSETS, BRANDING, ESPAÑOL LATINO, PEPE Y TRONCOS (Pruebas 1-14)
// =========================================================================
test(1, 'Logo principal "Los Primos Raggi" existe en assets/logo.png', () => {
  assert.ok(fs.existsSync(path.join(PUBLIC, 'assets/logo.png')));
});

test(2, 'PWA manifest.webmanifest existe en español latino con nombre "Los Primos Raggi"', () => {
  const m = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Los Primos Raggi');
  assert.equal(m.lang, 'es-419');
});

test(3, 'Service Worker sw.js usa Network-First (nunca sirve música/código viejo) e iconos PWA existen', () => {
  const swCode = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
  assert.ok(swCode.includes('fetch(event.request)'), 'sw.js debe priorizar red (network-first)');
  assert.ok(fs.existsSync(path.join(PUBLIC, 'assets/icon-192.png')));
  assert.ok(fs.existsSync(path.join(PUBLIC, 'assets/icon-512.png')));
});

test(4, 'HTML está en español latino y muestra botones 1 JUGADOR y 2 JUGADORES', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  assert.ok(html.includes('lang="es-419"'));
  assert.ok(html.includes('1 JUGADOR'));
  assert.ok(html.includes('2 JUGADORES'));
});

test(5, 'Todos los 6 sprites de Lucio Normal existen', () => {
  for (const p of ['idle', 'walk', 'run', 'jump', 'crouch', 'win']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/lucio_${p}.png`)), p);
  }
});

test(6, 'Todos los 6 sprites de Nacho Normal existen', () => {
  for (const p of ['idle', 'walk', 'run', 'jump', 'crouch', 'win']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/nacho_${p}.png`)), p);
  }
});

test(7, 'Todos los 6 sprites de Lucio Espada y Nacho Espada existen', () => {
  for (const who of ['lucio', 'nacho']) {
    for (const p of ['idle', 'walk', 'run', 'jump', 'crouch', 'attack']) {
      assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/${who}_sword_${p}.png`)), `${who}_${p}`);
    }
  }
});

test(8, 'Todos los 6 sprites de Lucio Dorado y Nacho Dorado existen', () => {
  for (const who of ['lucio', 'nacho']) {
    for (const p of ['idle', 'fly', 'fastfly', 'ascend', 'descend', 'win']) {
      assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/${who}_gold_${p}.png`)), `${who}_${p}`);
    }
  }
});

test(9, 'Sprites de Mateo (caminando y atacando) y Erin (volando, atacando y meteorito) existen', () => {
  for (const f of ['mateo_walk', 'mateo_attack', 'erin_fly', 'erin_attack', 'meteorite']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/${f}.png`)), f);
  }
});

test(10, 'Sprites de LuckyBlock y ambas Popos (Marrón y Naranja) existen', () => {
  for (const f of ['luckyblock', 'popo_brown', 'popo_orange']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/${f}.png`)), f);
  }
});

test(11, 'Todos los 4 sprites del Jefe Final Abruk existen', () => {
  for (const p of ['idle', 'run', 'jump', 'attack']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/abruk_${p}.png`)), p);
  }
});

test(12, 'Pepe la Rana (pepe_idle.png, pepe_jump.png y pepe.png) extraído y listo', () => {
  for (const f of ['pepe_idle', 'pepe_jump', 'pepe']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/${f}.png`)), f);
  }
});

test(13, 'Los 4 Troncos / Tubos de madera del usuario (trunk_1..4 y wooden_pipe) existen', () => {
  for (const f of ['trunk_1', 'trunk_2', 'trunk_3', 'trunk_4', 'wooden_pipe']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/sprites/${f}.png`)), f);
  }
});

test(14, 'Fondos y suelos de los 3 niveles (Bosque, Aldea Abandonada, Debajo del Agua) existen', () => {
  for (const f of ['level1_forest.jpg', 'level2_village.jpg', 'level3_underwater.jpg', 'ground_forest.png', 'ground_village.png', 'ground_underwater.png']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `assets/bg/${f}`)), f);
  }
});

// =========================================================================
// BLOQUE 2: MODO 1 JUGADOR VS 2 JUGADORES, TAMAÑOS Y CONTROLES (Pruebas 15-24)
// =========================================================================
test(15, 'Modo 1 Jugador crea SOLAMENTE a Lucio (nunca aparece Nacho)', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  assert.equal(engine.mode, 1);
  assert.equal(engine.players.length, 1);
  assert.equal(engine.players[0].name, 'Lucio');
});

test(16, 'Modo 2 Jugadores crea a Lucio (J1) y Nacho (J2)', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(2);
  assert.equal(engine.mode, 2);
  assert.equal(engine.players.length, 2);
  assert.equal(engine.players[0].name, 'Lucio');
  assert.equal(engine.players[1].name, 'Nacho');
});

test(17, 'Lucio es más bajito que Nacho (tanto visualmente como en hitbox)', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(2);
  const [lucio, nacho] = engine.players;
  assert.ok(lucio.renderHeight < nacho.renderHeight);
  assert.ok(lucio.standH < nacho.standH);
});

test(18, 'Cada jugador comienza con exactamente 3 vidas (corazones) y 15 golpes de resistencia', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(2);
  for (const p of engine.players) {
    assert.equal(p.hearts, 3);
    assert.equal(p.hits, 15);
    assert.equal(p.maxHits, 15);
  }
});

test(19, 'Controles de Lucio: Flechas (ArrowRight mueve a Lucio a la derecha)', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  const x0 = lucio.x;
  engine.handleKeyDown('ArrowRight');
  stepFrames(engine, 20);
  assert.ok(lucio.x > x0 + 60, `Lucio debería avanzar rápido (x0=${x0}, x=${lucio.x})`);
});

test(20, 'Lucio golpea con la espada con la tecla "1" (Digit1 / Numpad1) y elimina enemigos', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  assert.deepEqual(lucio.controls.attack, ['Digit1', 'Numpad1']);
  lucio.power = 'sword';
  lucio.swordHits = 3;
  const mateo = engine.enemies.find((e) => e.type === 'mateo');
  lucio.x = mateo.x - 40;
  lucio.y = mateo.y;
  lucio.facing = 1;
  engine.handleKeyDown('Digit1');
  engine.update(1 / 60);
  assert.ok(lucio.attackTimer > 0, 'Lucio debería atacar con la tecla 1');
  assert.equal(mateo.alive, false, 'La espada con tecla 1 debe derrotar a Mateo');
});

test(21, 'Controles de Lucio: ArrowUp salta y ArrowDown agacha reduciendo altura', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  stepFrames(engine, 5); // aterrizar
  assert.ok(lucio.onGround);
  engine.handleKeyDown('ArrowDown');
  stepFrames(engine, 2);
  assert.ok(lucio.crouching);
  assert.equal(lucio.h, lucio.crouchH);
  engine.handleKeyUp('ArrowDown');
  engine.handleKeyDown('ArrowUp');
  stepFrames(engine, 3);
  assert.ok(lucio.vy < -400);
});

test(22, 'Controles de Nacho en 2P: A W S D mueven, saltan y agachan a Nacho sin mover a Lucio', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(2);
  const [lucio, nacho] = engine.players;
  stepFrames(engine, 5);
  const lucioX0 = lucio.x;
  const nachoX0 = nacho.x;
  engine.handleKeyDown('KeyD');
  stepFrames(engine, 18);
  assert.equal(lucio.x, lucioX0);
  assert.ok(nacho.x > nachoX0 + 50);
  engine.handleKeyUp('KeyD');
  engine.handleKeyDown('KeyW');
  stepFrames(engine, 3);
  assert.ok(nacho.vy < -400);
});

test(23, 'Nacho agachado con KeyS reduce su altura correctamente', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(2);
  const nacho = engine.players[1];
  stepFrames(engine, 5);
  engine.handleKeyDown('KeyS');
  stepFrames(engine, 2);
  assert.ok(nacho.crouching);
  assert.equal(nacho.h, nacho.crouchH);
});

test(24, 'Velocidad de movimiento mejorada (>= 450 px/s) para que NO se sienta lento', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  stepFrames(engine, 4);
  engine.handleKeyDown('ArrowRight');
  stepFrames(engine, 30);
  assert.ok(lucio.vx >= 450, `Velocidad esperada >=450, actual=${lucio.vx}`);
});

// =========================================================================
// BLOQUE 3: SISTEMA DE 15 GOLPES, 3 CORAZONES, POZOS Y MUERTE INDIVIDUAL (Pruebas 25-31)
// =========================================================================
test(25, 'Recibir 1 golpe resta exactamente 1 de los 15 golpes sin quitar corazón todavía', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  lucio.hurtInvuln = 0;
  engine._hurtPlayer(lucio, lucio.x + 50);
  assert.equal(lucio.hits, 14);
  assert.equal(lucio.hearts, 3);
  assert.ok(lucio.alive);
});

test(26, 'Recibir 14 golpes deja vivo al jugador con 1/15 y 3 corazones', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  for (let i = 0; i < 14; i++) {
    lucio.hurtInvuln = 0;
    engine._hurtPlayer(lucio, lucio.x + 40);
  }
  assert.equal(lucio.hits, 1);
  assert.equal(lucio.hearts, 3);
  assert.ok(lucio.alive);
});

test(27, 'El golpe número 15 mata al jugador, desaparece y le quita 1 corazón', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  for (let i = 0; i < 15; i++) {
    lucio.hurtInvuln = 0;
    engine._hurtPlayer(lucio, lucio.x + 40);
  }
  assert.equal(lucio.alive, false);
  assert.equal(lucio.hearts, 2);
  assert.equal(lucio.eliminated, false);
});

test(28, 'Tras perder 1 corazón, el jugador reaparece con 15/15 golpes y 2 corazones', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  lucio.hurtInvuln = 0;
  engine._killPlayerHeart(lucio, 'test');
  assert.equal(lucio.alive, false);
  assert.equal(lucio.hearts, 2);
  stepFrames(engine, 80); // > 1.15s respawn
  assert.equal(lucio.alive, true);
  assert.equal(lucio.hits, 15);
  assert.equal(lucio.hearts, 2);
});

test(29, 'Caer a un pozo quita 1 corazón inmediatamente', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  lucio.x = 1150;
  lucio.y = VIEW_H + 100;
  engine.update(1 / 60);
  assert.equal(lucio.hearts, 2);
  assert.equal(lucio.alive, false);
});

test(30, 'En 2P, si Lucio pierde sus 3 corazones NO vuelve a reaparecer SOLO Lucio (Nacho sigue jugando!)', () => {
  const { engine, events } = createTestEngine();
  engine.startNewGame(2);
  const [lucio, nacho] = engine.players;
  for (let i = 0; i < 3; i++) {
    lucio.alive = true;
    engine._killPlayerHeart(lucio, 'test');
  }
  stepFrames(engine, 100);
  assert.equal(lucio.hearts, 0);
  assert.equal(lucio.eliminated, true);
  assert.equal(lucio.alive, false);
  assert.equal(nacho.eliminated, false);
  assert.equal(nacho.alive, true);
  assert.equal(engine.state, 'playing');
  assert.equal(events.gameOvers, 0);
});

test(31, 'Game Over solo ocurre cuando TODOS los jugadores pierden sus 3 corazones', () => {
  const { engine, events } = createTestEngine();
  engine.startNewGame(2);
  for (const p of engine.players) {
    for (let i = 0; i < 3; i++) {
      p.alive = true;
      engine._killPlayerHeart(p, 'test');
    }
  }
  engine.update(1 / 60);
  assert.equal(engine.state, 'gameover');
  assert.equal(events.gameOvers, 1);
});

// =========================================================================
// BLOQUE 4: LUCKYBLOCKS, POPO MARRÓN (ESPADA 3 GOLPES) Y POPO NARANJA (DORADO 16s) (Pruebas 32-38)
// =========================================================================
test(32, 'Hay pocos LuckyBlocks (<= 3 por nivel), NO se recargan y sacan Popo Marrón o Naranja', () => {
  const levels = buildLevels();
  for (const lv of levels) {
    assert.ok(lv.luckyBlocks.length >= 2 && lv.luckyBlocks.length <= 3, `${lv.name} tiene demasiados LuckyBlocks: ${lv.luckyBlocks.length}`);
    for (const b of lv.luckyBlocks) {
      assert.ok(!b.regenerates, 'Ningún LuckyBlock debe recargarse');
    }
  }
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  engine.loadLevel(2, false);
  const block = engine.blocks[engine.blocks.length - 1];
  engine._triggerLuckyBlock(block, engine.players[0]);
  assert.equal(block.used, true);
  assert.equal(engine.items.length, 1);
  assert.ok(['brown', 'orange'].includes(engine.items[0].kind));
  // Esperar 20 segundos simulados -> el bloque NUNCA debe recargarse!
  for (let i = 0; i < 500; i++) engine._updateBlocks(0.04);
  assert.equal(block.used, true, 'El LuckyBlock no debe recargarse nunca');
});

test(33, 'Popo Marrón otorga la Espada al jugador y dura hasta recibir 3 golpes', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  engine.items.push({ kind: 'brown', x: lucio.x, y: lucio.y, w: 44, h: 44, vx: 0, vy: 0, alive: true, life: 10, animTime: 0 });
  engine._updateItems(1 / 60);
  assert.equal(lucio.power, 'sword');
  assert.equal(lucio.swordHits, 3);

  // 2 golpes -> sigue con espada
  for (let i = 0; i < 2; i++) {
    lucio.hurtInvuln = 0;
    engine._hurtPlayer(lucio, lucio.x + 50);
  }
  assert.equal(lucio.power, 'sword');
  assert.equal(lucio.swordHits, 1);

  // 3er golpe -> se termina el efecto de la espada
  lucio.hurtInvuln = 0;
  engine._hurtPlayer(lucio, lucio.x + 50);
  assert.equal(lucio.power, 'none');
  assert.equal(lucio.swordHits, 0);
});

test(34, 'Popo Naranja vuelve Dorado al jugador por 16 segundos exactos', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  engine.items.push({ kind: 'orange', x: lucio.x, y: lucio.y, w: 44, h: 44, vx: 0, vy: 0, alive: true, life: 10, animTime: 0 });
  engine._updateItems(1 / 60);
  assert.equal(lucio.power, 'gold');
  assert.equal(lucio.goldTimer, 16.0);
});

test(35, 'En Modo Dorado el jugador vuela libremente hacia arriba con ArrowUp', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  lucio.power = 'gold';
  lucio.goldTimer = 16.0;
  const y0 = lucio.y;
  engine.handleKeyDown('ArrowUp');
  stepFrames(engine, 20);
  assert.ok(lucio.y < y0 - 60);
});

test(36, 'En Modo Dorado el jugador es inmune al dolor y al pasar encima de Mateo o Erin los mata', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(2);
  const [lucio, nacho] = engine.players;
  lucio.power = 'gold';
  lucio.goldTimer = 16.0;
  nacho.power = 'gold';
  nacho.goldTimer = 16.0;

  // Inmune al daño
  lucio.hurtInvuln = 0;
  engine._hurtPlayer(lucio, lucio.x + 50);
  assert.equal(lucio.hits, 15);
  assert.equal(lucio.hearts, 3);

  // Lucio dorado pasa encima/por Mateo -> mata a Mateo
  const mateo = engine.enemies.find((e) => e.type === 'mateo');
  lucio.x = mateo.x;
  lucio.y = mateo.y;
  lucio.vy = 0;
  engine.update(1 / 60);
  assert.equal(mateo.alive, false, 'Modo Dorado debe matar a Mateo al pasarle encima');

  // Nacho dorado pasa encima/por Erin (con cámara centrada en Erin) -> mata a Erin
  const erin = engine.enemies.find((e) => e.type === 'erin');
  engine.cameraX = erin.x - 400;
  lucio.x = erin.x - 80;
  erin.y = erin.baseY + Math.sin(erin.animTime * 2.6) * 20;
  nacho.x = erin.x;
  nacho.y = erin.y;
  nacho.vy = 0;
  engine.update(1 / 60);
  assert.equal(erin.alive, false, 'Modo Dorado debe matar a Erin al pasarle encima');
});

test(37, 'En Modo Dorado, si cae a un pozo se muere igual (pierde 1 corazón)', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  lucio.power = 'gold';
  lucio.goldTimer = 16.0;
  lucio.x = 1150;
  lucio.y = VIEW_H + 100;
  engine.update(1 / 60);
  assert.equal(lucio.hearts, 2);
  assert.equal(lucio.alive, false);
});

test(38, 'El Modo Dorado termina automáticamente después de 16 segundos', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  lucio.power = 'gold';
  lucio.goldTimer = 16.0;
  // Avanzar 16.1 segundos manteniendo a Lucio quieto sobre suelo seguro
  for (let i = 0; i < 405; i++) {
    engine.update(0.04);
  }
  assert.equal(lucio.power, 'none');
  assert.equal(lucio.goldTimer, 0);
});

// =========================================================================
// BLOQUE 5: ENEMIGOS (MATEOS & ERINS), NIVELES, TUBOS, ABRUK Y PEPE (Pruebas 39-49)
// =========================================================================
test(39, 'Los 3 niveles son largos (> 5500px), tienen pozos, troncos, Mateos, Erins y pocos LuckyBlocks', () => {
  const levels = buildLevels();
  assert.equal(levels.length, 3);
  for (const lv of levels) {
    assert.ok(lv.width >= 5500, lv.name);
    assert.ok(lv.groundSegments.length >= 4, `${lv.name} debe tener pozos`);
    assert.ok(lv.platforms.some((p) => p.kind === 'log'), `${lv.name} debe tener troncos`);
    assert.ok(lv.luckyBlocks.length >= 2 && lv.luckyBlocks.length <= 3, `${lv.name} debe tener pocos LuckyBlocks`);
    assert.ok(lv.enemies.some((e) => e.type === 'mateo'), `${lv.name} debe tener Mateos`);
    assert.ok(lv.enemies.some((e) => e.type === 'erin'), `${lv.name} debe tener Erins`);
  }
});

test(40, 'Mateo camina izquierda/derecha y ataca con espada cuando el jugador se acerca', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const mateo = engine.enemies.find((e) => e.type === 'mateo');
  const lucio = engine.players[0];
  const mx0 = mateo.x;
  stepFrames(engine, 15);
  assert.notEqual(mateo.x, mx0);
  // Acercar a Lucio para provocar ataque con espada
  mateo.attackCooldown = 0;
  lucio.x = mateo.x - 90;
  lucio.y = mateo.y;
  engine.update(1 / 60);
  assert.ok(mateo.attackTimer > 0, 'Mateo debería activar su ataque con espada');
});

test(41, 'Erin vuela y lanza meteoritos cuando un jugador está cerca', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const erin = engine.enemies.find((e) => e.type === 'erin');
  const lucio = engine.players[0];
  lucio.x = erin.x - 100;
  erin.shootTimer = 0.01;
  engine.update(1 / 60);
  assert.ok(engine.meteorites.length >= 1, 'Erin debería lanzar un meteorito');
  assert.ok(erin.attackTimer > 0);
});

test(42, 'Saltar encima de un Mateo lo elimina y hace rebotar al jugador', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const mateo = engine.enemies.find((e) => e.type === 'mateo');
  const lucio = engine.players[0];
  lucio.x = mateo.x + 4;
  lucio.y = mateo.y - lucio.h + 8;
  lucio.vy = 400;
  engine.update(1 / 60);
  assert.equal(mateo.alive, false);
  assert.ok(lucio.vy < -300);
});

test(43, 'Saltar encima de una Erin voladora la elimina', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const erin = engine.enemies.find((e) => e.type === 'erin');
  const lucio = engine.players[0];
  // Sincronizar posición exacta de Erin y hacer caer a Lucio sobre su cabeza
  erin.y = erin.baseY + Math.sin(erin.animTime * 2.6) * 20;
  lucio.x = erin.x + 10;
  lucio.y = erin.y - lucio.h + 10;
  lucio.vy = 320;
  stepFrames(engine, 2);
  assert.equal(erin.alive, false);
});

test(44, 'Tubos-tronco conectados como cuerda: bajar en Tubo A lleva a Tubo B, y bajar en Tubo B devuelve a Tubo A (nunca infinito)', () => {
  // Verificar que todos los pares en los 3 niveles son estrictamente bidireccionales A <-> B
  for (const lv of buildLevels()) {
    const warps = lv.platforms.filter((pl) => pl.warpId && pl.warpTarget);
    assert.ok(warps.length >= 2, `${lv.name} debe tener al menos un par de tubos conectados`);
    for (const w of warps) {
      const pair = warps.find((o) => o.warpId === w.warpTarget);
      assert.ok(pair, `Destino faltante ${w.warpTarget}`);
      assert.equal(pair.warpTarget, w.warpId, `Par ${w.warpId} <-> ${pair.warpId} debe ser ida y vuelta como cuerda`);
    }
  }

  const { engine } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];
  const pipeA = engine.level.platforms.find((pl) => pl.warpId === 'l1_a1');
  const pipeB = engine.level.platforms.find((pl) => pl.warpId === 'l1_a2');

  // Parar a Lucio sobre Tubo A y presionar Abajo -> viaja adelante al Tubo B
  lucio.x = pipeA.x + 25;
  lucio.y = pipeA.y - lucio.h;
  lucio.onGround = true;
  engine.handleKeyDown('ArrowDown');
  engine.update(1 / 60);
  engine.handleKeyUp('ArrowDown');
  assert.ok(lucio.warpAnim && lucio.warpAnim.toPipe === pipeB, 'Tubo A debe llevar hacia adelante al Tubo B');
  stepFrames(engine, 45);
  assert.equal(lucio.warpAnim, null);
  assert.ok(Math.abs(lucio.x - (pipeB.x + (pipeB.w - lucio.w) / 2)) < 4, 'Lucio debe salir exactamente en el Tubo B');

  // Esperar cooldown y volver a bajar en Tubo B -> debe devolverlo al Tubo A (el anterior!)
  stepFrames(engine, 45);
  engine.handleKeyDown('ArrowDown');
  engine.update(1 / 60);
  engine.handleKeyUp('ArrowDown');
  assert.ok(lucio.warpAnim && lucio.warpAnim.toPipe === pipeA, 'Tubo B debe devolver al Tubo A (anterior), nunca infinito');
  stepFrames(engine, 45);
  assert.ok(Math.abs(lucio.x - (pipeA.x + (pipeA.w - lucio.w) / 2)) < 4, 'Lucio debe salir de regreso en el Tubo A');
});

test(45, 'Tubos de madera de salida pasan de Nivel 1->2->3 y Nivel 3 tiene mucha menos gravedad por estar bajo el agua', () => {
  const { engine, events } = createTestEngine();
  engine.startNewGame(1);
  const lucio = engine.players[0];

  // Salida Nivel 1 -> Nivel 2
  const ep1 = engine.level.exitPipe;
  lucio.x = ep1.x + 25;
  lucio.y = ep1.y - lucio.h;
  lucio.onGround = true;
  engine.update(1 / 60);
  assert.equal(engine.state, 'pipe_out');
  events.transitions[0].cb();
  assert.equal(engine.levelIndex, 1);

  // Salida Nivel 2 -> Nivel 3 (Debajo del agua)
  const ep2 = engine.level.exitPipe;
  lucio.x = ep2.x + 25;
  lucio.y = ep2.y - lucio.h;
  lucio.onGround = true;
  engine.update(1 / 60);
  assert.equal(engine.state, 'pipe_out');
  events.transitions[1].cb();
  assert.equal(engine.levelIndex, 2);
  assert.equal(engine.level.isUnderwater, true);

  // Verificar menor gravedad y caída lenta/flotante bajo el agua en Nivel 3
  const landPhys = engine.getPhysics(false);
  const waterPhys = engine.getPhysics(true);
  assert.ok(waterPhys.gravity < landPhys.gravity * 0.45, `Gravedad submarina (${waterPhys.gravity}) debe ser mucho menor que tierra (${landPhys.gravity})`);
  assert.ok(waterPhys.maxFall <= 300, `Caída bajo el agua debe ser flotante (maxFall=${waterPhys.maxFall})`);

  // Comprobar en simulación que saltar en Nivel 3 mantiene al jugador flotando más tiempo
  stepFrames(engine, 5);
  engine.handleKeyDown('ArrowUp');
  engine.update(1 / 60);
  engine.handleKeyUp('ArrowUp');
  stepFrames(engine, 48); // 0.8s después del salto -> en agua aún sigue flotando en el aire!
  assert.equal(lucio.onGround, false, 'En Nivel 3 (bajo el agua) el salto debe durar más tiempo en el aire por la baja gravedad');
});

test(46, 'Jefe Final Abruk salta hacia el jugador golpeando con su hueso y cambia la música en bucle a Audio 2 (boss)', () => {
  assert.ok(fs.existsSync(path.join(PUBLIC, 'assets/audio/bgm_main.mp3')));
  assert.ok(fs.existsSync(path.join(PUBLIC, 'assets/audio/bgm_boss.mp3')));
  const audioCode = fs.readFileSync(path.join(PUBLIC, 'js/audio.js'), 'utf8');
  assert.ok(audioCode.includes('bgm_main.mp3') && audioCode.includes('bgm_boss.mp3') && audioCode.includes('el.loop = true'));

  const { engine, sound } = createTestEngine();
  engine.startNewGame(1);
  assert.ok(sound.calls.some(([fn, args]) => fn === 'playMusic' && args[0] === 'main'));
  engine.loadLevel(2, false);
  const lucio = engine.players[0];
  lucio.x = engine.level.bossArena.triggerX + 20;
  engine.update(1 / 60);
  assert.equal(engine.bossActive, true);
  assert.ok(sound.calls.some(([fn, args]) => fn === 'playMusic' && args[0] === 'boss'));

  // Abruk inicia su ataque saltando hacia Lucio intentando golpearlo con su hueso!
  engine._startBossJumpAttack(engine.boss, lucio);
  assert.equal(engine.boss.aiState, 'attack');
  assert.ok(engine.boss.vy < -500, 'Abruk debe saltar al atacar');
  assert.ok(engine.boss.vx < 0, 'Abruk debe saltar en dirección al jugador');
  // Simular aterrizaje con impacto del hueso
  stepFrames(engine, 70);
  assert.ok(engine.boss.attackHitDone, 'Abruk debe completar el golpe del hueso al caer');
});

test(47, 'Al vencer a Abruk se abre el paso para seguir caminando hacia Pepe', () => {
  const { engine } = createTestEngine();
  engine.startNewGame(1);
  engine.loadLevel(2, false);
  engine.bossActive = true;
  assert.equal(engine.gateOpen, false);
  for (let i = 0; i < 12; i++) {
    engine.boss.hurtInvuln = 0;
    engine._damageBoss(1, engine.players[0]);
  }
  assert.equal(engine.boss.alive, false);
  assert.equal(engine.bossDefeated, true);
  assert.equal(engine.gateOpen, true);
});

test(48, 'Caminar hasta Pepe tras vencer a Abruk rescata a Pepe y dispara la victoria final', () => {
  const { engine, events } = createTestEngine();
  engine.startNewGame(1);
  engine.loadLevel(2, false);
  engine.bossActive = true;
  engine.bossDefeated = true;
  engine.gateOpen = true;
  engine.boss.alive = false;
  const lucio = engine.players[0];
  lucio.x = engine.level.pepe.x - 30;
  engine.update(1 / 60);
  assert.equal(engine.pepeRescued, true);
  assert.equal(engine.state, 'victory_walk');
  stepFrames(engine, 140);
  assert.equal(engine.state, 'victory');
  assert.equal(events.victories, 1);
});

test(49, 'Rendimiento óptimo: renderer.js NO usa ctx.shadowBlur ni ctx.filter y 600 frames simulan en < 80ms', () => {
  const rendCode = fs.readFileSync(path.join(PUBLIC, 'js/renderer.js'), 'utf8');
  assert.ok(!rendCode.includes('ctx.shadowBlur'), 'renderer.js no debe usar ctx.shadowBlur (lento)');
  assert.ok(!rendCode.includes('ctx.filter'), 'renderer.js no debe usar ctx.filter (lento)');

  const { engine } = createTestEngine();
  engine.startNewGame(2);
  engine.handleKeyDown('ArrowRight');
  engine.handleKeyDown('KeyD');
  const t0 = performance.now();
  stepFrames(engine, 600, 1 / 60); // 10 segundos de juego simulados
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 80, `Simulación demasiado lenta: ${elapsed.toFixed(2)}ms`);
});

// =========================================================================
// EJECUTOR DE LAS 49 PRUEBAS
// =========================================================================
assert.equal(tests.length, 49, `Se esperaban 49 pruebas, hay ${tests.length}`);

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed += 1;
    console.log(`✅ [${String(t.num).padStart(2, '0')}/49] ${t.name}`);
  } catch (err) {
    failed += 1;
    console.error(`❌ [${String(t.num).padStart(2, '0')}/49] ${t.name}`);
    console.error('   ', err.message);
  }
}

console.log(`\nResultado final: ${passed}/49 pruebas aprobadas, ${failed} fallidas.`);
if (failed > 0) process.exit(1);
