import { useEffect, useRef } from 'react';
import type { EnemyEntity, GameSnapshot, SpikeEntity } from '@/src/game/core/types';
import { GameColors } from '@/src/constants/theme';

import { getFrameSourceRect, FRAME_H, FRAME_W } from '@/src/game/core/playerAnimation';

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  snapshot: GameSnapshot;
  width: number;
  height: number;
}

// Pre-load the sprite sheet so it's ready for canvas drawing
const spriteSheetImg = new Image();
spriteSheetImg.src = require('../../../assets/characters/player-spritesheet.png');

export default function GameCanvasWeb2D({ snapshot, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Clear ────────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, width, height);

    const { cameraX, player, platforms, coins, projectiles, effects, enemies, spikes, invincible } = snapshot;
    const px = player.renderX;
    const py = player.renderY;

    ctx.save();
    ctx.translate(-cameraX, 0);

    // ── Platforms ─────────────────────────────────────────────────────────────
    for (const p of platforms) {
      const isGround = p.height >= 24;
      
      if (!isGround) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        roundRect(ctx, p.x + 3, p.y + 3, p.width, p.height, 6);
        ctx.fill();
        ctx.fillStyle = '#8d6e4c';
        roundRect(ctx, p.x, p.y, p.width, p.height, 6);
        ctx.fill();
      }
      if (isGround) {
        ctx.fillStyle = '#5cb85c'; ctx.fillRect(p.x, p.y, p.width, 14);
        ctx.fillStyle = '#4a9e4a'; ctx.fillRect(p.x, p.y + 12, p.width, 4);
      } else {
        ctx.fillStyle = '#a0825e'; roundRect(ctx, p.x, p.y, p.width, 8, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; roundRect(ctx, p.x + 4, p.y + 2, p.width - 8, 4, 2); ctx.fill();
      }
    }

    // ── Spikes ────────────────────────────────────────────────────────────────
    for (const s of spikes) drawSpikes(ctx, s);

    // ── Coins ─────────────────────────────────────────────────────────────────
    for (const c of coins) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffd700'; circle(ctx, c.x, c.y, c.radius + 5);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#b8860b'; circle(ctx, c.x, c.y, c.radius + 2);
      ctx.fillStyle = GameColors.gold; circle(ctx, c.x, c.y, c.radius);
      ctx.fillStyle = '#fff8dc'; circle(ctx, c.x - 3, c.y - 3, c.radius * 0.35);
      ctx.fillStyle = '#e6c200'; circle(ctx, c.x, c.y, c.radius * 0.5);
    }

    // ── Enemies ───────────────────────────────────────────────────────────────
    for (const e of enemies) {
      if (e.dead) continue;
      switch (e.type) {
        case 'fly':  drawFly(ctx, e);  break;
        case 'bug':  drawBug(ctx, e);  break;
        case 'frog': drawFrog(ctx, e); break;
      }
    }

    // ── Projectiles ───────────────────────────────────────────────────────────
    for (const proj of projectiles) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = proj.color; circle(ctx, proj.x, proj.y, proj.radius + 7);
      ctx.globalAlpha = 0.5;  ctx.fillStyle = proj.color; circle(ctx, proj.x, proj.y, proj.radius + 3);
      ctx.globalAlpha = 1;    ctx.fillStyle = proj.color; circle(ctx, proj.x, proj.y, proj.radius);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(ctx, proj.x - proj.radius * 0.3, proj.y - proj.radius * 0.3, proj.radius * 0.4);
    }

    // ── Power effects ─────────────────────────────────────────────────────────
    const shieldCx = px + player.width / 2;
    const shieldCy = py + player.height / 2;
    if (effects.shield) {
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff64a0'; circle(ctx, shieldCx, shieldCy, player.width * 0.9);
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#ff96c8'; circle(ctx, shieldCx, shieldCy, player.width * 0.85);
      ctx.globalAlpha = 1;
    }
    if (effects.speedBoost) {
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffe600';
      roundRect(ctx, px - 6, py + player.height - 6, player.width + 12, 14, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (effects.bowserSpin) {
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff8c00'; circle(ctx, shieldCx, shieldCy, player.width * 1.4);
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#ff5000'; circle(ctx, shieldCx, shieldCy, player.width * 1.2);
      ctx.globalAlpha = 1;
    }

    // ── Player shadow ─────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(ctx, px + 6, py + player.height, player.width - 12, 8, 4); ctx.fill();

    // ── Player ────────────────────────────────────────────────────────────────
    ctx.globalAlpha = effects.ghost ? 0.42 : invincible ? 0.55 : 1;

    // Optional: draw ghost aura
    if (effects.ghost) {
      ctx.fillStyle = 'rgba(100,180,255,0.4)'; 
      roundRect(ctx, px, py, player.width, player.height, 10); 
      ctx.fill();
    }

    // Sprite drawing logic
    const srcRect = getFrameSourceRect(player.animState, player.animFrame);
    const offsetX = (FRAME_W - player.width) / 2;
    const offsetY = (FRAME_H - player.height) / 2;

    const drawX = px - offsetX;
    const drawY = py - (FRAME_H - player.height); // Bottom align

    ctx.save();
    // Move to the center of the drawing area to apply scale
    const cx = drawX + FRAME_W / 2;
    const cy = drawY + FRAME_H / 2;
    ctx.translate(cx, cy);

    // Apply horizontal flip and landing squash/stretch
    const scaleX = (player.facingRight ? 1 : -1) * player.landScaleX;
    const scaleY = player.landScaleY;
    ctx.scale(scaleX, scaleY);

    if (spriteSheetImg.complete && spriteSheetImg.naturalWidth > 0) {
      ctx.drawImage(
        spriteSheetImg,
        srcRect.sx, srcRect.sy, srcRect.sw, srcRect.sh,
        -FRAME_W / 2, -FRAME_H / 2, FRAME_W, FRAME_H
      );
    } else {
      // Fallback if image not loaded yet
      ctx.fillStyle = player.color;
      ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    }
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.restore();
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', width, height, background: 'transparent' }}
    />
  );
}


