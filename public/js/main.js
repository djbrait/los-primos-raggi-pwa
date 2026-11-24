import { loadAllAssets } from './assets.js?v=7';
import { SoundManager } from './audio.js?v=7';
import { GameEngine, SHOP_ITEMS } from './engine.js?v=7';
import { GameRenderer } from './renderer.js?v=7';

// Elementos del DOM
const canvas = document.getElementById('game-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingBarFill = document.getElementById('loading-bar-fill');
const menuOverlay = document.getElementById('menu-overlay');
const modeOverlay = document.getElementById('mode-overlay');
const shopOverlay = document.getElementById('shop-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const victoryOverlay = document.getElementById('victory-overlay');
const hud = document.getElementById('hud');
const toastBanner = document.getElementById('toast-banner');
const transitionCurtain = document.getElementById('transition-curtain');
const transitionText = document.getElementById('transition-text');
const touchControls = document.getElementById('touch-controls');
const btnTouchInvis = document.getElementById('btn-touch-invis');

// Menú y Tienda
const menuCoinsEl = document.getElementById('menu-coins');
const shopCoinsEl = document.getElementById('shop-coins');
const badgeLife = document.getElementById('badge-life');
const badgeInvis = document.getElementById('badge-invis');
const badgeShield = document.getElementById('badge-shield');
const shopDetailModal = document.getElementById('shop-detail-modal');
const shopDetailTitle = document.getElementById('shop-detail-title');
const shopDetailPriceText = document.getElementById('shop-detail-price-text');
const shopDetailDesc = document.getElementById('shop-detail-desc');
const shopDetailStatus = document.getElementById('shop-detail-status');
const btnShopBuy = document.getElementById('btn-shop-buy');
const btnShopDetailClose = document.getElementById('btn-shop-detail-close');

// HUD refs
const hudP1 = document.getElementById('hud-p1');
const hudP1Avatar = document.getElementById('hud-p1-avatar');
const hudP1Hearts = document.getElementById('hud-p1-hearts');
const hudP1Hp = document.getElementById('hud-p1-hp');
const hudP1HpText = document.getElementById('hud-p1-hp-text');
const hudP1Power = document.getElementById('hud-p1-power');

const hudP2 = document.getElementById('hud-p2');
const hudP2Avatar = document.getElementById('hud-p2-avatar');
const hudP2Hearts = document.getElementById('hud-p2-hearts');
const hudP2Hp = document.getElementById('hud-p2-hp');
const hudP2HpText = document.getElementById('hud-p2-hp-text');
const hudP2Power = document.getElementById('hud-p2-power');

const hudLevelName = document.getElementById('hud-level-name');
const hudCoins = document.getElementById('hud-coins');
const hudProgressWrap = document.getElementById('hud-progress-wrap');
const hudProgressFill = document.getElementById('hud-progress-fill');
const hudBossWrap = document.getElementById('hud-boss-wrap');
const hudBossFill = document.getElementById('hud-boss-fill');
const victoryNachoImg = document.getElementById('victory-nacho-img');
const victoryMsg = document.getElementById('victory-msg');
const gameoverMsg = document.getElementById('gameover-msg');

// Botones
const btnOpenPlay = document.getElementById('btn-open-play');
const btnOpenShop = document.getElementById('btn-open-shop');
const btnCloseMode = document.getElementById('btn-close-mode');
const btnShopBack = document.getElementById('btn-shop-back');
const btn1p = document.getElementById('btn-1p');
const btn2p = document.getElementById('btn-2p');
const btnMenuSound = document.getElementById('btn-menu-sound');
const btnHudSound = document.getElementById('btn-hud-sound');
const btnHudPause = document.getElementById('btn-hud-pause');
const btnHudExit = document.getElementById('btn-hud-exit');
const btnResume = document.getElementById('btn-resume');
const btnRestartLevel = document.getElementById('btn-restart-level');
const btnPauseMenu = document.getElementById('btn-pause-menu');
const btnRetry = document.getElementById('btn-retry');
const btnGameoverMenu = document.getElementById('btn-gameover-menu');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnVictoryMenu = document.getElementById('btn-victory-menu');
const btnInstallPwa = document.getElementById('btn-install-pwa');

const sound = new SoundManager();
let engine = null;
let renderer = null;
let toastTimer = null;
let deferredInstallPrompt = null;
let selectedShopItemId = null;

// Registrar Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=7').then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  btnInstallPwa.classList.remove('hidden');
});

