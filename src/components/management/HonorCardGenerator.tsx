"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { X, Download, MessageCircle, Share2, Copy, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HonorCardData {
    type: 'sheikh_first' | 'sheikh_second' | 'sheikh_third' | 'student_excellence';
    name: string;
    group: string;
    subtitle?: string;
    month?: string;
    stats?: { label: string; value: string }[];
    schoolName?: string;
}

type CardFormat = 'story' | 'post';

interface HonorCardGeneratorProps {
    data: HonorCardData;
    onClose: () => void;
}

// ─── Vibrant Themes ────────────────────────────────────────────────────────────
const THEMES = {
    sheikh_first: {
        bg1: '#0d1b6e', bg2: '#4a0080', bg3: '#0d1b6e', bgMid: '#2d0668',
        glow: '#fbbf24', gold: '#fbbf24', goldBright: '#ffd700', goldLight: '#fef3c7',
        badge: '🏆', rankAr: 'المركز الأول',
        confetti: ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#fff'],
        statBgs: ['#fef9c3', '#ede9fe', '#dcfce7', '#dbeafe'],
        statBorders: ['#fbbf24', '#a78bfa', '#4ade80', '#60a5fa'],
        statTexts: ['#713f12', '#4c1d95', '#14532d', '#1e3a8a'],
        headerBand: 'rgba(251,191,36,0.25)', nameColor: '#fef3c7', groupColor: '#fbbf24',
        decorLine: '#fbbf24', glowRgba: 'rgba(251,191,36,0.55)',
        subtitle: '🏆 شيخ وفوج الشهر المتميز',
    },
    sheikh_second: {
        bg1: '#0a3d62', bg2: '#1a5276', bg3: '#0a3d62', bgMid: '#104e8b',
        glow: '#e0e0e0', gold: '#c8d6e5', goldBright: '#dfe6f0', goldLight: '#eaf2fb',
        badge: '🥈', rankAr: 'المركز الثاني',
        confetti: ['#c8d6e5', '#7dd3fc', '#a5b4fc', '#67e8f9', '#fb923c', '#fff', '#c4b5fd'],
        statBgs: ['#e8f8f5', '#eaf2fb', '#f1f5f9', '#f0f3ff'],
        statBorders: ['#16a085', '#2e86c1', '#aab7b8', '#7f8c8d'],
        statTexts: ['#0e6655', '#154360', '#2c3e50', '#4a4a8a'],
        headerBand: 'rgba(200,214,229,0.22)', nameColor: '#eaf2fb', groupColor: '#85c1e9',
        decorLine: '#85c1e9', glowRgba: 'rgba(200,214,229,0.5)',
        subtitle: '🥈 المركز الثاني في الترتيب الشهري',
    },
    sheikh_third: {
        bg1: '#7d3c00', bg2: '#c2410c', bg3: '#7d3c00', bgMid: '#a04000',
        glow: '#f39c12', gold: '#f5b041', goldBright: '#ffc300', goldLight: '#fef5e7',
        badge: '🥉', rankAr: 'المركز الثالث',
        confetti: ['#f39c12', '#fbbf24', '#f9a8d4', '#fff', '#a7f3d0', '#fdba74', '#fcd34d'],
        statBgs: ['#fef5e7', '#fef9e7', '#fce4ec', '#e8f5e9'],
        statBorders: ['#f39c12', '#f4d03f', '#e91e63', '#4caf50'],
        statTexts: ['#7d3c00', '#7d6608', '#880e4f', '#1b5e20'],
        headerBand: 'rgba(243,156,18,0.22)', nameColor: '#fef5e7', groupColor: '#f39c12',
        decorLine: '#f39c12', glowRgba: 'rgba(243,156,18,0.5)',
        subtitle: '🥉 المركز الثالث في الترتيب الشهري',
    },
    student_excellence: {
        bg1: '#0b5345', bg2: '#0e6655', bg3: '#0b5345', bgMid: '#117a65',
        glow: '#2ecc71', gold: '#58d68d', goldBright: '#1abc9c', goldLight: '#d5f5e3',
        badge: '⭐', rankAr: 'طالب متميز',
        confetti: ['#2ecc71', '#1abc9c', '#a7f3d0', '#67e8f9', '#c4b5fd', '#fff', '#fbbf24'],
        statBgs: ['#d5f5e3', '#d1f2eb', '#d0ece7', '#e8f8f5'],
        statBorders: ['#27ae60', '#1abc9c', '#148f77', '#0e6655'],
        statTexts: ['#0b5345', '#0e6655', '#117a65', '#1a5276'],
        headerBand: 'rgba(46,204,113,0.22)', nameColor: '#d5f5e3', groupColor: '#2ecc71',
        decorLine: '#2ecc71', glowRgba: 'rgba(46,204,113,0.5)',
        subtitle: '⭐ طالب متميز في التحفيظ والالتزام',
    },
};