// ── Enemy draw functions ──────────────────────────────────────────────────────


function drawFly(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
  ctx.fillStyle = 'rgba(180,180,220,0.75)';
  roundRect(ctx, e.x - 10, e.y - 4, 12, 7, 4); ctx.fill();
  roundRect(ctx, e.x + e.width - 2, e.y - 4, 12, 7, 4); ctx.fill();
  ctx.fillStyle = '#2a1a3a'; roundRect(ctx, e.x, e.y, e.width, e.height, 8); ctx.fill();
  ctx.fillStyle = '#ff3030'; circle(ctx, e.x + 7, e.y + 5, 3); circle(ctx, e.x + e.width - 7, e.y + 5, 3);
  ctx.fillStyle = '#fff'; circle(ctx, e.x + 8, e.y + 5, 1.5); circle(ctx, e.x + e.width - 6, e.y + 5, 1.5);
}

function drawBug(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(e.x + 2, e.y + 12, 6, 3); ctx.fillRect(e.x + 9, e.y + 14, 6, 3); ctx.fillRect(e.x + 16, e.y + 12, 6, 3);
  ctx.fillStyle = '#8b4513'; roundRect(ctx, e.x, e.y + 2, e.width, e.height - 4, 8); ctx.fill();
  ctx.fillStyle = '#a0522d'; roundRect(ctx, e.x + 3, e.y + 4, e.width - 6, e.height - 10, 6); ctx.fill();
  ctx.fillStyle = '#6b3010'; ctx.fillRect(e.x + e.width / 2 - 1, e.y + 4, 2, e.height - 10);
  ctx.fillStyle = '#7a3d10'; circle(ctx, e.x + e.width / 2, e.y + 3, 5);
  ctx.fillStyle = '#000'; circle(ctx, e.x + e.width / 2 - 3, e.y + 2, 2); circle(ctx, e.x + e.width / 2 + 3, e.y + 2, 2);
}

function drawFrog(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
  ctx.fillStyle = '#228b22';
  roundRect(ctx, e.x - 4, e.y + e.height - 8, 10, 8, 4); ctx.fill();
  roundRect(ctx, e.x + e.width - 6, e.y + e.height - 8, 10, 8, 4); ctx.fill();
  ctx.fillStyle = '#32a832'; roundRect(ctx, e.x, e.y + 6, e.width, e.height - 8, 8); ctx.fill();
  ctx.fillStyle = '#3ab83a'; roundRect(ctx, e.x + 2, e.y, e.width - 4, 14, 7); ctx.fill();
  ctx.fillStyle = '#3ab83a'; circle(ctx, e.x + 5, e.y + 1, 5); circle(ctx, e.x + e.width - 5, e.y + 1, 5);
  ctx.fillStyle = '#111'; circle(ctx, e.x + 5, e.y + 1, 3); circle(ctx, e.x + e.width - 5, e.y + 1, 3);
  ctx.fillStyle = '#fff'; circle(ctx, e.x + 6, e.y, 1.5); circle(ctx, e.x + e.width - 4, e.y, 1.5);
  ctx.fillStyle = '#1a7a1a'; ctx.fillRect(e.x + 5, e.y + 11, e.width - 10, 2);
}

function drawSpikes(ctx: CanvasRenderingContext2D, s: SpikeEntity) {
  const spikeW = 18;
  const count = Math.max(1, Math.round(s.width / spikeW));
  const baseY = s.y + s.height;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < count; i++) {
    const lx = s.x + i * spikeW;
    ctx.beginPath(); ctx.moveTo(lx, baseY + 2); ctx.lineTo(lx + spikeW / 2, s.y + 2); ctx.lineTo(lx + spikeW, baseY + 2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#cc1a00';
  for (let i = 0; i < count; i++) {
    const lx = s.x + i * spikeW;
    ctx.beginPath(); ctx.moveTo(lx, baseY); ctx.lineTo(lx + spikeW / 2, s.y); ctx.lineTo(lx + spikeW, baseY); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,80,40,0.4)';
  for (let i = 0; i < count; i++) {
    const lx = s.x + i * spikeW;
    ctx.beginPath(); ctx.moveTo(lx + spikeW * 0.25, baseY); ctx.lineTo(lx + spikeW / 2, s.y + 4); ctx.lineTo(lx + spikeW * 0.45, baseY); ctx.closePath(); ctx.fill();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.closePath(); return; }
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad); ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad); ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(r, 0.1), 0, Math.PI * 2); ctx.fill();
}