btnInstallPwa.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  btnInstallPwa.classList.add('hidden');
});

function showOverlay(target) {
  [loadingOverlay, menuOverlay, modeOverlay, shopOverlay, pauseOverlay, gameoverOverlay, victoryOverlay].forEach((el) => {
    el.classList.toggle('active', el === target);
  });
}

function showToast(message, durationMs = 2800) {
  toastBanner.textContent = message;
  toastBanner.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastBanner.classList.add('hidden');
  }, durationMs);
}

function runPipeTransition(titleText, onDarkCallback) {
  setTimeout(() => {
    transitionText.textContent = titleText;
    transitionCurtain.classList.add('dark');
    setTimeout(() => {
      if (onDarkCallback) onDarkCallback();
      setTimeout(() => {
        transitionCurtain.classList.remove('dark');
      }, 650);
    }, 650);
  }, 620);
}

const hudCache = {};
function setTextIfChanged(id, el, val) {
  if (hudCache[id] !== val) {
    hudCache[id] = val;
    el.textContent = val;
  }
}
function setStyleWidthIfChanged(id, el, val) {
  if (hudCache[id] !== val) {
    hudCache[id] = val;
    el.style.width = val;
  }
}

function renderPlayerHud(p, cardEl, avatarEl, heartsEl, hpEl, hpTextEl, powerEl) {
  const k = `p${p.id}`;
  cardEl.classList.toggle('eliminated', p.eliminated);

  let hStr = '';
  const totalHearts = p.maxHearts || 3;
  for (let i = 0; i < totalHearts; i++) {
    hStr += i < p.hearts ? '❤️' : '🖤';
  }
  setTextIfChanged(`${k}_hearts`, heartsEl, hStr);

  const pct = p.eliminated ? 0 : Math.round(Math.max(0, Math.min(100, (p.hits / p.maxHits) * 100)));
  setStyleWidthIfChanged(`${k}_hpw`, hpEl, `${pct}%`);
  hpEl.classList.toggle('low', p.hits <= 5);
  setTextIfChanged(`${k}_hpt`, hpTextEl, p.eliminated ? 'Fuera' : `${p.hits}/${p.maxHits}`);

  const avatarSrc = p.power === 'gold'
    ? `./assets/sprites/${p.spriteBase}_gold_idle.png`
    : p.power === 'sword'
      ? `./assets/sprites/${p.spriteBase}_sword_idle.png`
      : `./assets/sprites/${p.spriteBase}_idle.png`;
  if (hudCache[`${k}_av`] !== avatarSrc) {
    hudCache[`${k}_av`] = avatarSrc;
    avatarEl.src = avatarSrc;
  }

  let pClass = 'power-badge hidden';
  let pText = '';
  if (p.eliminated) {
    pClass = 'power-badge';
    pText = '💔 Sin corazones';
  } else if (p.power === 'sword') {
    pClass = 'power-badge sword';
    pText = `⚔️ Espada (${p.swordHits}/3)`;
  } else if (p.power === 'gold') {
    pClass = 'power-badge gold';
    pText = `✨ Dorado · ${p.goldTimer.toFixed(1)}s`;
  } else if (p.shieldTimer > 0) {
    pClass = 'power-badge shield';
    pText = `🛡️ Escudo · ${p.shieldTimer.toFixed(0)}s`;
  } else if (p.invisible) {
    pClass = 'power-badge invis';
    pText = '🧪 Invisible';
  }
  if (hudCache[`${k}_pc`] !== pClass) {
    hudCache[`${k}_pc`] = pClass;
    powerEl.className = pClass;
  }
  setTextIfChanged(`${k}_pt`, powerEl, pText);
}

function updateHud(data) {
  setTextIfChanged('lvl', hudLevelName, data.levelName);
  setTextIfChanged('coins', hudCoins, String(data.coins ?? 0));
  setStyleWidthIfChanged('prog', hudProgressFill, `${Math.round(data.progress * 100)}%`);

  // Mostrar botón de botella en móvil SOLO si compró Invisibilidad y aún no la usó
  if (btnTouchInvis) {
    btnTouchInvis.classList.toggle('hidden', !data.hasInvis);
  }

  if (data.players[0]) {
    renderPlayerHud(data.players[0], hudP1, hudP1Avatar, hudP1Hearts, hudP1Hp, hudP1HpText, hudP1Power);
  }
  if (data.mode === 2 && data.players[1]) {
    hudP2.classList.remove('hidden');
    renderPlayerHud(data.players[1], hudP2, hudP2Avatar, hudP2Hearts, hudP2Hp, hudP2HpText, hudP2Power);
  } else {
    hudP2.classList.add('hidden');
  }

  if (data.boss && data.boss.alive) {
    hudBossWrap.classList.remove('hidden');
    hudProgressWrap.classList.add('hidden');
    setStyleWidthIfChanged('boss', hudBossFill, `${Math.round(Math.max(0, (data.boss.hp / data.boss.maxHp) * 100))}%`);
  } else {
    hudBossWrap.classList.add('hidden');
    hudProgressWrap.classList.remove('hidden');
  }
}

