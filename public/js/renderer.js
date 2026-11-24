import { VIEW_W, VIEW_H, GROUND_Y } from './levels.js?v=6';

export class GameRenderer {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this._bgCache = new Map();
    this._groundCache = new Map();
  }

  _getParallaxStrip(bgKey) {
    if (this._bgCache.has(bgKey)) return this._bgCache.get(bgKey);
    const bg = this.assets[bgKey];
    if (!bg) return null;

    const scale = VIEW_H / bg.height;
    const tileW = Math.ceil(bg.width * scale);
    // Pre-construir 2 azulejos (normal + espejado) en un solo canvas offscreen para 1 blit por frame!
    const off = document.createElement('canvas');
    off.width = tileW * 2;
    off.height = VIEW_H;
    const octx = off.getContext('2d', { alpha: false });
    octx.drawImage(bg, 0, 0, tileW + 1, VIEW_H);
    octx.save();
    octx.translate(tileW * 2, 0);
    octx.scale(-1, 1);
    octx.drawImage(bg, 0, 0, tileW + 1, VIEW_H);
    octx.restore();

    const entry = { canvas: off, pairW: tileW * 2 };
    this._bgCache.set(bgKey, entry);
    return entry;
  }

  _getGroundTile(groundKey, groundH) {
    const cacheKey = `${groundKey}_${groundH}`;
    if (this._groundCache.has(cacheKey)) return this._groundCache.get(cacheKey);
    const strip = this.assets[groundKey];
    if (!strip) return null;

    const tileW = Math.round(strip.width * (groundH / strip.height));
    const off = document.createElement('canvas');
    off.width = tileW;
    off.height = groundH;
    const octx = off.getContext('2d', { alpha: false });
    octx.drawImage(strip, 0, 0, tileW, groundH);

    const entry = { canvas: off, tileW };
    this._groundCache.set(cacheKey, entry);
    return entry;
  }

  render(engine) {
    const ctx = this.ctx;
    ctx.save();

    let shakeX = 0;
    let shakeY = 0;
    if (engine.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * 2 * engine.shakeIntensity;
      shakeY = (Math.random() - 0.5) * 2 * engine.shakeIntensity;
    }

    const camX = Math.floor(engine.cameraX);
    const level = engine.level;

    // 1. Fondo panorámico 3D ultra-rápido desde caché offscreen
    this._drawParallaxBackground(ctx, level, camX, engine.time);

    ctx.save();
    ctx.translate(-camX + shakeX, shakeY);

    // 2. Suelo 3D auténtico + pozos oscuros (sin clip lento por frame)
    this._drawGroundSegments(ctx, level, camX);

    // 3. Plataformas de troncos y pilares de madera (con los 4 troncos reales del usuario!)
    this._drawPlatforms(ctx, level, camX, engine);

    // 4. Puerta de la arena de Abruk / flecha hacia Pepe
    if (level.bossArena && !engine.gateOpen) {
      this._drawBossGate(ctx, level.bossArena.gateX);
    } else if (level.bossArena && engine.bossDefeated && !engine.pepeRescued) {
      this._drawRescueArrow(ctx, level.bossArena.gateX + 40, engine.time);
    }

    // 5. LuckyBlocks de madera con "?"
    this._drawLuckyBlocks(ctx, engine.blocks, engine.time, camX);

    // 6. Objetos Popo (Marrón / Naranja)
    this._drawItems(ctx, engine.items, engine.time);

    // 7. Pepe la Rana esperando rescate al final del Nivel 3
    if (level.pepe && level.pepe.x > camX - 240 && level.pepe.x < camX + VIEW_W + 240) {
      this._drawPepe(ctx, level.pepe, engine.pepeRescued, engine.time);
    }

    // 8. Enemigos (Mateos y Erins) y Meteoritos
    this._drawEnemies(ctx, engine.enemies, camX);
    this._drawMeteorites(ctx, engine.meteorites);

    // 9. Jefe Final Abruk y sus ondas de choque
    if (engine.boss && (engine.bossActive || Math.abs(engine.boss.x - camX) < VIEW_W + 220)) {
      this._drawBoss(ctx, engine.boss, engine.time);
    }
    this._drawShockwaves(ctx, engine.shockwaves);

    // 10. Jugadores + Tubo de madera de salida
    if (engine.state === 'pipe_out' && level.exitPipe) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(camX - 100, 0, VIEW_W + 200, level.exitPipe.y + 8);
      ctx.clip();
      this._drawPlayers(ctx, engine);
      ctx.restore();
      this._drawExitPipe(ctx, level.exitPipe, engine.time, false);
    } else {
      if (level.exitPipe && level.exitPipe.x + level.exitPipe.w > camX - 140 && level.exitPipe.x < camX + VIEW_W + 140) {
        this._drawExitPipe(ctx, level.exitPipe, engine.time, true);
      }
      this._drawPlayers(ctx, engine);
    }

    // 11. Partículas y textos flotantes
    this._drawParticles(ctx, engine.particles);
    this._drawFloatingTexts(ctx, engine.floatingTexts);

    ctx.restore();

    // 12. Efectos ambientales ligeros (burbujas bajo el agua / motas de luz)
    this._drawAmbientOverlay(ctx, engine);

    ctx.restore();
  }

  _drawParallaxBackground(ctx, level, camX, time) {
    const cached = this._getParallaxStrip(level.bgKey);
    if (!cached) {
      ctx.fillStyle = level.isUnderwater ? '#0b4d82' : '#2a6b3a';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }

    const { canvas: off, pairW } = cached;
    const scroll = ((camX * 0.3) % pairW + pairW) % pairW;
    const drawX = -Math.floor(scroll);
    ctx.drawImage(off, drawX, 0);
    if (drawX + pairW < VIEW_W) {
      ctx.drawImage(off, drawX + pairW, 0);
    }

    if (level.isUnderwater) {
      ctx.fillStyle = 'rgba(180, 245, 255, 0.065)';
      for (let r = 0; r < 4; r++) {
        const rx = ((r * 360 + Math.sin(time * 0.6 + r) * 40) % (VIEW_W + 220)) - 110;
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + 80, 0);
        ctx.lineTo(rx + 195, VIEW_H);
        ctx.lineTo(rx + 60, VIEW_H);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  _drawGroundSegments(ctx, level, camX) {
    const groundH = VIEW_H - GROUND_Y + 8;
    const tile = this._getGroundTile(level.groundKey, groundH);

    // Pozos oscuros entre segmentos
    ctx.fillStyle = level.isUnderwater ? 'rgba(0, 14, 34, 0.72)' : 'rgba(6, 10, 5, 0.78)';
    for (let i = 0; i < level.groundSegments.length - 1; i++) {
      const pitX1 = level.groundSegments[i][1];
      const pitX2 = level.groundSegments[i + 1][0];
      if (pitX2 < camX - 60 || pitX1 > camX + VIEW_W + 60) continue;
      ctx.fillRect(pitX1, GROUND_Y + 6, pitX2 - pitX1, groundH);
    }

    for (const [x1, x2] of level.groundSegments) {
      if (x2 < camX - 60 || x1 > camX + VIEW_W + 60) continue;
      const visL = Math.max(x1, camX - 40);
      const visR = Math.min(x2, camX + VIEW_W + 40);

      if (tile) {
        const { canvas: off, tileW } = tile;
        let tx = Math.floor((visL - x1) / tileW) * tileW + x1;
        while (tx < visR) {
          const drawW = Math.min(tileW, x2 - tx);
          if (drawW > 0) {
            ctx.drawImage(off, 0, 0, drawW, groundH, tx, GROUND_Y - 4, drawW, groundH);
          }
          tx += tileW;
        }
      } else {
        ctx.fillStyle = level.isUnderwater ? '#c8aa74' : '#5e3b1e';
        ctx.fillRect(x1, GROUND_Y, x2 - x1, groundH);
      }

      // Borde oscuro limpio en los acantilados de cada pozo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.fillRect(x1, GROUND_Y, 8, groundH);
      ctx.fillRect(x2 - 8, GROUND_Y, 8, groundH);
    }
  }

  _pickTrunkSprite(h) {
    if (h >= 138) return this.assets.trunk_2 || this.assets.wooden_pipe;
    if (h >= 112) return this.assets.trunk_3 || this.assets.wooden_pipe;
    if (h >= 92) return this.assets.trunk_1 || this.assets.wooden_pipe;
    return this.assets.trunk_4 || this.assets.wooden_pipe;
  }

  _drawPlatforms(ctx, level, camX, engine) {
    for (const pl of level.platforms) {
      if (pl.x + pl.w < camX - 100 || pl.x > camX + VIEW_W + 100) continue;

      if (pl.kind === 'pillar') {
        // Usar los 4 troncos/tubos de madera reales enviados por el usuario!
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(pl.x + pl.w / 2, GROUND_Y + 2, pl.w * 0.56, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        const trunkImg = this._pickTrunkSprite(pl.h);
        if (trunkImg) {
          ctx.drawImage(trunkImg, pl.x - 6, pl.y - 4, pl.w + 12, pl.h + 8);
        } else {
          ctx.fillStyle = '#8d5324';
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        }

        // Indicador visual claro en los tubos-tronco conectados (para que se vea enseguida que teletransportan!)
        if (pl.warpId && pl.warpTarget && engine) {
          const cx = pl.x + pl.w / 2;
          const playerOnTop = engine.players.some(
            (p) => p.alive && !p.eliminated && !p.warpAnim &&
              p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && Math.abs(p.y + p.h - pl.y) < 18
          );
          const bob = Math.sin(engine.time * 5 + pl.x * 0.01) * 4;
          if (playerOnTop) {
            ctx.fillStyle = 'rgba(48, 22, 6, 0.94)';
            ctx.strokeStyle = '#ffe066';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(cx - 54, pl.y - 46 + bob, 108, 28, 13);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff5be';
            ctx.font = '700 13px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⬇️ BAJAR', cx, pl.y - 32 + bob);
          } else {
            // Anillo brillante + flechita sutil sobre cada tubo teletransportador
            ctx.fillStyle = `rgba(255, 236, 130, ${0.32 + 0.18 * Math.sin(engine.time * 4 + pl.x)})`;
            ctx.beginPath();
            ctx.ellipse(cx, pl.y + 8, pl.w * 0.36, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '700 15px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffe678';
            ctx.fillText('⬇️', cx, pl.y - 14 + bob);
          }
        }
      } else if (pl.kind === 'log') {
        this._drawWoodenLogPlatform(ctx, pl.x, pl.y, pl.w, pl.h, level.isUnderwater);
      }
    }
  }

  _drawWoodenLogPlatform(ctx, x, y, w, h, isUnderwater) {
    // Sombra suave debajo del tronco
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fillRect(x + 6, y + h - 2, w - 8, 8);

    // Cuerpo del tronco (rápido, sin crear gradientes pesados)
    ctx.fillStyle = '#9c5922';
    ctx.strokeStyle = '#3b1c07';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    // Franja superior clara y sombra inferior 3D
    ctx.fillStyle = '#c87f3a';
    ctx.fillRect(x + 10, y + 3, w - 24, 8);
    ctx.fillStyle = '#683511';
    ctx.fillRect(x + 10, y + h - 9, w - 24, 6);

    // Vetas simples de corteza
    ctx.strokeStyle = 'rgba(58, 25, 6, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let gx = x + 20; gx < x + w - 24; gx += 28) {
      ctx.moveTo(gx, y + 12);
      ctx.lineTo(gx + 16, y + 14);
    }
    ctx.stroke();

    // Corte con anillos del tronco en el extremo derecho
    ctx.fillStyle = '#e3b574';
    ctx.strokeStyle = '#4e270b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w - 9, y + h / 2, 7.5, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Musgo / coral superior
    ctx.fillStyle = isUnderwater ? '#5be0b5' : '#65c947';
    for (let mx = x + 18; mx < x + w - 28; mx += 48) {
      ctx.beginPath();
      ctx.ellipse(mx, y + 2, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawExitPipe(ctx, ep, time, showPrompt) {
    const pipeImg = this.assets.trunk_3 || this.assets.wooden_pipe;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(ep.x + ep.w / 2, GROUND_Y + 3, ep.w * 0.62, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (pipeImg) {
      ctx.drawImage(pipeImg, ep.x - 10, ep.y - 6, ep.w + 20, ep.h + 12);
    } else {
      ctx.fillStyle = '#8b5122';
      ctx.fillRect(ep.x, ep.y, ep.w, ep.h);
    }

    if (showPrompt) {
      const bob = Math.sin(time * 4.5) * 6;
      const cx = ep.x + ep.w / 2;
      const cy = ep.y - 36 + bob;

      ctx.fillStyle = 'rgba(54, 24, 6, 0.9)';
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cx - 72, cy - 17, 144, 34, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff5be';
      ctx.font = '700 14px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⬇️ TUBO SALIDA', cx, cy);
    }
  }

  _drawBossGate(ctx, gateX) {
    ctx.fillStyle = '#6c3814';
    ctx.strokeStyle = '#3a1b07';
    ctx.lineWidth = 2.5;
    for (let py = 40; py < GROUND_Y; py += 58) {
      ctx.beginPath();
      ctx.roundRect(gateX, py, 36, 48, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#5a3200';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(gateX + 4, GROUND_Y - 165, 28, 30, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 18px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a2500';
    ctx.fillText('🔒', gateX + 18, GROUND_Y - 144);
  }

  _drawRescueArrow(ctx, x, time) {
    const bob = Math.sin(time * 5) * 10;
    ctx.fillStyle = 'rgba(30, 120, 42, 0.92)';
    ctx.strokeStyle = '#ffe973';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x + bob, GROUND_Y - 170, 215, 42, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '700 17px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¡RESCATA A PEPE! ➡️', x + bob + 107, GROUND_Y - 149);
  }

  _drawLuckyBlocks(ctx, blocks, time, camX) {
    const img = this.assets.luckyblock;
    for (const b of blocks) {
      if (b.x + b.w < camX - 80 || b.x > camX + VIEW_W + 80) continue;
      const drawY = b.y + b.bumpOffset;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(b.x + 6, drawY + 7, b.w, b.h);

      if (!b.used && img) {
        // Halo dorado súper rápido SIN shadowBlur!
        const pulse = 0.14 + 0.12 * Math.sin(time * 4.5 + b.id);
        ctx.fillStyle = `rgba(255, 232, 110, ${pulse})`;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, drawY + b.h / 2, b.w * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(img, b.x, drawY, b.w, b.h);
      } else {
        ctx.fillStyle = '#5c3417';
        ctx.strokeStyle = '#331a08';
        ctx.lineWidth = 3;
        ctx.fillRect(b.x + 2, drawY + 2, b.w - 4, b.h - 4);
        ctx.strokeRect(b.x + 2, drawY + 2, b.w - 4, b.h - 4);
      }
    }
  }

  _drawItems(ctx, items, time) {
    for (const it of items) {
      const img = it.kind === 'brown' ? this.assets.popo_brown : this.assets.popo_orange;
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;
      const wobble = Math.sin(time * 12 + it.animTime * 4) * 0.1;
      const scaleX = 1 + Math.sin(time * 10) * 0.08;
      const scaleY = 1 - Math.sin(time * 10) * 0.08;

      ctx.save();
      ctx.translate(cx, cy);

      // Halo liviano sin shadowBlur
      ctx.fillStyle = it.kind === 'orange' ? 'rgba(255, 220, 70, 0.28)' : 'rgba(205, 145, 90, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(wobble);
      ctx.scale(scaleX, scaleY);

      if (img) {
        ctx.drawImage(img, -it.w / 2 - 4, -it.h / 2 - 4, it.w + 8, it.h + 8);
      }
      ctx.restore();
    }
  }

  _drawEnemies(ctx, enemies, camX) {
    for (const e of enemies) {
      if (!e.alive && e.dyingTimer <= 0) continue;
      if (e.x + e.w < camX - 140 || e.x > camX + VIEW_W + 140) continue;

      ctx.save();
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;

      if (e.alive) {
        const shadowY = e.type === 'mateo' ? e.y + e.h + 2 : GROUND_Y + 2;
        ctx.fillStyle = e.type === 'mateo' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.14)';
        ctx.beginPath();
        ctx.ellipse(cx, shadowY, e.w * 0.45, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.translate(cx, cy);
      if (!e.alive) {
        ctx.scale(1.15, -0.75);
        ctx.globalAlpha = Math.max(0, e.dyingTimer / 0.45);
      }

      if (e.type === 'mateo') {
        const sprite = e.attackTimer > 0 ? this.assets.mateo_attack : this.assets.mateo_walk;
        const flip = e.facing < 0 ? -1 : 1;
        const stepBob = e.alive ? Math.abs(Math.sin(e.animTime * 9)) * -5 : 0;
        ctx.translate(0, stepBob);
        ctx.scale(flip, 1);

        if (sprite) {
          const drawH = 82;
          const drawW = (sprite.width / sprite.height) * drawH;
          ctx.drawImage(sprite, -drawW / 2, -drawH / 2 - 4, drawW, drawH);
        }
      } else if (e.type === 'erin') {
        const sprite = e.attackTimer > 0 ? this.assets.erin_attack : this.assets.erin_fly;
        const spriteFacesRight = e.attackTimer > 0;
        const flip = (e.facing > 0) === spriteFacesRight ? 1 : -1;
        ctx.scale(flip, 1);

        if (sprite) {
          const drawH = 74;
          const drawW = (sprite.width / sprite.height) * drawH;
          ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
        }
      }

      ctx.restore();
    }
  }

  _drawMeteorites(ctx, meteorites) {
    const img = this.assets.meteorite;
    for (const m of meteorites) {
      const cx = m.x + m.w / 2;
      const cy = m.y + m.h / 2;
      ctx.fillStyle = 'rgba(255, 130, 20, 0.28)';
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();
      if (img) {
        const drawH = 54;
        const drawW = (img.width / img.height) * drawH;
        ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2 - 4, drawW, drawH);
      }
    }
  }

  _drawBoss(ctx, b, time) {
    if (!b.alive && b.dyingTimer <= 0) return;

    ctx.save();
    const cx = b.x + b.w / 2;
    const bottomY = b.y + b.h;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_Y + 3, 56, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, bottomY);

    if (!b.alive) {
      ctx.rotate(time * 14);
      ctx.globalAlpha = Math.max(0, b.dyingTimer / 1.6);
    } else if (b.hurtInvuln > 0 && Math.floor(time * 22) % 2 === 0) {
      ctx.globalAlpha = 0.52;
    }

    let sprite = this.assets.abruk_idle;
    if (b.aiState === 'run') sprite = this.assets.abruk_run;
    else if (b.aiState === 'jump') sprite = this.assets.abruk_jump;
    else if (b.aiState === 'attack') {
      // Al despegar usa pose de salto y al bajar/atacar blande el hueso hacia el jugador!
      sprite = (!b.onGround && b.vy < -140) ? this.assets.abruk_jump : this.assets.abruk_attack;
    }

    const flip = b.facing > 0 ? 1 : -1;
    const bob = b.aiState === 'run' ? Math.abs(Math.sin(b.animTime * 11)) * -8 : 0;
    ctx.translate(0, bob);
    ctx.scale(flip, 1);

    if (sprite) {
      const drawH = 152;
      const drawW = (sprite.width / sprite.height) * drawH;
      ctx.drawImage(sprite, -drawW / 2, -drawH + 6, drawW, drawH);
    }
    ctx.restore();
  }

  _drawShockwaves(ctx, shockwaves) {
    ctx.fillStyle = 'rgba(255, 198, 72, 0.88)';
    ctx.strokeStyle = '#ff6200';
    ctx.lineWidth = 3;
    for (const sw of shockwaves) {
      ctx.beginPath();
      ctx.ellipse(sw.x + sw.w / 2, sw.y + sw.h / 2, sw.w / 2, sw.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  _drawPepe(ctx, pepe, rescued, time) {
    // Pepe la Rana: alterna entre NEUTRAL/IDLE y SALTANDO DE ALEGRÍA!
    const jumpingNow = rescued ? (Math.sin(time * 9) > -0.25) : (Math.sin(time * 3.5) > 0.55);
    const img = jumpingNow
      ? (this.assets.pepe_jump || this.assets.pepe)
      : (this.assets.pepe_idle || this.assets.pepe);
    const jumpBob = rescued
      ? Math.max(0, Math.sin(time * 9)) * -32
      : (jumpingNow ? Math.max(0, Math.sin(time * 3.5)) * -16 : 0);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(pepe.x, GROUND_Y + 3, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (img) {
      const drawH = jumpingNow ? 86 : 74;
      const drawW = (img.width / img.height) * drawH;
      ctx.drawImage(img, pepe.x - drawW / 2, GROUND_Y - drawH + 4 + jumpBob, drawW, drawH);
    }

    const bubbleY = GROUND_Y - 114 + jumpBob * 0.45;
    const msg = rescued ? '¡GRACIAS PRIMOS! 🐸❤️' : '¡Croac! ¡Sálvenme primos!';
    ctx.fillStyle = '#fff9e6';
    ctx.strokeStyle = '#754116';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(pepe.x - 94, bubbleY - 17, 188, 34, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4a2208';
    ctx.font = '700 13.5px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, pepe.x, bubbleY);
  }

  _drawPlayers(ctx, engine) {
    for (const p of engine.players) {
      if (!p.alive || p.eliminated) continue;

      const cx = p.x + p.w / 2;
      const bottomY = p.y + p.h + (p.pipeSlideY || 0);
      const activeWarpPipe = p.warpAnim
        ? (p.warpAnim.phase === 'entering' ? p.warpAnim.fromPipe : p.warpAnim.toPipe)
        : null;

      if (engine.state !== 'pipe_out' && !activeWarpPipe) {
        const shadowY = p.onGround ? bottomY + 2 : Math.min(GROUND_Y + 2, bottomY + 90);
        const distRatio = Math.max(0.25, 1 - Math.abs(shadowY - bottomY) / 260);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.32 * distRatio})`;
        ctx.beginPath();
        ctx.ellipse(cx, shadowY, p.w * 0.62 * distRatio, 7 * distRatio, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      // Si el jugador está entrando o saliendo de un tubo-tronco conectado, recortar limpiamente en la boca del tubo!
      if (activeWarpPipe) {
        ctx.beginPath();
        ctx.rect(activeWarpPipe.x - 60, 0, activeWarpPipe.w + 120, activeWarpPipe.y + 10);
        ctx.clip();
      }
      ctx.translate(cx, bottomY);

      if (p.hurtInvuln > 0 && Math.floor(engine.time * 20) % 2 === 0) {
        ctx.globalAlpha = 0.48;
      }

      // Aura dorada ligera SIN shadowBlur!
      if (p.power === 'gold') {
        const warnBlink = p.goldTimer < 3.0 && Math.floor(engine.time * 14) % 2 === 0;
        ctx.fillStyle = warnBlink ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 224, 65, 0.28)';
        ctx.beginPath();
        ctx.arc(0, -p.h * 0.52, p.renderHeight * 0.58, 0, Math.PI * 2);
        ctx.fill();
      }

      const sprite = this._pickPlayerSprite(p, engine.state);
      const speed = Math.abs(p.vx);
      const runBob = p.onGround && speed > 25 && p.power !== 'gold' && !p.crouching
        ? Math.abs(Math.sin(p.animTime * 14)) * -5
        : 0;
      const tilt = p.power === 'gold'
        ? Math.max(-0.18, Math.min(0.18, p.vy * 0.0004)) * p.facing
        : (p.onGround && speed > 40 ? p.facing * 0.045 : 0);

      ctx.translate(0, runBob);
      ctx.rotate(tilt);
      ctx.scale(p.facing * p.squashX, p.squashY);

      if (sprite) {
        const targetH = p.crouching ? p.renderHeight * 0.72 : p.renderHeight;
        const targetW = (sprite.width / sprite.height) * targetH;
        ctx.drawImage(sprite, -targetW / 2, -targetH + 4, targetW, targetH);
      }

      if (p.power === 'sword' && p.attackTimer > 0) {
        const progress = 1 - p.attackTimer / 0.24;
        ctx.strokeStyle = `rgba(255, 250, 200, ${1 - progress})`;
        ctx.lineWidth = 7 * (1 - progress * 0.5);
        ctx.beginPath();
        ctx.arc(16, -p.h * 0.55, 42, -0.9 + progress * 0.5, 0.8 + progress * 0.4);
        ctx.stroke();
      }

      ctx.restore();

      if (engine.mode === 2 && engine.state !== 'pipe_out') {
        const tagY = p.y - 18;
        ctx.fillStyle = p.id === 1 ? 'rgba(30, 148, 46, 0.88)' : 'rgba(26, 108, 212, 0.88)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(cx - 28, tagY - 10, 56, 19, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '700 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.name, cx, tagY);
      }
    }
  }

  _pickPlayerSprite(p, gameState) {
    const base = p.spriteBase;

    if (gameState === 'victory_walk' || gameState === 'victory') {
      if (p.power === 'gold') return this.assets[`${base}_gold_win`];
      return this.assets[`${base}_win`];
    }

    if (p.power === 'gold') {
      if (p.vy < -75) return this.assets[`${base}_gold_ascend`];
      if (p.vy > 75) return this.assets[`${base}_gold_descend`];
      if (Math.abs(p.vx) > 260) return this.assets[`${base}_gold_fastfly`];
      if (Math.abs(p.vx) > 35 || !p.onGround) return this.assets[`${base}_gold_fly`];
      return this.assets[`${base}_gold_idle`];
    }

    if (p.power === 'sword') {
      if (p.attackTimer > 0) return this.assets[`${base}_sword_attack`];
      if (p.crouching) return this.assets[`${base}_sword_crouch`];
      if (!p.onGround) return this.assets[`${base}_sword_jump`];
      const spd = Math.abs(p.vx);
      if (spd > 240) return Math.floor(p.animTime * 12) % 2 === 0 ? this.assets[`${base}_sword_run`] : this.assets[`${base}_sword_walk`];
      if (spd > 20) return Math.floor(p.animTime * 9) % 2 === 0 ? this.assets[`${base}_sword_walk`] : this.assets[`${base}_sword_idle`];
      return this.assets[`${base}_sword_idle`];
    }

    if (p.crouching) return this.assets[`${base}_crouch`];
    if (!p.onGround) return this.assets[`${base}_jump`];
    const spd = Math.abs(p.vx);
    if (spd > 240) return Math.floor(p.animTime * 12) % 2 === 0 ? this.assets[`${base}_run`] : this.assets[`${base}_walk`];
    if (spd > 20) return Math.floor(p.animTime * 9) % 2 === 0 ? this.assets[`${base}_walk`] : this.assets[`${base}_idle`];
    return this.assets[`${base}_idle`];
  }

  _drawParticles(ctx, particles) {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawFloatingTexts(ctx, texts) {
    if (texts.length === 0) return;
    ctx.font = '700 18px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(40, 16, 4, 0.85)';
    for (const ft of texts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  _drawAmbientOverlay(ctx, engine) {
    const isWater = engine.level && engine.level.isUnderwater && engine.state !== 'menu';
    if (isWater) {
      ctx.strokeStyle = 'rgba(210, 248, 255, 0.48)';
      ctx.fillStyle = 'rgba(210, 248, 255, 0.14)';
      ctx.lineWidth = 1.2;
      for (const a of engine.ambientParticles) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(255, 246, 175, 0.34)';
      for (const a of engine.ambientParticles) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