// ─── Font Loading ──────────────────────────────────────────────────────────────
let _fontReady = false;
async function ensureCairoFont(): Promise<void> {
    if (_fontReady || typeof document === 'undefined') return;
    if (!document.getElementById('honor-card-cairo-font')) {
        const link = document.createElement('link');
        link.id = 'honor-card-cairo-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=block';
        document.head.appendChild(link);
    }
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
    _fontReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Theme = typeof THEMES.sheikh_first;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pts = 5) {
    const inner = r * 0.42;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
        const a = (i * Math.PI) / pts - Math.PI / 2;
        const rad = i % 2 === 0 ? r : inner;
        if (i === 0) ctx.moveTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
        else ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    ctx.closePath();
}

function seededRand(seed: number) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Shared: background + border + confetti
function drawBase(ctx: CanvasRenderingContext2D, W: number, H: number, theme: Theme, seed = 42) {
    const rand = seededRand(seed);

    // Vibrant jewel-tone gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, theme.bg1);
    bgGrad.addColorStop(0.45, theme.bgMid);
    bgGrad.addColorStop(0.7, theme.bg2);
    bgGrad.addColorStop(1, theme.bg3);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Center glow
    const cg = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.6);
    cg.addColorStop(0, theme.glowRgba.replace('0.5', '0.18'));
    cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    // Confetti dots
    const count = Math.floor(W * H / 8000);
    for (let i = 0; i < count; i++) {
        const cx = rand() * W, cy = rand() * H;
        const r = rand() * 5 + 2;
        const col = theme.confetti[Math.floor(rand() * theme.confetti.length)];
        const shape = Math.floor(rand() * 3);
        ctx.save();
        ctx.globalAlpha = rand() * 0.5 + 0.15;
        ctx.fillStyle = col;
        if (shape === 0) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        else if (shape === 1) { ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
        else { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore(); }
        ctx.restore();
    }

    // Outer border with glow
    const bm = Math.round(W * 0.015);
    ctx.save();
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 20;
    ctx.strokeStyle = theme.gold; ctx.lineWidth = 3;
    roundRect(ctx, bm, bm, W - bm * 2, H - bm * 2, 24);
    ctx.stroke();
    ctx.restore();
    // Inner thin border
    ctx.save();
    ctx.strokeStyle = theme.goldBright; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.4;
    roundRect(ctx, bm + 10, bm + 10, W - (bm + 10) * 2, H - (bm + 10) * 2, 18);
    ctx.stroke();
    ctx.restore();

    // Corner diamonds
    [[bm, bm], [W - bm, bm], [bm, H - bm], [W - bm, H - bm]].forEach(([cx, cy]) => {
        ctx.save();
        ctx.fillStyle = theme.goldBright; ctx.shadowColor = theme.glow; ctx.shadowBlur = 10;
        const s = Math.round(W * 0.012);
        ctx.beginPath();
        ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    });
}