function syncShopUI() {
  if (!engine) return;
  const s = engine.shop;
  menuCoinsEl.textContent = String(s.coins);
  shopCoinsEl.textContent = String(s.coins);
  badgeLife.textContent = `${s.extraLives}/6`;
  badgeInvis.classList.toggle('hidden', !s.hasInvis);
  badgeShield.classList.toggle('hidden', !s.hasShield);

  if (selectedShopItemId) {
    openShopDetail(selectedShopItemId);
  }
}

function openShopDetail(itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item || !engine) return;
  selectedShopItemId = itemId;
  const s = engine.shop;

  shopDetailTitle.textContent = item.name;
  shopDetailPriceText.textContent = String(item.price);
  shopDetailDesc.textContent = item.desc;

  let canBuy = s.coins >= item.price;
  let statusTxt = '';
  let btnLabel = `Comprar (${item.price} 🪙)`;

  if (itemId === 'life') {
    statusTxt = `Vidas extra actuales: ${s.extraLives} / 6`;
    if (s.extraLives >= 6) {
      canBuy = false;
      btnLabel = 'Máximo alcanzado (6/6)';
    } else if (s.coins < item.price) {
      btnLabel = 'Monedas insuficientes';
    }
  } else if (itemId === 'invis') {
    statusTxt = s.hasInvis ? '¡Ya tienes Invisibilidad lista! Actívala con la tecla 2.' : 'Disponible (máximo 1)';
    if (s.hasInvis) {
      canBuy = false;
      btnLabel = 'Ya comprado';
    } else if (s.coins < item.price) {
      btnLabel = 'Monedas insuficientes';
    }
  } else if (itemId === 'shield') {
    statusTxt = s.hasShield ? '¡Ya tienes Protección lista! Se activará al empezar a jugar.' : 'Disponible (máximo 1)';
    if (s.hasShield) {
      canBuy = false;
      btnLabel = 'Ya comprado';
    } else if (s.coins < item.price) {
      btnLabel = 'Monedas insuficientes';
    }
  }

  shopDetailStatus.textContent = statusTxt;
  btnShopBuy.textContent = btnLabel;
  btnShopBuy.disabled = !canBuy;
  shopDetailModal.classList.remove('hidden');
}

function syncSoundButtons() {
  const on = !sound.muted;
  btnMenuSound.textContent = on ? 'Música: SI' : 'Música: NO';
  btnMenuSound.classList.toggle('off', !on);
  btnHudSound.textContent = on ? '🔊' : '🔇';
}

function goToMenu() {
  engine.state = 'menu';
  engine.level = engine.levels[0];
  engine.clearInput();
  hud.classList.add('hidden');
  touchControls.classList.add('hidden');
  syncShopUI();
  showOverlay(menuOverlay);
  sound.playMusic('main');
}

function startMode(mode) {
  sound.unlock();
  sound.playMusic('main');
  showOverlay(null);
  hud.classList.remove('hidden');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    touchControls.classList.remove('hidden');
  }
  engine.startNewGame(mode);
}

function togglePause() {
  if (!engine) return;
  if (engine.state === 'playing') {
    engine.state = 'paused';
    engine.clearInput();
    showOverlay(pauseOverlay);
  } else if (engine.state === 'paused') {
    engine.state = 'playing';
    showOverlay(null);
  }
}

// Eventos Menú / Tienda / Modo
btnOpenPlay.addEventListener('click', () => {
  sound.unlock();
  showOverlay(modeOverlay);
});
btnCloseMode.addEventListener('click', () => showOverlay(menuOverlay));

btnOpenShop.addEventListener('click', () => {
  sound.unlock();
  selectedShopItemId = null;
  shopDetailModal.classList.add('hidden');
  syncShopUI();
  showOverlay(shopOverlay);
});
btnShopBack.addEventListener('click', () => {
  selectedShopItemId = null;
  shopDetailModal.classList.add('hidden');
  syncShopUI();
  showOverlay(menuOverlay);
});

