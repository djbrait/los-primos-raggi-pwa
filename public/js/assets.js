// Cargador de todos los sprites, fondos y texturas de Los Primos Raggi

const SPRITE_LIST = [
  // Lucio Normal
  'lucio_idle', 'lucio_walk', 'lucio_run', 'lucio_jump', 'lucio_crouch', 'lucio_win',
  // Nacho Normal
  'nacho_idle', 'nacho_walk', 'nacho_run', 'nacho_jump', 'nacho_crouch', 'nacho_win',
  // Lucio Espada
  'lucio_sword_idle', 'lucio_sword_walk', 'lucio_sword_run', 'lucio_sword_jump', 'lucio_sword_crouch', 'lucio_sword_attack',
  // Nacho Espada
  'nacho_sword_idle', 'nacho_sword_walk', 'nacho_sword_run', 'nacho_sword_jump', 'nacho_sword_crouch', 'nacho_sword_attack',
  // Lucio Dorado
  'lucio_gold_idle', 'lucio_gold_fly', 'lucio_gold_fastfly', 'lucio_gold_ascend', 'lucio_gold_descend', 'lucio_gold_win',
  // Nacho Dorado
  'nacho_gold_idle', 'nacho_gold_fly', 'nacho_gold_fastfly', 'nacho_gold_ascend', 'nacho_gold_descend', 'nacho_gold_win',
  // Enemigos y Jefe
  'mateo_walk', 'mateo_attack',
  'erin_fly', 'erin_attack', 'meteorite',
  'abruk_idle', 'abruk_run', 'abruk_jump', 'abruk_attack',
  // Bloques, Objetos, Troncos/Tubos de madera, Monedas, Iconos y Pepe la Rana
  'luckyblock', 'popo_brown', 'popo_orange',
  'wooden_pipe', 'trunk_1', 'trunk_2', 'trunk_3', 'trunk_4',
  'pepe', 'pepe_idle', 'pepe_jump',
  'coin_medieval', 'icon_invis', 'menu_lucio', 'menu_nacho',
];

const EXTRA_IMAGES = {
  logo: './assets/logo.png',
  bg_forest: './assets/bg/level1_forest.jpg',
  bg_village: './assets/bg/level2_village.jpg',
  bg_underwater: './assets/bg/level3_underwater.jpg',
  bg_shop: './assets/bg/shop_mia.jpg',
  ground_forest: './assets/bg/ground_forest.png',
  ground_village: './assets/bg/ground_village.png',
  ground_underwater: './assets/bg/ground_underwater.png',
};

export async function loadAllAssets(onProgress) {
  const images = {};
  const entries = [
    ...SPRITE_LIST.map((key) => [key, `./assets/sprites/${key}.png`]),
    ...Object.entries(EXTRA_IMAGES),
  ];

  let loaded = 0;
  const total = entries.length;

  await Promise.all(
    entries.map(
      ([key, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[key] = img;
            loaded += 1;
            if (onProgress) onProgress(loaded / total);
            resolve();
          };
          img.onerror = () => {
            console.warn(`No se pudo cargar imagen: ${src}`);
            loaded += 1;
            if (onProgress) onProgress(loaded / total);
            resolve();
          };
          img.src = src;
        })
    )
  );

  return images;
}
