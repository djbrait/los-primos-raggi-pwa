// Diseño completo de los 3 niveles de Los Primos Raggi
// Coordenadas virtuales en lienzo 1280x720, suelo principal en y = 588

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const GROUND_Y = 588;

export function buildLevels() {
  return [
    // =========================================================================
    // NIVEL 1: EL BOSQUE (Inspirado en Imagen 4)
    // =========================================================================
    {
      id: 0,
      key: 'forest',
      name: 'Nivel 1 · El Bosque',
      introTitle: '🌲 Nivel 1: El Bosque',
      introSub: '¡Cuidado con los Mateos, las Erins y los pozos!',
      bgKey: 'bg_forest',
      groundKey: 'ground_forest',
      music: 'forest',
      isUnderwater: false,
      width: 5800,
      spawn: { x: 110, y: GROUND_Y },
      // Segmentos de suelo sólido [x1, x2]; los huecos entre segmentos son POZOS
      groundSegments: [
        [0, 1080],
        [1240, 2120],
        [2440, 3260],
        [3740, 4440],
        [4620, 5800],
      ],
      // Plataformas de troncos horizontales (para pasar pozos sin ir por el suelo) y pilares de madera
      platforms: [
        // Par de tubos-tronco conectados como cuerda (A <-> B)
        { kind: 'pillar', x: 520, y: GROUND_Y - 92, w: 86, h: 92, warpId: 'l1_a1', warpTarget: 'l1_a2' },
        { kind: 'pillar', x: 860, y: GROUND_Y - 134, w: 92, h: 134, warpId: 'l1_a2', warpTarget: 'l1_a1' },

        // Pozo 1 (1080..1240) con bloque de tronco encima
        { kind: 'log', x: 1090, y: GROUND_Y - 68, w: 145, h: 30 },

        // Sección alta de troncos sobre el suelo con LuckyBlock
        { kind: 'log', x: 1500, y: GROUND_Y - 108, w: 160, h: 30 },
        { kind: 'log', x: 1730, y: GROUND_Y - 165, w: 165, h: 30 },

        // Pozo 2 grande (2120..2440): puente de troncos flotantes
        { kind: 'log', x: 2150, y: GROUND_Y - 58, w: 130, h: 30 },
        { kind: 'log', x: 2310, y: GROUND_Y - 118, w: 125, h: 30 },

        // Segundo par de tubos-tronco conectados (B1 <-> B2)
        { kind: 'pillar', x: 2680, y: GROUND_Y - 106, w: 88, h: 106, warpId: 'l1_b1', warpTarget: 'l1_b2' },
        { kind: 'pillar', x: 2990, y: GROUND_Y - 142, w: 94, h: 142, warpId: 'l1_b2', warpTarget: 'l1_b1' },

        // Pozo 3 enorme (3260..3740): 3 bloques de troncos escalonados
        { kind: 'log', x: 3290, y: GROUND_Y - 65, w: 130, h: 30 },
        { kind: 'log', x: 3455, y: GROUND_Y - 130, w: 135, h: 30 },
        { kind: 'log', x: 3610, y: GROUND_Y - 75, w: 125, h: 30 },

        // Ruta elevada opcional sobre Mateos
        { kind: 'log', x: 4000, y: GROUND_Y - 118, w: 175, h: 30 },

        // Pozo 4 (4440..4620)
        { kind: 'log', x: 4465, y: GROUND_Y - 78, w: 135, h: 30 },

        // Escalera de troncos hacia el final
        { kind: 'pillar', x: 4920, y: GROUND_Y - 96, w: 88, h: 96 },
        { kind: 'log', x: 5100, y: GROUND_Y - 148, w: 155, h: 30 },
      ],
      // LuckyBlocks de madera con "?" blanco (aparecen de vez en cuando, sin recargarse)
      luckyBlocks: [
        { x: 430, y: GROUND_Y - 144, content: 'random' },
        { x: 2835, y: GROUND_Y - 210, content: 'random' },
        { x: 4210, y: GROUND_Y - 148, content: 'random' },
      ],
      // Enemigos: Mateos (caminan con espada) y Erins (vuelan y lanzan meteoritos)
      enemies: [
        { type: 'mateo', x: 670, y: GROUND_Y, minX: 615, maxX: 845 },
        { type: 'mateo', x: 1420, y: GROUND_Y, minX: 1270, maxX: 1680 },
        { type: 'erin',  x: 1620, y: 215, minX: 1360, maxX: 1980 },
        { type: 'mateo', x: 1920, y: GROUND_Y, minX: 1720, maxX: 2080 },
        { type: 'erin',  x: 2320, y: 195, minX: 2120, maxX: 2620 },
        { type: 'mateo', x: 2840, y: GROUND_Y, minX: 2775, maxX: 2980 },
        { type: 'mateo', x: 3120, y: GROUND_Y, minX: 3090, maxX: 3240 },
        { type: 'erin',  x: 3500, y: 190, minX: 3280, maxX: 3740 },
        { type: 'mateo', x: 3960, y: GROUND_Y, minX: 3780, maxX: 4380 },
        { type: 'mateo', x: 4240, y: GROUND_Y, minX: 3820, maxX: 4400 },
        { type: 'erin',  x: 4780, y: 205, minX: 4580, maxX: 5220 },
        { type: 'mateo', x: 5180, y: GROUND_Y, minX: 5020, maxX: 5390 },
      ],
      // Tubo de madera de salida hacia el Nivel 2
      exitPipe: { x: 5475, y: GROUND_Y - 122, w: 108, h: 122 },
      bossArena: null,
      pepe: null,
    },

    // =========================================================================
    // NIVEL 2: LA ALDEA ABANDONADA (Inspirado en Imagen 5)
    // =========================================================================
    {
      id: 1,
      key: 'village',
      name: 'Nivel 2 · Aldea Abandonada',
      introTitle: '🏚️ Nivel 2: Aldea Abandonada',
      introSub: '¡Salten sobre los troncos y esquiven los meteoritos!',
      bgKey: 'bg_village',
      groundKey: 'ground_village',
      music: 'village',
      isUnderwater: false,
      width: 6350,
      spawn: { x: 110, y: GROUND_Y },
      groundSegments: [
        [0, 960],
        [1240, 2000],
        [2460, 3160],
        [3720, 4420],
        [4920, 6350],
      ],
      platforms: [
        // Par de tubos-tronco conectados en entrada de la aldea (A1 <-> A2)
        { kind: 'pillar', x: 380, y: GROUND_Y - 88, w: 86, h: 88, warpId: 'l2_a1', warpTarget: 'l2_a2' },
        { kind: 'pillar', x: 700, y: GROUND_Y - 146, w: 94, h: 146, warpId: 'l2_a2', warpTarget: 'l2_a1' },

        // Pozo 1 (960..1240)
        { kind: 'log', x: 1005, y: GROUND_Y - 72, w: 180, h: 30 },

        // Pasarela elevada de la aldea
        { kind: 'log', x: 1420, y: GROUND_Y - 115, w: 155, h: 30 },
        { kind: 'log', x: 1675, y: GROUND_Y - 175, w: 170, h: 30 },

        // Pozo 2 largo (2000..2460) con 3 troncos
        { kind: 'log', x: 2040, y: GROUND_Y - 62, w: 125, h: 30 },
        { kind: 'log', x: 2190, y: GROUND_Y - 130, w: 135, h: 30 },
        { kind: 'log', x: 2345, y: GROUND_Y - 84, w: 120, h: 30 },

        // Plaza abandonada con par de tubos-tronco conectados (B1 <-> B2)
        { kind: 'pillar', x: 2660, y: GROUND_Y - 122, w: 90, h: 122, warpId: 'l2_b1', warpTarget: 'l2_b2' },
        { kind: 'pillar', x: 2940, y: GROUND_Y - 94, w: 86, h: 94, warpId: 'l2_b2', warpTarget: 'l2_b1' },

        // Pozo 3 del molino (3160..3720): secuencia de 4 troncos
        { kind: 'log', x: 3195, y: GROUND_Y - 66, w: 125, h: 30 },
        { kind: 'log', x: 3340, y: GROUND_Y - 138, w: 130, h: 30 },
        { kind: 'log', x: 3495, y: GROUND_Y - 188, w: 130, h: 30 },
        { kind: 'log', x: 3610, y: GROUND_Y - 90, w: 118, h: 30 },

        // Patio con Mateos y troncos altos
        { kind: 'log', x: 3920, y: GROUND_Y - 124, w: 165, h: 30 },
        { kind: 'log', x: 4170, y: GROUND_Y - 178, w: 155, h: 30 },

        // Pozo 4 final (4420..4920): puente aéreo de troncos
        { kind: 'log', x: 4455, y: GROUND_Y - 68, w: 130, h: 30 },
        { kind: 'log', x: 4615, y: GROUND_Y - 135, w: 135, h: 30 },
        { kind: 'log', x: 4775, y: GROUND_Y - 88, w: 130, h: 30 },

        // Recta final antes del tubo (par conectado C1 <-> C2)
        { kind: 'pillar', x: 5260, y: GROUND_Y - 110, w: 90, h: 110, warpId: 'l2_c1', warpTarget: 'l2_c2' },
        { kind: 'pillar', x: 5620, y: GROUND_Y - 150, w: 94, h: 150, warpId: 'l2_c2', warpTarget: 'l2_c1' },
      ],
      luckyBlocks: [
        { x: 540, y: GROUND_Y - 165, content: 'random' },
        { x: 2790, y: GROUND_Y - 210, content: 'random' },
        { x: 5435, y: GROUND_Y - 180, content: 'random' },
      ],
      enemies: [
        { type: 'mateo', x: 540, y: GROUND_Y, minX: 475, maxX: 690 },
        { type: 'erin',  x: 1100, y: 195, minX: 880, maxX: 1450 },
        { type: 'mateo', x: 1540, y: GROUND_Y, minX: 1270, maxX: 1950 },
        { type: 'mateo', x: 1840, y: GROUND_Y, minX: 1300, maxX: 1970 },
        { type: 'erin',  x: 2200, y: 185, minX: 1960, maxX: 2560 },
        { type: 'mateo', x: 2800, y: GROUND_Y, minX: 2755, maxX: 2930 },
        { type: 'erin',  x: 3380, y: 175, minX: 3120, maxX: 3740 },
        { type: 'mateo', x: 3920, y: GROUND_Y, minX: 3750, maxX: 4380 },
        { type: 'mateo', x: 4210, y: GROUND_Y, minX: 3770, maxX: 4390 },
        { type: 'erin',  x: 4650, y: 185, minX: 4400, maxX: 4960 },
        { type: 'mateo', x: 5120, y: GROUND_Y, minX: 4960, maxX: 5250 },
        { type: 'mateo', x: 5450, y: GROUND_Y, minX: 5360, maxX: 5610 },
        { type: 'erin',  x: 5680, y: 200, minX: 5300, maxX: 5940 },
      ],
      exitPipe: { x: 6020, y: GROUND_Y - 122, w: 108, h: 122 },
      bossArena: null,
      pepe: null,
    },

    // =========================================================================
    // NIVEL 3: DEBAJO DEL AGUA + JEFE FINAL ABRUK + RESCATE DE PEPE (Imagen 6 & 14)
    // =========================================================================
    {
      id: 2,
      key: 'underwater',
      name: 'Nivel 3 · Fondo del Mar',
      introTitle: '🌊 Nivel 3: Debajo del Agua',
      introSub: '¡Abruk tiene a Pepe al final de las ruinas submarinas!',
      bgKey: 'bg_underwater',
      groundKey: 'ground_underwater',
      music: 'underwater',
      isUnderwater: true,
      width: 7260,
      spawn: { x: 110, y: GROUND_Y },
      groundSegments: [
        [0, 1080],
        [1420, 2240],
        [2740, 3540],
        [4060, 4760],
        [5060, 7260], // Arena de Abruk + Santuario de Pepe
      ],
      platforms: [
        // Par de tubos-tronco submarinos conectados (A1 <-> A2)
        { kind: 'pillar', x: 420, y: GROUND_Y - 94, w: 86, h: 94, warpId: 'l3_a1', warpTarget: 'l3_a2' },
        { kind: 'pillar', x: 740, y: GROUND_Y - 156, w: 96, h: 156, warpId: 'l3_a2', warpTarget: 'l3_a1' },

        // Fosa submarina 1 (1080..1420)
        { kind: 'log', x: 1110, y: GROUND_Y - 78, w: 140, h: 30 },
        { kind: 'log', x: 1275, y: GROUND_Y - 136, w: 140, h: 30 },

        // Arrecife medio
        { kind: 'pillar', x: 1640, y: GROUND_Y - 110, w: 88, h: 110 },
        { kind: 'log', x: 1840, y: GROUND_Y - 165, w: 175, h: 30 },

        // Fosa submarina 2 (2240..2740)
        { kind: 'log', x: 2275, y: GROUND_Y - 70, w: 135, h: 30 },
        { kind: 'log', x: 2435, y: GROUND_Y - 142, w: 140, h: 30 },
        { kind: 'log', x: 2600, y: GROUND_Y - 92, w: 130, h: 30 },

        // Ruinas del barco hundido (par conectado B1 <-> B2)
        { kind: 'pillar', x: 2980, y: GROUND_Y - 140, w: 94, h: 140, warpId: 'l3_b1', warpTarget: 'l3_b2' },
        { kind: 'pillar', x: 3280, y: GROUND_Y - 96, w: 88, h: 96, warpId: 'l3_b2', warpTarget: 'l3_b1' },

        // Fosa submarina 3 (3540..4060)
        { kind: 'log', x: 3575, y: GROUND_Y - 72, w: 135, h: 30 },
        { kind: 'log', x: 3735, y: GROUND_Y - 150, w: 145, h: 30 },
        { kind: 'log', x: 3910, y: GROUND_Y - 95, w: 135, h: 30 },

        // Última fosa antes de la Arena de Abruk (4760..5060)
        { kind: 'log', x: 4815, y: GROUND_Y - 82, w: 185, h: 30 },

        // Plataformas de troncos dentro de la Arena de Abruk (para saltar sobre Abruk!)
        { kind: 'log', x: 5440, y: GROUND_Y - 145, w: 180, h: 30 },
        { kind: 'log', x: 5950, y: GROUND_Y - 145, w: 180, h: 30 },
      ],
      luckyBlocks: [
        { x: 575, y: GROUND_Y - 182, content: 'random' },
        { x: 3130, y: GROUND_Y - 220, content: 'random' },
        // Un único LuckyBlock en la arena de Abruk (NO se recarga!)
        { x: 5500, y: GROUND_Y - 275, content: 'random' },
      ],
      enemies: [
        { type: 'mateo', x: 580, y: GROUND_Y, minX: 515, maxX: 730 },
        { type: 'erin',  x: 1240, y: 190, minX: 1000, maxX: 1520 },
        { type: 'mateo', x: 1840, y: GROUND_Y, minX: 1735, maxX: 2200 },
        { type: 'erin',  x: 2480, y: 175, minX: 2220, maxX: 2780 },
        { type: 'mateo', x: 3130, y: GROUND_Y, minX: 3080, maxX: 3270 },
        { type: 'erin',  x: 3780, y: 185, minX: 3520, maxX: 4100 },
        { type: 'mateo', x: 4340, y: GROUND_Y, minX: 4100, maxX: 4720 },
        { type: 'mateo', x: 4580, y: GROUND_Y, minX: 4120, maxX: 4730 },
      ],
      exitPipe: null,
      bossArena: {
        triggerX: 5250,
        minX: 5160,
        maxX: 6360,
        gateX: 6360,
        bossSpawn: { x: 6040, y: GROUND_Y },
      },
      // Al vencer a Abruk siguen caminando hasta encontrar a Pepe!
      pepe: { x: 6920, y: GROUND_Y },
    },
  ];
}