// Shared: draw badge circle
function drawBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, theme: Theme, emojiSize: number) {
    // Aura rings
    [r + 45, r + 28, r + 14].forEach((ar, i) => {
        ctx.save();
        ctx.strokeStyle = theme.gold; ctx.lineWidth = i === 2 ? 1.5 : 0.6;
        ctx.globalAlpha = [0.12, 0.22, 0.38][i];
        ctx.setLineDash(i === 2 ? [] : [5, 6]);
        ctx.beginPath(); ctx.arc(cx, cy, ar, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    });
    // Glow
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 50);
    bg.addColorStop(0, theme.glowRgba.replace('0.5', '0.45'));
    bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, r + 50, 0, Math.PI * 2); ctx.fill();
    // Fill
    const bf = ctx.createRadialGradient(cx - r * 0.22, cy - r * 0.25, 0, cx, cy, r);
    bf.addColorStop(0, theme.bg2 + 'dd'); bf.addColorStop(1, theme.bg1 + 'aa');
    ctx.fillStyle = bf; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // Border
    const bb = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    bb.addColorStop(0, theme.goldBright); bb.addColorStop(0.5, theme.glow); bb.addColorStop(1, theme.goldBright);
    ctx.strokeStyle = bb; ctx.lineWidth = 4; ctx.shadowColor = theme.glow; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    // Dots around
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.fillStyle = i % 2 === 0 ? theme.goldBright : theme.gold;
        ctx.globalAlpha = i % 2 === 0 ? 0.9 : 0.4;
        ctx.shadowColor = theme.glow; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(cx + (r + 18) * Math.cos(a), cy + (r + 18) * Math.sin(a), i % 2 === 0 ? 5 : 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    // Emoji
    ctx.save();
    ctx.font = `${emojiSize}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 35;
    ctx.fillText(theme.badge, cx, cy + emojiSize * 0.07);
    ctx.restore();
}

// Shared: draw stat boxes
function drawStats(ctx: CanvasRenderingContext2D, stats: { label: string; value: string }[],
    startX: number, startY: number, totalW: number, boxH: number, theme: Theme, cols = 4) {
    const toShow = stats.slice(0, cols);
    const gap = 12;
    const boxW = (totalW - (toShow.length - 1) * gap) / toShow.length;
    toShow.forEach((stat, i) => {
        const bx = startX + i * (boxW + gap);
        const bg = theme.statBgs[i % theme.statBgs.length];
        const border = theme.statBorders[i % theme.statBorders.length];
        const textClr = theme.statTexts[i % theme.statTexts.length];
        ctx.save();
        roundRect(ctx, bx, startY, boxW, boxH, 14);
        ctx.fillStyle = bg; ctx.globalAlpha = 0.93; ctx.fill();
        ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        ctx.shadowColor = border; ctx.shadowBlur = 8;
        roundRect(ctx, bx, startY, boxW, boxH, 14); ctx.stroke();
        ctx.restore();

        const valSize = Math.round(boxH * 0.35);
        const lblSize = Math.round(boxH * 0.17);
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${valSize}px Cairo, Tahoma, Arial`;
        ctx.fillStyle = textClr; ctx.shadowColor = border; ctx.shadowBlur = 5;
        ctx.fillText(stat.value, bx + boxW / 2, startY + boxH * 0.38);
        ctx.font = `600 ${lblSize}px Cairo, Tahoma, Arial`;
        ctx.fillStyle = textClr; ctx.globalAlpha = 0.75; ctx.shadowBlur = 0;
        ctx.fillText(stat.label, bx + boxW / 2, startY + boxH * 0.75);
        ctx.restore();
    });
}