document.querySelectorAll('.shop-hotspot').forEach((btn) => {
  btn.addEventListener('click', () => openShopDetail(btn.dataset.item));
});
btnShopDetailClose.addEventListener('click', () => {
  selectedShopItemId = null;
  shopDetailModal.classList.add('hidden');
});
btnShopBuy.addEventListener('click', () => {
  if (!selectedShopItemId || !engine) return;
  const res = engine.buyShopItem(selectedShopItemId);
  if (res.ok) {
    sound.sfxPowerUp(true);
    syncShopUI();
  }
});

btn1p.addEventListener('click', () => startMode(1));
btn2p.addEventListener('click', () => startMode(2));

btnMenuSound.addEventListener('click', () => {
  sound.unlock();
  sound.toggleMute();
  syncSoundButtons();
});

btnHudSound.addEventListener('click', () => {
  sound.unlock();
  sound.toggleMute();
  syncSoundButtons();
});

btnHudPause.addEventListener('click', togglePause);
btnHudExit.addEventListener('click', goToMenu);
btnResume.addEventListener('click', togglePause);
btnRestartLevel.addEventListener('click', () => {
  showOverlay(null);
  engine.restartCurrentLevel();
});
btnPauseMenu.addEventListener('click', goToMenu);

btnRetry.addEventListener('click', () => {
  showOverlay(null);
  engine.restartCurrentLevel();
});
btnGameoverMenu.addEventListener('click', goToMenu);

btnPlayAgain.addEventListener('click', () => startMode(engine.mode));
btnVictoryMenu.addEventListener('click', goToMenu);

// Controles de teclado
const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Digit1', 'Numpad1', 'Digit2', 'Numpad2',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyF', 'KeyE',
  'Space',
]);

window.addEventListener('pointerdown', () => {
  sound.unlock();
}, { passive: true });

window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (GAME_KEYS.has(e.code)) {
    e.preventDefault();
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && engine && (engine.state === 'playing' || engine.state === 'paused')) {
    togglePause();
    return;
  }
  if (engine) {
    engine.handleKeyDown(e.code);
  }
});

window.addEventListener('keyup', (e) => {
  if (engine) {
    engine.handleKeyUp(e.code);
  }
});

window.addEventListener('blur', () => {
  if (engine) engine.clearInput();
});

// Controles táctiles para móvil/tablet PWA
document.querySelectorAll('.touch-wood-btn[data-key]').forEach((btn) => {
  const code = btn.dataset.key;
  const press = (ev) => {
    ev.preventDefault();
    if (engine) engine.handleKeyDown(code);
  };
  const release = (ev) => {
    ev.preventDefault();
    if (engine) engine.handleKeyUp(code);
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
});

if (btnTouchInvis) {
  btnTouchInvis.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (engine) engine.activateInvisibility();
  });
}

// Inicializar juego
async function bootstrap() {
  const assets = await loadAllAssets((ratio) => {
    loadingBarFill.style.width = `${Math.max(8, Math.round(ratio * 100))}%`;
  });

  engine = new GameEngine(assets, sound, {
    onHudUpdate: updateHud,
    onToast: showToast,
    onTransition: runPipeTransition,
    onGameOver: (mode) => {
      gameoverMsg.textContent = mode === 1
        ? '¡Lucio se quedó sin corazones! ¡Inténtalo de nuevo para salvar a Pepe!'
        : '¡Lucio y Nacho se quedaron sin corazones! ¡Inténtenlo de nuevo para salvar a Pepe!';
      showOverlay(gameoverOverlay);
    },
    onVictory: (mode) => {
      victoryNachoImg.classList.toggle('hidden', mode === 1);
      victoryMsg.textContent = mode === 1
        ? '¡Lucio venció a Abruk y rescató a Pepe! ¡Eres un verdadero campeón!'
        : '¡Lucio y Nacho vencieron a Abruk y rescataron a Pepe! ¡Los Primos Raggi son imparables!';
      showOverlay(victoryOverlay);
    },
  });

  renderer = new GameRenderer(canvas, assets);
  window.__primosRaggi = engine;

  syncShopUI();
  showOverlay(menuOverlay);
  syncSoundButtons();
  sound.playMusic('main');

  let lastTs = performance.now();
  function loop(ts) {
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    engine.update(dt);
    renderer.render(engine);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

bootstrap();
