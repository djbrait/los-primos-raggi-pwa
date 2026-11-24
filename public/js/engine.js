import { buildLevels, VIEW_W, VIEW_H, GROUND_Y } from './levels.js?v=6';

const MAX_HITS_PER_HEART = 15;
const START_HEARTS = 3;
const MAX_EXTRA_LIVES = 6;
const COIN_VALUE = 50;
const SHIELD_DURATION = 20.0;
const GOLD_DURATION = 16.0;
const SWORD_DURABILITY = 3;
const STORAGE_KEY = 'primosRaggi_save_v1';

export const SHOP_ITEMS = {
  life: {
    id: 'life',
    name: '+1 Vida',
    price: 500,
    desc: '+1 Vida: Un corazón extra para tener más oportunidades de vivir mientras juegas',
  },
  invis: {
    id: 'invis',
    name: 'Invisibilidad',
    price: 1000,
    desc: 'Invisibilidad: Personaje invisible sin que los enemigos lo puedan atacar, dura hasta perder un corazón',
  },
  shield: {
    id: 'shield',
    name: 'Protección',
    price: 2000,
    desc: 'Protección: Escudo protector para no recibir daño de los enemigos, temporalmente',
  },
};

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class GameEngine {
  constructor(assets, sound, callbacks) {
    this.assets = assets;
    this.sound = sound;
    this.cb = callbacks; // { onHudUpdate, onToast, onTransition, onGameOver, onVictory }

    this.mode = 1; // 1 = Solo Lucio, 2 = Lucio + Nacho
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'pipe_out' | 'gameover' | 'victory_walk' | 'victory'
    this.levels = buildLevels();
    this.levelIndex = 0;
    this.level = this.levels[0];

    this.keys = new Set();
    this.justPressed = new Set();

    this.cameraX = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.time = 0;

    this.players = [];
    this.blocks = [];
    this.coins = [];
    this.items = [];
    this.enemies = [];
    this.meteorites = [];
    this.shockwaves = [];
    this.particles = [];
    this.floatingTexts = [];
    this.ambientParticles = [];

    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.gateOpen = false;
    this.pepeRescued = false;
    this.victoryTimer = 0;

    this.pipeAnimTimer = 0;
    this.lastLuckyToggle = Math.random() < 0.5;

    // Estado persistente de monedas e inventario de la Tienda de Mia
    this.shop = this._loadShopState();

    this._initAmbient();
  }

  _loadShopState() {
    const defaults = { coins: 0, extraLives: 0, hasInvis: false, hasShield: false };
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            coins: Math.max(0, Number(parsed.coins) || 0),
            extraLives: clamp(Number(parsed.extraLives) || 0, 0, MAX_EXTRA_LIVES),
            hasInvis: !!parsed.hasInvis,
            hasShield: !!parsed.hasShield,
          };
        }
      }
    } catch {}
    return defaults;
  }

  _saveShopState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shop));
      }
    } catch {}
  }

  buyShopItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) return { ok: false, reason: 'Objeto inválido' };
    if (this.shop.coins < item.price) {
      return { ok: false, reason: 'No tienes suficientes monedas' };
    }
    if (itemId === 'life') {
      if (this.shop.extraLives >= MAX_EXTRA_LIVES) {
        return { ok: false, reason: 'Ya tienes el máximo de 6 vidas extra' };
      }
      this.shop.coins -= item.price;
      this.shop.extraLives += 1;
    } else if (itemId === 'invis') {
      if (this.shop.hasInvis) {
        return { ok: false, reason: 'Ya compraste Invisibilidad' };
      }
      this.shop.coins -= item.price;
      this.shop.hasInvis = true;
    } else if (itemId === 'shield') {
      if (this.shop.hasShield) {
        return { ok: false, reason: 'Ya compraste Protección' };
      }
      this.shop.coins -= item.price;
      this.shop.hasShield = true;
    }
    this._saveShopState();
    return { ok: true };
  }

  _initAmbient() {
    this.ambientParticles = [];
    for (let i = 0; i < 36; i++) {
      this.ambientParticles.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        r: 2 + Math.random() * 4.5,
        speed: 14 + Math.random() * 28,
        drift: (Math.random() - 0.5) * 20,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  handleKeyDown(code) {
    if (!this.keys.has(code)) {
      this.justPressed.add(code);
    }
    this.keys.add(code);
  }

  handleKeyUp(code) {
    this.keys.delete(code);
  }

  clearInput() {
    this.keys.clear();
    this.justPressed.clear();
  }

  startNewGame(mode) {
    this.mode = mode;
    this.levels = buildLevels();
    this.levelIndex = 0;
    const totalHearts = START_HEARTS + (this.shop.extraLives || 0);
    const startWithShield = !!this.shop.hasShield;
    if (startWithShield) {
      this.shop.hasShield = false;
      this._saveShopState();
    }
    this.players = this._createInitialPlayers(mode, totalHearts, startWithShield);
    this.loadLevel(0, true);
  }

  restartCurrentLevel() {
    // Restaurar vidas y resistencia al reintentar el nivel
    const totalHearts = START_HEARTS + (this.shop.extraLives || 0);
    this.players = this._createInitialPlayers(this.mode, totalHearts, false);
    this.loadLevel(this.levelIndex, true);
  }

  _createInitialPlayers(mode, totalHearts = START_HEARTS, startWithShield = false) {
    const lucio = {
      id: 1,
      name: 'Lucio',
      spriteBase: 'lucio',
      // Lucio es más bajito que Nacho
      renderHeight: 82,
      standW: 36,
      standH: 64,
      crouchH: 38,
      x: 110,
      y: GROUND_Y - 64,
      w: 36,
      h: 64,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      crouching: false,
      coyoteTimer: 0,
      jumpBuffer: 0,
      hearts: totalHearts,
      maxHearts: totalHearts,
      hits: MAX_HITS_PER_HEART,
      maxHits: MAX_HITS_PER_HEART,
      alive: true,
      eliminated: false,
      respawnTimer: 0,
      hurtInvuln: 0,
      power: 'none', // 'none' | 'sword' | 'gold'
      swordHits: 0,
      goldTimer: 0,
      invisible: false,
      shieldTimer: startWithShield ? SHIELD_DURATION : 0,
      attackTimer: 0,
      attackCooldown: 0,
      squashX: 1,
      squashY: 1,
      animTime: 0,
      warpAnim: null,
      warpCooldown: 0,
      pipeSlideY: 0,
      safeX: 110,
      safeY: GROUND_Y - 64,
      controls: {
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        up: ['ArrowUp'],
        down: ['ArrowDown'],
        attack: ['Digit1', 'Numpad1'],
      },
    };

    const list = [lucio];

    if (mode === 2) {
      const nacho = {
        id: 2,
        name: 'Nacho',
        spriteBase: 'nacho',
        // Nacho es más alto que Lucio
        renderHeight: 102,
        standW: 40,
        standH: 80,
        crouchH: 48,
        x: 56,
        y: GROUND_Y - 80,
        w: 40,
        h: 80,
        vx: 0,
        vy: 0,
        facing: 1,
        onGround: false,
        crouching: false,
        coyoteTimer: 0,
        jumpBuffer: 0,
        hearts: totalHearts,
        maxHearts: totalHearts,
        hits: MAX_HITS_PER_HEART,
        maxHits: MAX_HITS_PER_HEART,
        alive: true,
        eliminated: false,
        respawnTimer: 0,
        hurtInvuln: 0,
        power: 'none',
        swordHits: 0,
        goldTimer: 0,
        invisible: false,
        shieldTimer: startWithShield ? SHIELD_DURATION : 0,
        attackTimer: 0,
        attackCooldown: 0,
        squashX: 1,
        squashY: 1,
        animTime: 0,
        warpAnim: null,
        warpCooldown: 0,
        pipeSlideY: 0,
        safeX: 56,
        safeY: GROUND_Y - 80,
        controls: {
          left: ['KeyA'],
          right: ['KeyD'],
          up: ['KeyW'],
          down: ['KeyS'],
          attack: ['KeyF', 'KeyE', 'Space'],
        },
      };
      list.push(nacho);
    }

    return list;
  }

  loadLevel(index, showBanner = true) {
    this.levelIndex = index;
    this.levels = buildLevels();
    this.level = this.levels[index];
    this.cameraX = 0;
    this.shakeTimer = 0;
    this.state = 'playing';

    // Posicionar jugadores vivos al inicio del nivel
    this.players.forEach((p, idx) => {
      if (p.eliminated) return;
      p.alive = true;
      p.x = this.level.spawn.x - idx * 54;
      p.y = this.level.spawn.y - p.standH;
      p.w = p.standW;
      p.h = p.standH;
      p.vx = 0;
      p.vy = 0;
      p.facing = 1;
      p.onGround = false;
      p.crouching = false;
      p.hurtInvuln = 1.2;
      p.attackTimer = 0;
      p.attackCooldown = 0;
      p.safeX = p.x;
      p.safeY = p.y;
      p.pipeSlideY = 0;
      p.warpAnim = null;
      p.warpCooldown = 0;
    });

    // LuckyBlocks (en Abruk se recargan cada 20s si tienen regenerates: true)
    this.blocks = this.level.luckyBlocks.map((b, i) => ({
      id: i,
      x: b.x,
      y: b.y,
      w: 58,
      h: 58,
      content: b.content || 'random',
      used: false,
      bumpOffset: 0,
      bumpVel: 0,
      regenerates: !!b.regenerates,
      regenTime: b.regenTime || 20,
      regenTimer: 0,
    }));

    // Monedas de oro medievales recolectables
    this.coins = (this.level.coins || []).map((c, i) => ({
      id: i,
      x: c.x,
      y: c.y,
      w: 34,
      h: 34,
      collected: false,
    }));

    // Enemigos
    this.enemies = this.level.enemies.map((e, i) => {
      if (e.type === 'mateo') {
        return {
          id: i,
          type: 'mateo',
          x: e.x,
          y: e.y - 68,
          w: 48,
          h: 68,
          minX: e.minX,
          maxX: e.maxX,
          vx: -95 - index * 12,
          vy: 0,
          facing: -1,
          alive: true,
          dyingTimer: 0,
          attackTimer: 0,
          attackCooldown: 0.6,
          animTime: Math.random() * 5,
        };
      }
      return {
        id: i,
        type: 'erin',
        x: e.x,
        baseY: e.y,
        y: e.y,
        w: 64,
        h: 48,
        minX: e.minX,
        maxX: e.maxX,
        vx: -115 - index * 12,
        facing: -1,
        alive: true,
        dyingTimer: 0,
        attackTimer: 0,
        shootTimer: 1.4 + Math.random() * 1.4,
        animTime: Math.random() * 6,
      };
    });

    this.items = [];
    this.meteorites = [];
    this.shockwaves = [];
    this.particles = [];
    this.floatingTexts = [];

    // Jefe Final Abruk (solo en Nivel 3)
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.gateOpen = false;
    this.pepeRescued = false;
    this.victoryTimer = 0;

    if (this.level.bossArena) {
      const sp = this.level.bossArena.bossSpawn;
      this.boss = {
        x: sp.x,
        y: sp.y - 128,
        w: 96,
        h: 128,
        vx: 0,
        vy: 0,
        facing: -1,
        onGround: true,
        hp: 12,
        maxHp: 12,
        alive: true,
        aiState: 'idle', // 'idle' | 'run' | 'jump' | 'attack'
        aiTimer: 1.0,
        hurtInvuln: 0,
        attackHitDone: false,
        dyingTimer: 0,
        animTime: 0,
      };
    }

    this.sound.playMusic('main');

    if (showBanner && this.cb.onToast) {
      this.cb.onToast(`${this.level.introTitle} — ${this.level.introSub}`, 3400);
    }
    this._syncHud();
  }

  _isDown(codes) {
    for (const c of codes) {
      if (this.keys.has(c)) return true;
    }
    return false;
  }

  _isJustPressed(codes) {
    for (const c of codes) {
      if (this.justPressed.has(c)) return true;
    }
    return false;
  }

  update(dt) {
    dt = Math.min(dt, 0.045);
    this.time += dt;

    // Partículas ambientales siempre animadas (incluso en el menú!)
    this._updateAmbient(dt);

    if (this.state === 'menu') {
      this.cameraX = (Math.sin(this.time * 0.12) * 0.5 + 0.5) * 900;
      this.justPressed.clear();
      return;
    }

    if (this.state === 'paused' || this.state === 'gameover' || this.state === 'victory') {
      this._updateParticles(dt);
      this.justPressed.clear();
      return;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    if (this.state === 'pipe_out') {
      this.pipeAnimTimer += dt;
      this.players.forEach((p) => {
        if (p.alive && !p.eliminated) {
          p.pipeSlideY = (p.pipeSlideY || 0) + 125 * dt;
        }
      });
      this._updateParticles(dt);
      this.justPressed.clear();
      return;
    }

    if (this.state === 'victory_walk') {
      this.victoryTimer += dt;
      this._updateParticles(dt);
      this._updateFloatingTexts(dt);
      if (this.victoryTimer > 2.2) {
        this.state = 'victory';
        if (this.cb.onVictory) this.cb.onVictory(this.mode);
      }
      this.justPressed.clear();
      return;
    }

    // Música de fondo en bucle: Audio 1 (main) durante el juego y Audio 2 (boss) frente a Abruk!
    const desiredTrack = this.bossActive && !this.bossDefeated ? 'boss' : 'main';
    this.sound.playMusic(desiredTrack);

    // Activar Invisibilidad comprada en tienda con tecla "2"
    if (this._isJustPressed(['Digit2', 'Numpad2'])) {
      this.activateInvisibility();
    }

    // Actualizar jugadores
    for (const p of this.players) {
      this._updatePlayer(p, dt);
    }

    // Actualizar monedas medievales
    this._updateCoins();

    // Actualizar bloques LuckyBlock
    this._updateBlocks(dt);

    // Actualizar Popos (objetos)
    this._updateItems(dt);

    // Actualizar Enemigos (Mateos y Erins)
    this._updateEnemies(dt);

    // Actualizar Meteoritos de Erin
    this._updateMeteorites(dt);

    // Actualizar Arena y Jefe Final Abruk
    this._updateBoss(dt);
    this._updateShockwaves(dt);

    // Comprobar Tubo de Madera de fin de nivel
    this._checkExitPipe();

    // Comprobar Rescate de Pepe (después de vencer a Abruk)
    this._checkPepeRescue();

    // Cámara cooperativa
    this._updateCamera(dt);

    // Partículas y textos flotantes
    this._updateParticles(dt);
    this._updateFloatingTexts(dt);

    // Comprobar si TODOS los jugadores activos perdieron sus 3 corazones
    if (this.players.every((p) => p.eliminated)) {
      this.state = 'gameover';
      this.sound.stopMusic();
      if (this.cb.onGameOver) this.cb.onGameOver(this.mode);
    }

    this._syncHud();
    this.justPressed.clear();
  }

  _updateAmbient(dt) {
    const isWater = this.level && this.level.isUnderwater && this.state !== 'menu';
    for (const a of this.ambientParticles) {
      if (isWater) {
        a.y -= a.speed * dt;
        a.x += Math.sin(this.time * 2 + a.phase) * 14 * dt;
        if (a.y < -10) {
          a.y = VIEW_H + 10;
          a.x = Math.random() * VIEW_W;
        }
      } else {
        a.y += a.speed * 0.45 * dt;
        a.x += (a.drift + Math.sin(this.time * 1.4 + a.phase) * 18) * dt;
        if (a.y > VIEW_H + 10) {
          a.y = -10;
          a.x = Math.random() * VIEW_W;
        }
        if (a.x < -10) a.x = VIEW_W + 10;
        if (a.x > VIEW_W + 10) a.x = -10;
      }
    }
  }

  _getSolidSolids() {
    const solids = [];
    // Suelo
    for (const [x1, x2] of this.level.groundSegments) {
      solids.push({ x: x1, y: GROUND_Y, w: x2 - x1, h: 220, isGround: true });
    }
    // Pilares de madera sólidos
    for (const pl of this.level.platforms) {
      if (pl.kind === 'pillar') {
        solids.push({ x: pl.x, y: pl.y, w: pl.w, h: pl.h, isPillar: true });
      }
    }
    // Tubo de madera de salida
    if (this.level.exitPipe) {
      const ep = this.level.exitPipe;
      solids.push({ x: ep.x, y: ep.y, w: ep.w, h: ep.h, isExitPipe: true });
    }
    // Puerta de la arena de Abruk (cerrada hasta vencerlo!)
    if (this.level.bossArena && !this.gateOpen) {
      solids.push({
        x: this.level.bossArena.gateX,
        y: 0,
        w: 44,
        h: GROUND_Y,
        isGate: true,
      });
    }
    // LuckyBlocks sólidos
    for (const b of this.blocks) {
      solids.push({ x: b.x, y: b.y, w: b.w, h: b.h, isBlock: true, blockRef: b });
    }
    return solids;
  }

  activateInvisibility() {
    if (!this.shop.hasInvis) return false;
    const anyLiving = this.players.some((p) => p.alive && !p.eliminated);
    if (!anyLiving) return false;

    this.shop.hasInvis = false;
    this._saveShopState();
    this.sound.sfxPowerUp(true);
    for (const p of this.players) {
      if (p.alive && !p.eliminated) {
        p.invisible = true;
        this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#5ce1ff', 16);
        this._addFloatingText(p.x + p.w / 2, p.y - 12, '🧪 ¡INVISIBLE!', '#7cebff');
      }
    }
    if (this.cb.onToast) {
      this.cb.onToast('🧪 ¡Invisibilidad activada! Los enemigos no pueden atacarte hasta perder un corazón.', 3000);
    }
    return true;
  }

  _updateCoins() {
    for (const c of this.coins) {
      if (c.collected) continue;
      for (const p of this.players) {
        if (!p.alive || p.eliminated) continue;
        if (aabb(p, c)) {
          c.collected = true;
          this.shop.coins += COIN_VALUE;
          this._saveShopState();
          this.sound.sfxLuckyBlock();
          this._burstParticles(c.x + c.w / 2, c.y + c.h / 2, '#ffe047', 10);
          this._addFloatingText(c.x + c.w / 2, c.y - 8, `+${COIN_VALUE} 🪙`, '#ffe564');
          break;
        }
      }
    }
  }
  getPhysics(isUnderwater) {
    if (isUnderwater) {
      return {
        gravity: 760,
        jumpVel: -545,
        swimVel: -385,
        maxFall: 285,
        maxSpeed: 390,
      };
    }
    return {
      gravity: 2180,
      jumpVel: -840,
      swimVel: 0,
      maxFall: 980,
      maxSpeed: 475,
    };
  }

  _findStandingWarpTrunk(p) {
    for (const pl of this.level.platforms) {
      if (pl.kind !== 'pillar' || !pl.warpId || !pl.warpTarget) continue;
      const onTop =
        p.x + p.w > pl.x + 2 &&
        p.x < pl.x + pl.w - 2 &&
        Math.abs(p.y + p.h - pl.y) < 16;
      if (onTop) return pl;
    }
    return null;
  }

  _updatePlayerWarp(p, dt) {
    const wa = p.warpAnim;
    const duration = 0.3;
    wa.timer += dt;
    const progress = Math.min(1, wa.timer / duration);

    if (wa.phase === 'entering') {
      p.x = wa.fromPipe.x + (wa.fromPipe.w - p.w) / 2;
      p.y = wa.fromPipe.y - p.h;
      p.pipeSlideY = progress * (p.h + 10);
      if (progress >= 1) {
        // Teletransportar al tubo conectado (adelante o atrás, como una cuerda!)
        wa.phase = 'exiting';
        wa.timer = 0;
        p.x = wa.toPipe.x + (wa.toPipe.w - p.w) / 2;
        p.y = wa.toPipe.y - p.h;
        p.pipeSlideY = p.h + 10;
        p.safeX = p.x;
        p.safeY = p.y;
        this.sound.sfxPipeEnter();
      }
    } else {
      p.x = wa.toPipe.x + (wa.toPipe.w - p.w) / 2;
      p.y = wa.toPipe.y - p.h;
      p.pipeSlideY = (1 - progress) * (p.h + 10);
      if (progress >= 1) {
        p.warpAnim = null;
        p.pipeSlideY = 0;
        p.warpCooldown = 0.65;
        p.hurtInvuln = Math.max(p.hurtInvuln, 0.7);
        p.onGround = true;
        p.vx = 0;
        p.vy = 0;
        this._burstParticles(p.x + p.w / 2, p.y + p.h, '#ffe680', 10);
      }
    }
  }

  _updatePlayer(p, dt) {
    if (p.eliminated) return;

    // Temporizador de reaparición tras perder 1 corazón
    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        this._respawnPlayer(p);
      }
      return;
    }

    p.animTime += dt;
    if (p.hurtInvuln > 0) p.hurtInvuln = Math.max(0, p.hurtInvuln - dt);
    if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    if (p.warpCooldown > 0) p.warpCooldown = Math.max(0, p.warpCooldown - dt);
    if (p.attackTimer > 0) p.attackTimer = Math.max(0, p.attackTimer - dt);
    if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - dt);

    // Si está viajando por un tubo-tronco conectado, animar entrada/salida
    if (p.warpAnim) {
      this._updatePlayerWarp(p, dt);
      return;
    }

    // Recuperar squash & stretch suavemente
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);

    // Temporizador del Modo Dorado (16 segundos exactos!)
    if (p.power === 'gold') {
      p.goldTimer -= dt;
      if (Math.random() < 0.55) {
        this._spawnParticle(
          p.x + Math.random() * p.w,
          p.y + Math.random() * p.h,
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 60,
          '#ffe655',
          4 + Math.random() * 4,
          0.45
        );
      }
      if (p.goldTimer <= 0) {
        p.power = 'none';
        p.goldTimer = 0;
        this._addFloatingText(p.x + p.w / 2, p.y - 10, '¡Fin Modo Dorado!', '#ffe066');
      }
    }

    const left = this._isDown(p.controls.left);
    const right = this._isDown(p.controls.right);
    const up = this._isDown(p.controls.up);
    const down = this._isDown(p.controls.down);
    const jumpPressed = this._isJustPressed(p.controls.up);
    const attackPressed = this._isJustPressed(p.controls.attack);

    // Entrar a un tubo-tronco conectado (bajando con ↓ o S) -> lleva al tubo conectado como una cuerda!
    if (down && (p.onGround || p.power === 'gold') && p.warpCooldown <= 0) {
      const warpTrunk = this._findStandingWarpTrunk(p);
      if (warpTrunk) {
        const destTrunk = this.level.platforms.find((pl) => pl.warpId === warpTrunk.warpTarget);
        if (destTrunk) {
          p.crouching = false;
          this._setPlayerHeight(p, p.standH);
          p.vx = 0;
          p.vy = 0;
          p.warpAnim = { phase: 'entering', timer: 0, fromPipe: warpTrunk, toPipe: destTrunk };
          p.pipeSlideY = 0;
          this.sound.sfxPipeEnter();
          return;
        }
      }
    }

    // Ataque con Espada (Popo Marrón)
    if (p.power === 'sword' && attackPressed && p.attackCooldown <= 0) {
      p.attackTimer = 0.24;
      p.attackCooldown = 0.34;
      p.squashX = 1.18;
      p.squashY = 0.9;
      this.sound.sfxSwordSlash();
      this._performSwordSlash(p);
    }

    const isGold = p.power === 'gold';
    const isWater = this.level.isUnderwater;

    if (isGold) {
      // MODO DORADO: Vuelo libre 2D rápido, inmune al dolor (pero los pozos matan igual!)
      p.crouching = false;
      this._setPlayerHeight(p, p.standH);
      const flySpeedX = 560;
      const flySpeedY = 410;
      const dirX = (right ? 1 : 0) - (left ? 1 : 0);
      const dirY = (down ? 1 : 0) - (up ? 1 : 0);
      if (dirX !== 0) p.facing = dirX;
      p.vx += (dirX * flySpeedX - p.vx) * Math.min(1, dt * 14);
      p.vy += (dirY * flySpeedY - p.vy) * Math.min(1, dt * 14);
      // Pequeña flotación si no presiona arriba ni abajo
      if (dirY === 0) {
        p.vy += Math.sin(this.time * 5 + p.id) * 14 * dt;
      }
    } else {
      // MOVIMIENTO NORMAL / ESPADA (Nivel 3 tiene mucha menos gravedad bajo el agua!)
      const phys = this.getPhysics(isWater);
      // Agacharse
      const wantCrouch = down && p.onGround;
      p.crouching = wantCrouch;
      this._setPlayerHeight(p, wantCrouch ? p.crouchH : p.standH);

      const maxSpeed = wantCrouch ? 160 : phys.maxSpeed;
      const accel = p.onGround ? 4200 : isWater ? 1900 : 2700;
      const friction = p.onGround ? 3400 : isWater ? 420 : 520;

      const moveDir = (right ? 1 : 0) - (left ? 1 : 0);
      if (moveDir !== 0) {
        p.facing = moveDir;
        p.vx += moveDir * accel * dt;
        if (Math.abs(p.vx) > maxSpeed) {
          p.vx = Math.sign(p.vx) * maxSpeed;
        }
      } else {
        if (Math.abs(p.vx) <= friction * dt) {
          p.vx = 0;
        } else {
          p.vx -= Math.sign(p.vx) * friction * dt;
        }
      }

      // Coyote time + Jump buffer para saltos estilo Mario Wonder súper precisos
      if (p.onGround) {
        p.coyoteTimer = 0.12;
      } else {
        p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
      }

      if (jumpPressed) {
        p.jumpBuffer = 0.13;
      } else {
        p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
      }

      const gravity = phys.gravity;
      const jumpVel = phys.jumpVel;

      if (p.jumpBuffer > 0 && p.coyoteTimer > 0) {
        p.vy = jumpVel;
        p.onGround = false;
        p.coyoteTimer = 0;
        p.jumpBuffer = 0;
        p.squashX = 0.82;
        p.squashY = 1.24;
        this.sound.sfxJump(isWater);
        for (let i = 0; i < 6; i++) {
          this._spawnParticle(
            p.x + p.w * Math.random(),
            p.y + p.h,
            (Math.random() - 0.5) * 120,
            -25 - Math.random() * 65,
            isWater ? '#b8f3ff' : '#f3e5ab',
            4 + Math.random() * 3,
            0.3
          );
        }
      } else if (isWater && jumpPressed && !p.onGround && p.vy > -180) {
        // Impulso suave de nado bajo el agua con burbujas
        p.vy = phys.swimVel;
        p.squashX = 0.88;
        p.squashY = 1.15;
        this.sound.sfxJump(true);
        for (let i = 0; i < 5; i++) {
          this._spawnParticle(p.x + p.w / 2, p.y + p.h, (Math.random() - 0.5) * 70, 45, '#ccf6ff', 4, 0.4);
        }
      }

      // Salto variable (en tierra corta subida al soltar; bajo el agua se mantiene flotante)
      if (!isWater && !up && p.vy < -280) {
        p.vy += gravity * 0.95 * dt;
      }

      p.vy = Math.min(phys.maxFall, p.vy + gravity * dt);
    }

    // Mover y resolver colisiones
    const solids = this._getSolidSolids();
    const prevBottom = p.y + p.h;

    // Eje X
    p.x += p.vx * dt;
    // Limitar a los bordes del nivel y la arena del jefe
    const minWorldX = this.bossActive && !this.bossDefeated && this.level.bossArena
      ? this.level.bossArena.minX
      : 0;
    const maxWorldX = this.level.width - p.w;
    if (p.x < minWorldX) { p.x = minWorldX; p.vx = 0; }
    if (p.x > maxWorldX) { p.x = maxWorldX; p.vx = 0; }

    // En 2 jugadores mantenerlos dentro de la pantalla de la cámara
    if (this.mode === 2) {
      const camMin = this.cameraX + 10;
      const camMax = this.cameraX + VIEW_W - p.w - 10;
      if (p.x < camMin) { p.x = camMin; if (p.vx < 0) p.vx = 0; }
      if (p.x > camMax) { p.x = camMax; if (p.vx > 0) p.vx = 0; }
    }

    for (const s of solids) {
      if (aabb(p, s)) {
        if (s.isBlock && !s.blockRef.used) {
          this._triggerLuckyBlock(s.blockRef, p);
        }
        if (p.vx > 0) {
          p.x = s.x - p.w;
          p.vx = 0;
        } else if (p.vx < 0) {
          p.x = s.x + s.w;
          p.vx = 0;
        }
      }
    }

    // Eje Y
    const wasOnGround = p.onGround;
    p.onGround = false;
    p.y += p.vy * dt;

    // Techo en modo dorado
    if (p.y < 18) {
      p.y = 18;
      if (p.vy < 0) p.vy = 0;
    }

    // Colisión con bloques sólidos (suelo, pilares, luckyblocks, tubo)
    for (const s of solids) {
      if (aabb(p, s)) {
        if (p.vy >= 0) {
          p.y = s.y - p.h;
          p.vy = 0;
          p.onGround = true;
          if (!wasOnGround) {
            p.squashX = 1.18;
            p.squashY = 0.84;
          }
          if (s.isGround) {
            p.safeX = clamp(p.x, s.x + 24, s.x + s.w - p.w - 24);
            p.safeY = GROUND_Y - p.standH;
          }
          if (s.isBlock && !s.blockRef.used) {
            this._triggerLuckyBlock(s.blockRef, p);
          }
        } else if (p.vy < 0) {
          p.y = s.y + s.h;
          p.vy = 0;
          if (s.isBlock && !s.blockRef.used) {
            this._triggerLuckyBlock(s.blockRef, p);
          }
        }
      }
    }

    // Colisión one-way con plataformas de troncos horizontales (para pasar pozos!)
    for (const pl of this.level.platforms) {
      if (pl.kind !== 'log') continue;
      if (
        p.vy >= 0 &&
        prevBottom <= pl.y + 14 &&
        p.y + p.h >= pl.y &&
        p.x + p.w > pl.x + 6 &&
        p.x < pl.x + pl.w - 6
      ) {
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
        if (!wasOnGround) {
          p.squashX = 1.15;
          p.squashY = 0.87;
        }
      }
    }

    // Caída en un POZO (pierde 1 corazón incluso si está en Modo Dorado!)
    if (p.y > VIEW_H + 85) {
      this._killPlayerHeart(p, '¡Se cayó a un pozo!');
    }
  }

  _setPlayerHeight(p, targetH) {
    if (p.h === targetH) return;
    const bottom = p.y + p.h;
    p.h = targetH;
    p.y = bottom - targetH;
  }

  _performSwordSlash(p) {
    const reach = 68;
    const slashBox = {
      x: p.facing > 0 ? p.x + p.w - 8 : p.x - reach + 8,
      y: p.y - 6,
      w: reach,
      h: p.h + 12,
    };

    // Efecto visual de corte brillante
    for (let i = 0; i < 8; i++) {
      this._spawnParticle(
        slashBox.x + Math.random() * slashBox.w,
        slashBox.y + Math.random() * slashBox.h,
        p.facing * (90 + Math.random() * 140),
        (Math.random() - 0.5) * 100,
        '#ffffff',
        4 + Math.random() * 4,
        0.24
      );
    }

    // Cortar enemigos (Mateos y Erins)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (aabb(slashBox, e)) {
        this._defeatEnemy(e, p);
      }
    }

    // Destruir meteoritos en el aire
    for (const m of this.meteorites) {
      if (!m.alive) continue;
      if (aabb(slashBox, m)) {
        m.alive = false;
        this._burstParticles(m.x + m.w / 2, m.y + m.h / 2, '#ffae33', 10);
        this.sound.sfxStomp();
      }
    }

    // Dañar a Abruk (Jefe Final)
    if (this.boss && this.boss.alive && this.bossActive && aabb(slashBox, this.boss)) {
      this._damageBoss(1, p);
    }
  }

  _triggerLuckyBlock(block, player) {
    if (block.used) return;
    block.used = true;
    block.bumpVel = -240;
    if (block.regenerates) {
      block.regenTimer = block.regenTime || 20;
    }
    this.sound.sfxLuckyBlock();
    this._burstParticles(block.x + block.w / 2, block.y + block.h / 2, '#ffe078', 12);

    // 1 de 2 objetos: Popo Marrón (Espada) o Popo Naranja (Dorado 16s)
    let kind;
    if (block.content === 'brown' || block.content === 'orange') {
      kind = block.content;
    } else {
      this.lastLuckyToggle = !this.lastLuckyToggle;
      kind = Math.random() < 0.65
        ? (this.lastLuckyToggle ? 'brown' : 'orange')
        : (Math.random() < 0.5 ? 'brown' : 'orange');
    }

    this.items.push({
      kind, // 'brown' | 'orange'
      x: block.x + 8,
      y: block.y - 44,
      w: 44,
      h: 44,
      vx: (player.facing || 1) * 95,
      vy: -310,
      alive: true,
      life: 14.0,
      animTime: 0,
    });
  }

  _updateBlocks(dt) {
    for (const b of this.blocks) {
      if (b.bumpOffset !== 0 || b.bumpVel !== 0) {
        b.bumpOffset += b.bumpVel * dt;
        b.bumpVel += 1200 * dt;
        if (b.bumpOffset > 0) {
          b.bumpOffset = 0;
          b.bumpVel = 0;
        }
      }
      if (b.used && b.regenerates) {
        b.regenTimer -= dt;
        if (b.regenTimer <= 0) {
          b.used = false;
          this._burstParticles(b.x + b.w / 2, b.y + b.h / 2, '#fff0a0', 10);
        }
      }
    }
  }

  _updateItems(dt) {
    const solids = this._getSolidSolids();

    for (const it of this.items) {
      if (!it.alive) continue;
      it.animTime += dt;
      it.life -= dt;
      if (it.life <= 0 || it.y > VIEW_H + 120) {
        it.alive = false;
        continue;
      }

      it.vy = Math.min(620, it.vy + 1250 * dt);
      it.x += it.vx * dt;
      for (const s of solids) {
        if (aabb(it, s)) {
          it.vx = -it.vx;
          it.x += it.vx * dt * 2;
          break;
        }
      }

      const prevBottom = it.y + it.h;
      it.y += it.vy * dt;
      for (const s of solids) {
        if (aabb(it, s) && it.vy >= 0) {
          it.y = s.y - it.h;
          it.vy = -210; // Rebote simpático como en el GIF!
        }
      }
      for (const pl of this.level.platforms) {
        if (pl.kind !== 'log') continue;
        if (it.vy >= 0 && prevBottom <= pl.y + 12 && it.y + it.h >= pl.y && it.x + it.w > pl.x && it.x < pl.x + pl.w) {
          it.y = pl.y - it.h;
          it.vy = -210;
        }
      }

      // Recolección por Lucio o Nacho
      for (const p of this.players) {
        if (!p.alive || p.eliminated) continue;
        if (aabb(p, it)) {
          it.alive = false;
          if (it.kind === 'brown') {
            p.power = 'sword';
            p.swordHits = SWORD_DURABILITY;
            p.goldTimer = 0;
            this.sound.sfxPowerUp(false);
            this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#d8e4f0', 18);
            this._addFloatingText(p.x + p.w / 2, p.y - 14, '⚔️ ¡ESPADA! (3 golpes)', '#fff4c2');
            if (this.cb.onToast) {
              const keyHint = p.id === 1 ? 'tecla 1' : 'F / E / Espacio';
              this.cb.onToast(`⚔️ ¡${p.name} obtuvo la Espada! (Golpea con ${keyHint})`, 2600);
            }
          } else {
            p.power = 'gold';
            p.goldTimer = GOLD_DURATION;
            p.swordHits = 0;
            this.sound.sfxPowerUp(true);
            this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#ffe247', 26);
            this._addFloatingText(p.x + p.w / 2, p.y - 14, '✨ ¡MODO DORADO! 16s', '#ffe452');
            if (this.cb.onToast) {
              this.cb.onToast(`✨ ¡${p.name} es DORADO! ¡Vuela y es inmune 16s! (¡Ojo con los pozos!)`, 2800);
            }
          }
          break;
        }
      }
    }

    this.items = this.items.filter((i) => i.alive);
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.dyingTimer > 0) {
          e.dyingTimer -= dt;
          e.y += 280 * dt;
        }
        continue;
      }

      e.animTime += dt;

      if (e.type === 'mateo') {
        if (e.attackTimer > 0) e.attackTimer = Math.max(0, e.attackTimer - dt);
        if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);

        // Revisar si hay un jugador cerca para sacar la espada y atacar
        const nearPlayer = this._nearestLivingPlayer(e.x + e.w / 2, e.y + e.h / 2, 165);
        if (nearPlayer && e.attackCooldown <= 0) {
          e.facing = nearPlayer.x >= e.x ? 1 : -1;
          e.vx = e.facing * 145;
          e.attackTimer = 0.48;
          e.attackCooldown = 1.35;
        } else if (e.attackTimer <= 0) {
          const baseSpeed = 95 + this.levelIndex * 12;
          e.vx = Math.sign(e.vx || -1) * baseSpeed;
          e.facing = e.vx >= 0 ? 1 : -1;
        }

        e.x += e.vx * dt;
        if (e.x < e.minX) {
          e.x = e.minX;
          e.vx = Math.abs(e.vx);
          e.facing = 1;
        } else if (e.x + e.w > e.maxX) {
          e.x = e.maxX - e.w;
          e.vx = -Math.abs(e.vx);
          e.facing = -1;
        }
      } else if (e.type === 'erin') {
        if (e.attackTimer > 0) e.attackTimer = Math.max(0, e.attackTimer - dt);
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.animTime * 2.6) * 20;
        if (e.x < e.minX) {
          e.x = e.minX;
          e.vx = Math.abs(e.vx);
          e.facing = 1;
        } else if (e.x + e.w > e.maxX) {
          e.x = e.maxX - e.w;
          e.vx = -Math.abs(e.vx);
          e.facing = -1;
        }

        // Lanzar meteorito si algún jugador está a rango
        e.shootTimer -= dt;
        const target = this._nearestLivingPlayer(e.x + e.w / 2, e.y + e.h / 2, 560);
        if (e.shootTimer <= 0 && target) {
          e.shootTimer = 2.3 + Math.random() * 1.1;
          e.attackTimer = 0.55;
          e.facing = target.x >= e.x ? 1 : -1;
          const dx = (target.x + target.w / 2) - (e.x + e.w / 2);
          const aimVx = clamp(dx * 0.45, -135, 135);
          this.meteorites.push({
            x: e.x + e.w / 2 - 17,
            y: e.y + e.h - 4,
            w: 34,
            h: 42,
            vx: aimVx,
            vy: 230,
            alive: true,
            rot: 0,
          });
          this.sound.sfxMeteor();
        }
      }

      // Colisión con jugadores
      for (const p of this.players) {
        if (!p.alive || p.eliminated) continue;
        // Caja de ataque extendida si Mateo está blandiendo la espada
        const enemyHitBox = e.type === 'mateo' && e.attackTimer > 0
          ? {
              x: e.facing > 0 ? e.x : e.x - 20,
              y: e.y,
              w: e.w + 20,
              h: e.h,
            }
          : e;

        if (aabb(p, enemyHitBox)) {
          // En MODO DORADO: pasar encima o tocar a Mateo/Erin los mata al instante!
          if (p.power === 'gold') {
            this._defeatEnemy(e, p);
            this._burstParticles(e.x + e.w / 2, e.y + e.h / 2, '#ffe452', 16);
          } else {
            // ¿El jugador saltó ENCIMA del enemigo? (stomp generoso estilo Mario!)
            const playerBottom = p.y + p.h;
            const stompTolerance = e.type === 'erin' ? e.h * 0.72 : e.h * 0.58;
            const isStomp = p.vy > 0 && playerBottom - p.vy * dt <= e.y + stompTolerance;
            if (isStomp) {
              this._defeatEnemy(e, p);
              p.vy = this.level.isUnderwater ? -520 : -610;
              p.squashX = 1.2;
              p.squashY = 0.8;
            } else {
              // Toca al jugador sin saltar encima -> hace 1 golpe de daño (15 golpes = 1 corazón)
              this._hurtPlayer(p, e.x + e.w / 2);
            }
          }
        }
      }
    }
  }

  _defeatEnemy(e, byPlayer) {
    if (!e.alive) return;
    e.alive = false;
    e.dyingTimer = 0.45;
    this.sound.sfxStomp();
    this._burstParticles(e.x + e.w / 2, e.y + e.h / 2, e.type === 'mateo' ? '#ff7c5c' : '#ffcf56', 16);
    this._addFloatingText(e.x + e.w / 2, e.y, e.type === 'mateo' ? '¡Mateo fuera!' : '¡Erin fuera!', '#fff4b8');
  }

  _updateMeteorites(dt) {
    for (const m of this.meteorites) {
      if (!m.alive) continue;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vy += 260 * dt;
      m.rot += dt * 4;

      if (Math.random() < 0.65) {
        this._spawnParticle(
          m.x + m.w / 2 + (Math.random() - 0.5) * 14,
          m.y + 4,
          (Math.random() - 0.5) * 40,
          -60 - Math.random() * 50,
          Math.random() < 0.5 ? '#ff7300' : '#ffe047',
          4 + Math.random() * 4,
          0.32
        );
      }

      // Impacto con suelo
      if (m.y + m.h >= GROUND_Y) {
        // Solo explota si hay suelo sólido ahí
        const overGround = this.level.groundSegments.some(([x1, x2]) => m.x + m.w / 2 >= x1 && m.x + m.w / 2 <= x2);
        if (overGround) {
          m.alive = false;
          this._burstParticles(m.x + m.w / 2, GROUND_Y, '#ff6e24', 12);
          continue;
        }
      }

      if (m.y > VIEW_H + 60) {
        m.alive = false;
        continue;
      }

      // Colisión con jugadores
      for (const p of this.players) {
        if (!p.alive || p.eliminated) continue;
        if (aabb(p, m)) {
          m.alive = false;
          this._burstParticles(m.x + m.w / 2, m.y + m.h / 2, '#ff8024', 14);
          this._hurtPlayer(p, m.x + m.w / 2);
          break;
        }
      }
    }
    this.meteorites = this.meteorites.filter((m) => m.alive);
  }

  _updateBoss(dt) {
    if (!this.boss || !this.level.bossArena) return;
    const arena = this.level.bossArena;

    // Activar pelea cuando algún jugador entra a la arena
    if (!this.bossActive && !this.bossDefeated) {
      const triggered = this.players.some((p) => p.alive && !p.eliminated && p.x >= arena.triggerX);
      if (triggered) {
        this.bossActive = true;
        this.sound.playMusic('boss');
        this.shakeTimer = 0.45;
        this.shakeIntensity = 8;
        if (this.cb.onToast) {
          this.cb.onToast('🦴 ¡JEFE FINAL: ABRUK! ¡Sáltenle encima o atáquenlo con la espada!', 3800);
        }
      }
    }

    if (!this.bossActive) return;

    const b = this.boss;
    if (!b.alive) {
      if (b.dyingTimer > 0) {
        b.dyingTimer -= dt;
        b.y -= 90 * dt;
        if (Math.random() < 0.7) {
          this._burstParticles(b.x + Math.random() * b.w, b.y + Math.random() * b.h, '#ffe45c', 4);
        }
      }
      return;
    }

    b.animTime += dt;
    if (b.hurtInvuln > 0) b.hurtInvuln = Math.max(0, b.hurtInvuln - dt);

    const target = this._nearestLivingPlayer(b.x + b.w / 2, b.y + b.h / 2, 2000);
    const gravity = 1550;

    b.aiTimer -= dt;

    if (b.aiState === 'idle') {
      b.vx *= 0.85;
      if (target) b.facing = target.x >= b.x ? 1 : -1;
      if (b.aiTimer <= 0) {
        const roll = Math.random();
        if (target && roll < 0.62) {
          // ATAQUE DE ABRUK: salta directamente sobre un jugador mientras intenta golpearlo con su hueso!
          this._startBossJumpAttack(b, target);
        } else {
          b.aiState = 'run';
          b.aiTimer = 1.25;
          if (target) b.facing = target.x >= b.x ? 1 : -1;
        }
      }
    } else if (b.aiState === 'run') {
      const rage = b.hp <= 5 ? 1.24 : 1.0;
      b.vx = b.facing * 265 * rage;
      if (target && Math.abs(target.x - b.x) < 280 && b.aiTimer < 0.95) {
        // Al acercarse salta sobre el jugador intentando golpearlo con el hueso!
        this._startBossJumpAttack(b, target);
      } else if (b.aiTimer <= 0) {
        if (target) {
          this._startBossJumpAttack(b, target);
        } else {
          b.aiState = 'idle';
          b.aiTimer = 0.55;
        }
      }
    } else if (b.aiState === 'attack' || b.aiState === 'jump') {
      // Mientras salta sobre el jugador, balancea su hueso intentando golpearlo!
      if (b.onGround && b.vy >= 0 && b.aiTimer < 1.38) {
        if (!b.attackHitDone) {
          b.attackHitDone = true;
          this.sound.sfxBossSlam();
          this.shakeTimer = 0.28;
          this.shakeIntensity = 9;
          this._burstParticles(b.x + b.w / 2, GROUND_Y, '#f7d08a', 16);
          // Onda de impacto del hueso al caer sobre la zona del jugador
          this.shockwaves.push(
            { x: b.x - 18, y: GROUND_Y - 24, w: 38, h: 24, vx: -315, life: 1.05 },
            { x: b.x + b.w - 18, y: GROUND_Y - 24, w: 38, h: 24, vx: 315, life: 1.05 }
          );
        }
        b.vx *= 0.8;
        if (b.aiTimer <= 0.15) {
          b.aiState = 'idle';
          b.aiTimer = 0.62;
        }
      }
      if (b.aiTimer <= 0) {
        b.aiState = 'idle';
        b.aiTimer = 0.62;
      }
    }

    b.vy = Math.min(860, b.vy + gravity * dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < arena.minX + 20) {
      b.x = arena.minX + 20;
      b.facing = 1;
      b.vx = Math.abs(b.vx);
    }
    if (b.x + b.w > arena.maxX - 24) {
      b.x = arena.maxX - 24 - b.w;
      b.facing = -1;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y + b.h >= GROUND_Y) {
      b.y = GROUND_Y - b.h;
      b.vy = 0;
      b.onGround = true;
    }

    // Colisión con jugadores
    for (const p of this.players) {
      if (!p.alive || p.eliminated) continue;
      const bossBox = b.aiState === 'attack'
        ? {
            x: b.facing > 0 ? b.x : b.x - 36,
            y: b.y,
            w: b.w + 36,
            h: b.h,
          }
        : b;

      if (aabb(p, bossBox)) {
        const playerBottom = p.y + p.h;
        const isStomp = p.vy > 0 && playerBottom - p.vy * dt <= b.y + 44;
        if (isStomp) {
          this._damageBoss(1, p);
          p.vy = -620;
          p.vx = (p.x < b.x + b.w / 2 ? -1 : 1) * 260;
        } else {
          this._hurtPlayer(p, b.x + b.w / 2);
        }
      }
    }
  }

  _startBossJumpAttack(b, target) {
    const dx = (target.x + target.w / 2) - (b.x + b.w / 2);
    b.facing = dx >= 0 ? 1 : -1;
    b.aiState = 'attack';
    b.aiTimer = 1.55;
    b.attackHitDone = false;
    b.onGround = false;
    // Salta directamente hacia la posición del jugador intentando golpearlo con el hueso
    b.vy = -730;
    const rage = b.hp <= 5 ? 1.15 : 1.0;
    b.vx = clamp(dx * 1.18, -420, 420) * rage;
    this.sound.sfxJump(false);
  }

  _damageBoss(amount, byPlayer) {
    const b = this.boss;
    if (!b || !b.alive || b.hurtInvuln > 0) return;
    b.hp = Math.max(0, b.hp - amount);
    b.hurtInvuln = 0.65;
    this.sound.sfxBossHit();
    this.shakeTimer = 0.2;
    this.shakeIntensity = 7;
    this._burstParticles(b.x + b.w / 2, b.y + 34, '#ffec66', 18);
    this._addFloatingText(b.x + b.w / 2, b.y - 10, `-${amount} ¡GOLPE!`, '#ffdf5e');

    if (b.hp <= 0) {
      b.alive = false;
      b.dyingTimer = 1.6;
      this.bossDefeated = true;
      this.gateOpen = true;
      this.shockwaves = [];
      this.sound.sfxBossDefeat();
      this.sound.playMusic('victory');
      this.shakeTimer = 0.55;
      this.shakeIntensity = 11;
      this._burstParticles(this.level.bossArena.gateX, GROUND_Y - 120, '#c8833a', 26);
      if (this.cb.onToast) {
        this.cb.onToast('🎉 ¡Vencieron a Abruk! ¡Sigan caminando a la derecha para salvar a Pepe! →', 4500);
      }
    }
  }

  _updateShockwaves(dt) {
    for (const sw of this.shockwaves) {
      sw.x += sw.vx * dt;
      sw.life -= dt;
      for (const p of this.players) {
        if (!p.alive || p.eliminated) continue;
        if (aabb(p, sw)) {
          sw.life = 0;
          this._hurtPlayer(p, sw.x + sw.w / 2);
          break;
        }
      }
    }
    this.shockwaves = this.shockwaves.filter((s) => s.life > 0);
  }

  _hurtPlayer(p, sourceX) {
    if (!p.alive || p.eliminated || p.warpAnim) return;
    // MODO DORADO, INVISIBILIDAD o ESCUDO DE PROTECCIÓN: ¡No reciben daño de enemigos!
    if (p.power === 'gold') {
      this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#fff078', 6);
      return;
    }
    if (p.invisible || p.shieldTimer > 0) {
      return;
    }
    if (p.hurtInvuln > 0) return;

    p.hits -= 1;
    p.hurtInvuln = 0.48;
    p.vx = (p.x + p.w / 2 >= sourceX ? 1 : -1) * 230;
    p.vy = -270;
    p.squashX = 0.82;
    p.squashY = 1.18;
    this.sound.sfxHurt();
    this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#ff5c5c', 8);
    this._addFloatingText(p.x + p.w / 2, p.y - 8, '-1 golpe', '#ff7b7b');

    // Si tenía Espada: dura hasta que lo golpeen 3 veces
    if (p.power === 'sword') {
      p.swordHits -= 1;
      if (p.swordHits <= 0) {
        p.power = 'none';
        p.swordHits = 0;
        this.sound.sfxSwordBreak();
        this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#cfd8e3', 14);
        this._addFloatingText(p.x + p.w / 2, p.y - 26, '⚔️ ¡Espada rota!', '#ffd180');
      }
    }

    // 15 golpes = pierde 1 corazón y reaparece!
    if (p.hits <= 0) {
      this._killPlayerHeart(p, `💔 ¡${p.name} perdió un corazón!`);
    }
  }

  _killPlayerHeart(p, reasonText) {
    if (!p.alive || p.eliminated) return;
    p.alive = false;
    p.hearts -= 1;
    p.power = 'none';
    p.invisible = false;
    p.shieldTimer = 0;
    p.swordHits = 0;
    p.goldTimer = 0;
    p.hits = 0;
    if (p.hearts < START_HEARTS + this.shop.extraLives && this.shop.extraLives > 0) {
      // Si pierde un corazón de los extra comprados, puede volver a comprar hasta el límite de 6
      this.shop.extraLives = Math.max(0, Math.min(this.shop.extraLives, p.hearts - START_HEARTS));
      this._saveShopState();
    }
    this.sound.sfxLoseHeart();
    this.shakeTimer = 0.25;
    this.shakeIntensity = 7;
    this._burstParticles(p.x + p.w / 2, Math.min(p.y + p.h / 2, VIEW_H - 30), '#ff6b6b', 22);

    if (p.hearts <= 0) {
      // Cuando le eliminan los 3 corazones, NO vuelve a reaparecer ESTE jugador (no los dos!)
      p.hearts = 0;
      p.eliminated = true;
      if (this.cb.onToast) {
        this.cb.onToast(`💔 ¡${p.name} se quedó sin corazones!`, 3200);
      }
    } else {
      p.respawnTimer = 1.15;
      if (this.cb.onToast) {
        this.cb.onToast(`${reasonText} (Le quedan ${p.hearts} ❤️)`, 2200);
      }
    }
  }

  _respawnPlayer(p) {
    if (p.eliminated) return;
    p.alive = true;
    p.hits = MAX_HITS_PER_HEART;
    p.hurtInvuln = 2.4;
    p.vx = 0;
    p.vy = -120;
    p.crouching = false;
    this._setPlayerHeight(p, p.standH);

    // En 2 jugadores, reaparece cerca de su primo vivo si está en zona segura
    const partner = this.players.find((o) => o.id !== p.id && o.alive && !o.eliminated);
    if (partner) {
      p.x = partner.x;
      p.y = Math.min(partner.y - 45, GROUND_Y - p.standH - 40);
    } else {
      p.x = p.safeX;
      p.y = p.safeY - 40;
    }
    this._burstParticles(p.x + p.w / 2, p.y + p.h / 2, '#9effa8', 18);
    this._addFloatingText(p.x + p.w / 2, p.y - 12, `¡Volvió ${p.name}!`, '#a6ff9e');
  }

  _checkExitPipe() {
    const ep = this.level.exitPipe;
    if (!ep) return;

    for (const p of this.players) {
      if (!p.alive || p.eliminated) continue;
      const standingOnPipe =
        p.x + p.w > ep.x + 12 &&
        p.x < ep.x + ep.w - 12 &&
        Math.abs(p.y + p.h - ep.y) < 12 &&
        (p.onGround || p.power === 'gold');

      if (standingOnPipe) {
        this._enterExitPipe();
        return;
      }
    }
  }

  _enterExitPipe() {
    this.state = 'pipe_out';
    this.pipeAnimTimer = 0;
    const ep = this.level.exitPipe;
    this.players.forEach((p) => {
      if (p.alive && !p.eliminated) {
        p.x = ep.x + (ep.w - p.w) / 2;
        p.y = ep.y - p.h;
        p.vx = 0;
        p.vy = 0;
        p.pipeSlideY = 0;
      }
    });
    this.sound.sfxPipeEnter();

    const nextIdx = this.levelIndex + 1;
    const nextLevel = this.levels[nextIdx];
    if (this.cb.onTransition) {
      this.cb.onTransition(nextLevel ? nextLevel.introTitle : '¡Siguiente Nivel!', () => {
        this.loadLevel(nextIdx, true);
      });
    }
  }

  _checkPepeRescue() {
    if (!this.level.pepe || !this.bossDefeated || this.pepeRescued) return;
    const pepe = this.level.pepe;
    const reached = this.players.some(
      (p) => p.alive && !p.eliminated && Math.abs((p.x + p.w / 2) - pepe.x) < 95
    );
    if (reached) {
      this.pepeRescued = true;
      this.state = 'victory_walk';
      this.victoryTimer = 0;
      this.sound.sfxVictory();
      for (let i = 0; i < 65; i++) {
        const colors = ['#ffe047', '#5ce864', '#5cc4ff', '#ff6b8b', '#ffffff'];
        this._spawnParticle(
          pepe.x + (Math.random() - 0.5) * 280,
          GROUND_Y - 120 - Math.random() * 140,
          (Math.random() - 0.5) * 260,
          -140 - Math.random() * 220,
          colors[i % colors.length],
          5 + Math.random() * 5,
          1.8 + Math.random() * 1.1
        );
      }
      if (this.cb.onToast) {
        this.cb.onToast('🎉 ¡ENCONTRARON A PEPE! ¡LO SALVARON! 🎉', 3500);
      }
    }
  }

  _nearestLivingPlayer(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.players) {
      if (!p.alive || p.eliminated || p.invisible) continue;
      const d = Math.hypot((p.x + p.w / 2) - x, (p.y + p.h / 2) - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  _updateCamera(dt) {
    let targetX = this.cameraX;

    if (this.bossActive && !this.bossDefeated && this.level.bossArena) {
      targetX = this.level.bossArena.minX - 40;
    } else {
      const living = this.players.filter((p) => p.alive && !p.eliminated);
      if (living.length > 0) {
        const avgX = living.reduce((acc, p) => acc + p.x + p.w / 2, 0) / living.length;
        targetX = avgX - VIEW_W * 0.42;
      }
    }

    targetX = clamp(targetX, 0, Math.max(0, this.level.width - VIEW_W));
    this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 10.5);
  }

  _spawnParticle(x, y, vx, vy, color, size, life) {
    this.particles.push({ x, y, vx, vy, color, size, life, maxLife: life });
  }

  _burstParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 70 + Math.random() * 190;
      this._spawnParticle(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd - 60,
        color,
        4 + Math.random() * 4.5,
        0.45 + Math.random() * 0.35
      );
    }
  }

  _addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1.15, maxLife: 1.15 });
  }

  _updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 420 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  _updateFloatingTexts(dt) {
    for (const ft of this.floatingTexts) {
      ft.y -= 42 * dt;
      ft.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.life > 0);
  }

  _syncHud() {
    if (!this.cb.onHudUpdate) return;
    const living = this.players.filter((p) => !p.eliminated);
    const maxPlayerX = living.length > 0 ? Math.max(...living.map((p) => p.x)) : 0;
    const goalX = this.level.exitPipe ? this.level.exitPipe.x : (this.level.pepe ? this.level.pepe.x : this.level.width);
    const progress = clamp(maxPlayerX / goalX, 0, 1);

    this.cb.onHudUpdate({
      mode: this.mode,
      levelName: this.level.name,
      progress,
      coins: this.shop.coins,
      hasInvis: this.shop.hasInvis,
      players: this.players,
      boss: this.bossActive && this.boss ? this.boss : null,
    });
  }
}