// Gradient divider line with center diamond
function drawDivider(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, theme: Theme) {
    const g = ctx.createLinearGradient(cx - w / 2, y, cx + w / 2, y);
    g.addColorStop(0, 'transparent'); g.addColorStop(0.2, theme.decorLine);
    g.addColorStop(0.8, theme.decorLine); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(cx - w / 2, y - 1, w, 2);
    ctx.save();
    ctx.fillStyle = theme.goldBright; ctx.shadowColor = theme.glow; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, y - 6); ctx.lineTo(cx + 6, y); ctx.lineTo(cx, y + 6); ctx.lineTo(cx - 6, y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 1: Facebook Post — 1200 × 630 (أفقي للفيد)
// ═══════════════════════════════════════════════════════════════════════
async function drawFacebookPost(canvas: HTMLCanvasElement, data: HonorCardData, theme: Theme) {
    const W = 1200, H = 630;
    canvas.width = W; canvas.height = H;
    await ensureCairoFont();
    const ctx = canvas.getContext('2d')!;
    ctx.textBaseline = 'middle'; ctx.direction = 'rtl';

    drawBase(ctx, W, H, theme);

    const bm = 18;
    const divX = 370; // left badge column width

    // Vertical separator
    const vg = ctx.createLinearGradient(divX, bm, divX, H - bm);
    vg.addColorStop(0, 'transparent'); vg.addColorStop(0.3, theme.gold + '60');
    vg.addColorStop(0.7, theme.gold + '60'); vg.addColorStop(1, 'transparent');
    ctx.fillStyle = vg; ctx.fillRect(divX, bm + 10, 1.5, H - (bm + 10) * 2);

    // ── LEFT: Badge ──
    const badgeCX = divX / 2;
    const badgeCY = H * 0.44;
    drawBadge(ctx, badgeCX, badgeCY, 95, theme, 85);

    // School name (top-left)
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 16px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.85; ctx.shadowColor = theme.glow; ctx.shadowBlur = 6;
    ctx.fillText(data.schoolName || 'المدرسة القرآنية للإمام الشافعي', badgeCX, bm + 30);
    ctx.restore();

    drawDivider(ctx, badgeCX, bm + 50, divX - 40, theme);

    // Rank text below badge
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '700 22px Cairo, Tahoma, Arial';
    const rg = ctx.createLinearGradient(badgeCX - 90, 0, badgeCX + 90, 0);
    rg.addColorStop(0, theme.gold); rg.addColorStop(0.5, theme.goldBright); rg.addColorStop(1, theme.gold);
    ctx.fillStyle = rg; ctx.shadowColor = theme.glow; ctx.shadowBlur = 10;
    ctx.fillText(theme.rankAr, badgeCX, badgeCY + 95 + 36);
    ctx.restore();

    // Month
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '400 15px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.65;
    ctx.fillText(data.month || format(new Date(), 'MMMM yyyy', { locale: ar }), badgeCX, H - bm - 30);
    ctx.restore();

    // ── RIGHT: Name + Stats ──
    const rStart = divX + 30;
    const rW = W - rStart - bm - 10;
    const rCX = rStart + rW / 2;

    // "شهادة تكريم"
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 18px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.75;
    ctx.fillText('✦  شهادة تقدير وتكريم  ✦', rCX, bm + 32);
    ctx.restore();

    drawDivider(ctx, rCX, bm + 55, rW - 40, theme);

    // Subtitle
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 18px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.groupColor; ctx.shadowColor = theme.glow; ctx.shadowBlur = 8;
    ctx.fillText(data.subtitle || theme.subtitle, rCX, bm + 80);
    ctx.restore();

    // NAME
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 56px Cairo, Tahoma, Arial';
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 28;
    const ng = ctx.createLinearGradient(rStart, 0, rStart + rW, 0);
    ng.addColorStop(0, '#fff'); ng.addColorStop(0.4, theme.goldLight); ng.addColorStop(0.7, '#fff'); ng.addColorStop(1, theme.goldLight);
    ctx.fillStyle = ng;
    ctx.fillText(data.name, rCX, H * 0.37, rW - 10);
    ctx.restore();

    // Group
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 22px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.groupColor; ctx.globalAlpha = 0.9; ctx.shadowColor = theme.glow; ctx.shadowBlur = 6;
    ctx.fillText(data.group, rCX, H * 0.37 + 52);
    ctx.restore();

    drawDivider(ctx, rCX, H * 0.37 + 76, rW - 60, theme);

    // Stats
    if (data.stats?.length) {
        drawStats(ctx, data.stats, rStart, H * 0.37 + 94, rW, 84, theme, Math.min(4, data.stats.length));
    }

    // Bottom stars row
    for (let i = 0; i < 7; i++) {
        const sx = rCX - 90 + i * 30;
        ctx.save();
        ctx.fillStyle = theme.goldBright;
        ctx.globalAlpha = i === 3 ? 0.95 : i === 2 || i === 4 ? 0.65 : 0.3;
        ctx.shadowColor = theme.glow; ctx.shadowBlur = i === 3 ? 12 : 4;
        drawStar(ctx, sx, H - bm - 28, i === 3 ? 10 : i === 2 || i === 4 ? 7 : 4);
        ctx.fill();
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// FORMAT 2: Story — 1080 × 1920 (عمودي — ستوري إنستغرام / واتساب)
// ═══════════════════════════════════════════════════════════════════════
async function drawStory(canvas: HTMLCanvasElement, data: HonorCardData, theme: Theme) {
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;
    await ensureCairoFont();
    const ctx = canvas.getContext('2d')!;
    ctx.textBaseline = 'middle'; ctx.direction = 'rtl';

    drawBase(ctx, W, H, theme);

    const bm = 28;
    const CX = W / 2;

    // ── TOP BANNER ──
    const bannerH = 130;
    const bannerGrad = ctx.createLinearGradient(0, 0, W, 0);
    bannerGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bannerGrad.addColorStop(0.5, theme.headerBand);
    bannerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(bm, bm, W - bm * 2, bannerH);

    // School name
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '700 42px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.95;
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 14;
    ctx.fillText(data.schoolName || 'المدرسة القرآنية للإمام الشافعي', CX, bm + bannerH / 2);
    ctx.restore();

    // Top divider
    drawDivider(ctx, CX, bm + bannerH + 10, W - 100, theme);

    // ── "شهادة تكريم" label ──
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 36px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.8;
    ctx.fillText('✦  شهادة تقدير وتكريم  ✦', CX, bm + bannerH + 60);
    ctx.restore();

    // ── BADGE (large, centered) ──
    const badgeCY = H * 0.32;
    const badgeR = 170;
    drawBadge(ctx, CX, badgeCY, badgeR, theme, 145);

    // Rank text below badge
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '700 46px Cairo, Tahoma, Arial';
    const rg = ctx.createLinearGradient(CX - 180, 0, CX + 180, 0);
    rg.addColorStop(0, theme.gold); rg.addColorStop(0.5, theme.goldBright); rg.addColorStop(1, theme.gold);
    ctx.fillStyle = rg; ctx.shadowColor = theme.glow; ctx.shadowBlur = 16;
    ctx.fillText(theme.rankAr, CX, badgeCY + badgeR + 55);
    ctx.restore();

    // Small stars beside rank
    [-100, -65, 65, 100].forEach((dx, i) => {
        ctx.save();
        ctx.fillStyle = theme.goldBright; ctx.globalAlpha = i === 0 || i === 3 ? 0.45 : 0.85;
        ctx.shadowColor = theme.glow; ctx.shadowBlur = 8;
        drawStar(ctx, CX + dx, badgeCY + badgeR + 55, i === 0 || i === 3 ? 8 : 13);
        ctx.fill();
        ctx.restore();
    });

    // Divider
    drawDivider(ctx, CX, badgeCY + badgeR + 100, W - 120, theme);

    // ── Subtitle ──
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 38px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.groupColor; ctx.shadowColor = theme.glow; ctx.shadowBlur = 10;
    ctx.fillText(data.subtitle || theme.subtitle, CX, badgeCY + badgeR + 155);
    ctx.restore();

    // ── NAME — hero ──
    const nameY = H * 0.61;
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 100px Cairo, Tahoma, Arial';
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 40;
    const ng = ctx.createLinearGradient(0, 0, W, 0);
    ng.addColorStop(0, '#fff'); ng.addColorStop(0.35, theme.goldLight);
    ng.addColorStop(0.65, '#fff'); ng.addColorStop(1, theme.goldLight);
    ctx.fillStyle = ng;
    ctx.fillText(data.name, CX, nameY, W - 80);
    ctx.restore();

    // ── GROUP ──
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 48px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.groupColor; ctx.globalAlpha = 0.92;
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 10;
    ctx.fillText(data.group, CX, nameY + 90);
    ctx.restore();

    drawDivider(ctx, CX, nameY + 140, W - 120, theme);

    // ── STATS — 2×2 grid for story ──
    if (data.stats?.length) {
        const toShow = data.stats.slice(0, 4);
        const statStartY = nameY + 165;
        const boxW = (W - bm * 2 - 20) / 2;
        const boxH = 160;
        const gap = 20;

        toShow.forEach((stat, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const bx = bm + col * (boxW + gap);
            const by = statStartY + row * (boxH + gap);
            const bg = theme.statBgs[i % theme.statBgs.length];
            const border = theme.statBorders[i % theme.statBorders.length];
            const textClr = theme.statTexts[i % theme.statTexts.length];

            ctx.save();
            roundRect(ctx, bx, by, boxW, boxH, 20);
            ctx.fillStyle = bg; ctx.globalAlpha = 0.93; ctx.fill();
            ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85;
            ctx.shadowColor = border; ctx.shadowBlur = 12;
            roundRect(ctx, bx, by, boxW, boxH, 20); ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `900 52px Cairo, Tahoma, Arial`;
            ctx.fillStyle = textClr; ctx.shadowColor = border; ctx.shadowBlur = 6;
            ctx.fillText(stat.value, bx + boxW / 2, by + boxH * 0.38);
            ctx.font = `600 26px Cairo, Tahoma, Arial`;
            ctx.fillStyle = textClr; ctx.globalAlpha = 0.75; ctx.shadowBlur = 0;
            ctx.fillText(stat.label, bx + boxW / 2, by + boxH * 0.73);
            ctx.restore();
        });
    }

    // ── FOOTER ──
    const footerY = H - 200;
    drawDivider(ctx, CX, footerY, W - 100, theme);

    // Bottom motivational text
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '600 32px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.7;
    ctx.fillText('نُقدِّم أسمى آيات التهاني والتقدير', CX, footerY + 50);
    ctx.restore();

    // Month
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '400 30px Cairo, Tahoma, Arial';
    ctx.fillStyle = theme.goldLight; ctx.globalAlpha = 0.6;
    ctx.fillText(data.month || format(new Date(), 'MMMM yyyy', { locale: ar }), CX, footerY + 100);
    ctx.restore();

    // Star row
    for (let i = 0; i < 9; i++) {
        const sx = CX - 160 + i * 40;
        ctx.save();
        ctx.fillStyle = theme.goldBright;
        ctx.globalAlpha = i === 4 ? 0.95 : i % 2 === 0 ? 0.6 : 0.3;
        ctx.shadowColor = theme.glow; ctx.shadowBlur = i === 4 ? 14 : 4;
        drawStar(ctx, sx, footerY + 155, i === 4 ? 14 : i % 2 === 0 ? 9 : 5);
        ctx.fill();
        ctx.restore();
    }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function HonorCardGenerator({ data, onClose }: HonorCardGeneratorProps) {
    const canvasPostRef = useRef<HTMLCanvasElement>(null);
    const canvasStoryRef = useRef<HTMLCanvasElement>(null);
    const [activeFormat, setActiveFormat] = useState<CardFormat>('post');
    const [isReady, setIsReady] = useState(false);
    const [copied, setCopied] = useState(false);

    const theme = THEMES[data.type] || THEMES.sheikh_first;

    // Draw both on mount / data change
    useEffect(() => {
        setIsReady(false);
        const post = canvasPostRef.current;
        const story = canvasStoryRef.current;
        if (!post || !story) return;
        Promise.all([
            drawFacebookPost(post, data, theme),
            drawStory(story, data, theme),
        ]).then(() => setIsReady(true));
    }, [data, theme]);

    const downloadCurrent = useCallback(() => {
        const canvas = activeFormat === 'post' ? canvasPostRef.current : canvasStoryRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        const suffix = activeFormat === 'post' ? 'منشور_فيس' : 'ستوري';
        link.download = `تكريم_${data.name}_${suffix}_${data.month || ''}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    }, [activeFormat, data]);

    const shareText = `🏅 تهنئة وتكريم\n\n${data.subtitle || theme.subtitle}\n👤 ${data.name}\n📚 ${data.group}\n\n🕌 ${data.schoolName || 'المدرسة القرآنية للإمام الشافعي'}\n${data.month || ''}`;

    const copyText = async () => {
        try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const dialogBg = `linear-gradient(145deg, ${theme.bg1}, ${theme.bgMid}, ${theme.bg2})`;
    const accentBorder = `1px solid ${theme.gold}40`;

    // Format tabs config
    const formats: { key: CardFormat; icon: string; label: string; sublabel: string }[] = [
        { key: 'post', icon: '🖼️', label: 'منشور فيسبوك', sublabel: '1200 × 630 — أفقي' },
        { key: 'story', icon: '📱', label: 'ستوري', sublabel: '1080 × 1920 — عمودي' },
    ];

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                padding: '10px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                dir="rtl"
                style={{
                    width: '97vw', maxWidth: '1180px',
                    maxHeight: '95vh',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    background: dialogBg,
                    boxShadow: `0 32px 100px rgba(0,0,0,0.8), 0 0 60px ${theme.glowRgba.replace('0.5', '0.2')}`,
                    border: accentBorder,
                }}
            >
                {/* ── Dialog Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', flexShrink: 0,
                    background: 'rgba(0,0,0,0.3)', borderBottom: accentBorder,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '22px' }}>{theme.badge}</span>
                        <div>
                            <div style={{ color: theme.goldLight, fontWeight: 800, fontSize: '15px', fontFamily: 'Cairo, Tahoma, sans-serif' }}>
                                بطاقة التكريم — {data.name}
                            </div>
                            <div style={{ color: theme.groupColor, fontSize: '11px', fontFamily: 'Cairo, Tahoma, sans-serif', opacity: 0.85 }}>
                                {data.group} · {data.month}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: '10px', padding: '7px 9px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.8)',
                    }}>
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>

                {/* ── Format Selector ── */}
                <div style={{
                    display: 'flex', gap: 10, padding: '12px 20px 8px',
                    background: 'rgba(0,0,0,0.22)', flexShrink: 0,
                }}>
                    {formats.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setActiveFormat(f.key)}
                            style={{
                                flex: 1, padding: '10px 14px',
                                borderRadius: '14px', cursor: 'pointer',
                                border: `2px solid ${activeFormat === f.key ? theme.gold : 'rgba(255,255,255,0.1)'}`,
                                background: activeFormat === f.key ? `${theme.gold}22` : 'rgba(255,255,255,0.05)',
                                color: activeFormat === f.key ? theme.goldBright : 'rgba(255,255,255,0.5)',
                                fontFamily: 'Cairo, Tahoma, sans-serif',
                                transition: 'all 0.2s ease',
                                boxShadow: activeFormat === f.key ? `0 0 16px ${theme.glowRgba.replace('0.5', '0.3')}` : 'none',
                            }}
                        >
                            <div style={{ fontSize: '20px', marginBottom: 2 }}>{f.icon}</div>
                            <div style={{ fontWeight: 800, fontSize: '13px' }}>{f.label}</div>
                            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: 2 }}>{f.sublabel}</div>
                        </button>
                    ))}
                </div>

                {/* ── Canvas Preview ── */}
                <div style={{
                    flex: 1, overflowY: 'auto', minHeight: 0,
                    padding: '10px 20px 8px',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.18)',
                }}>
                    {!isReady && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: theme.goldLight, fontFamily: 'Cairo, Tahoma, sans-serif',
                            fontSize: '16px', padding: '40px',
                        }}>
                            ⏳ جارٍ توليد البطاقة...
                        </div>
                    )}

                    {/* Facebook Post canvas */}
                    <canvas
                        ref={canvasPostRef}
                        style={{
                            width: '100%', height: 'auto', display: activeFormat === 'post' && isReady ? 'block' : 'none',
                            borderRadius: '14px',
                            border: `2px solid ${theme.gold}35`,
                            boxShadow: `0 8px 40px ${theme.glowRgba.replace('0.5', '0.25')}`,
                        }}
                    />

                    {/* Story canvas — fixed max-width to not fill entire screen height */}
                    <canvas
                        ref={canvasStoryRef}
                        style={{
                            maxWidth: '360px', width: '100%', height: 'auto',
                            display: activeFormat === 'story' && isReady ? 'block' : 'none',
                            borderRadius: '14px',
                            border: `2px solid ${theme.gold}35`,
                            boxShadow: `0 8px 40px ${theme.glowRgba.replace('0.5', '0.25')}`,
                        }}
                    />
                </div>

                {/* ── Action Buttons ── */}
                <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                    padding: '12px 20px 16px', flexShrink: 0,
                    borderTop: accentBorder, background: 'rgba(0,0,0,0.35)',
                }}>
                    {/* Download */}
                    <button
                        onClick={downloadCurrent}
                        style={{
                            flex: 2, minWidth: 150,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '12px 18px',
                            background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldBright})`,
                            color: '#1a0a00', fontWeight: 800, fontSize: '13px',
                            border: 'none', borderRadius: '14px', cursor: 'pointer',
                            fontFamily: 'Cairo, Tahoma, sans-serif',
                            boxShadow: `0 4px 20px ${theme.glowRgba.replace('0.5', '0.4')}`,
                        }}
                    >
                        <Download style={{ width: 15, height: 15 }} />
                        تحميل {activeFormat === 'post' ? 'منشور فيس' : 'ستوري'} PNG
                    </button>

                    {/* WhatsApp */}
                    <button
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '12px 16px',
                            background: '#25d366', color: 'white',
                            fontWeight: 700, fontSize: '13px',
                            border: 'none', borderRadius: '14px', cursor: 'pointer',
                            fontFamily: 'Cairo, Tahoma, sans-serif',
                            boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
                        }}
                    >
                        <MessageCircle style={{ width: 15, height: 15 }} />
                        واتساب
                    </button>

                    {/* Telegram */}
                    <button
                        onClick={() => window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`, '_blank')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '12px 16px',
                            background: '#0088cc', color: 'white',
                            fontWeight: 700, fontSize: '13px',
                            border: 'none', borderRadius: '14px', cursor: 'pointer',
                            fontFamily: 'Cairo, Tahoma, sans-serif',
                            boxShadow: '0 4px 16px rgba(0,136,204,0.35)',
                        }}
                    >
                        <Share2 style={{ width: 15, height: 15 }} />
                        تلغرام
                    </button>

                    {/* Copy text */}
                    <button
                        onClick={copyText}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '12px 14px',
                            background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                            color: copied ? '#4ade80' : 'rgba(255,255,255,0.75)',
                            fontWeight: 700, fontSize: '12px',
                            border: `1px solid ${copied ? '#4ade80' : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: '14px', cursor: 'pointer',
                            fontFamily: 'Cairo, Tahoma, sans-serif',
                            transition: 'all 0.25s',
                        }}
                    >
                        {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                        {copied ? 'تم!' : 'نسخ'}
                    </button>
                </div>
            </div>
        </div>
    );
}
