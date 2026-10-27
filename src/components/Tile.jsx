import React, { useState } from 'react';
import { tileImageUrl, tileShort, isSuited, isBonus } from '../engine/tiles.js';

// Sizes in px (width). Height ~ 1.34x width to match mahjong tile ratio.
const SIZES = {
  sm: 30,
  md: 40,
  lg: 52,
  xl: 76,
};

// Colour accents for the inline fallback chip per suit.
function chipColor(id) {
  if (id.startsWith('man')) return '#b23a2e'; // characters - red
  if (id.startsWith('sou')) return '#2f7d4f'; // bamboo - green
  if (id.startsWith('pin')) return '#2b5d9c'; // circles - blue
  if (id.startsWith('dragon_red')) return '#b23a2e';
  if (id.startsWith('dragon_green')) return '#2f7d4f';
  if (id.startsWith('dragon_white')) return '#444';
  if (id.startsWith('wind')) return '#3a3a3a';
  if (isBonus(id)) return '#9c7f30';
  return '#333';
}

export default function Tile({
  id,
  size = 'md',
  onClick,
  dead = false,
  dim = false,
  badge = null,
  highlight = false,
  greenRing = false,
  animateKey = null,
  className = '',
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const w = SIZES[size] || SIZES.md;
  const h = Math.round(w * 1.34);
  const url = tileImageUrl(id);
  // The white dragon (白板) is a blank framed tile and reads as "pure white".
  // Render our own clearly-coloured framed rectangle instead.
  const isWhiteDragon = id === 'dragon_white';
  const showImg = url && !imgFailed && !isWhiteDragon;

  return (
    <button
      type="button"
      onClick={onClick}
      key={animateKey}
      className={`relative shrink-0 rounded-md bg-cream shadow-md select-none-app
        flex items-center justify-center overflow-hidden
        ${greenRing ? 'ring-2 ring-emerald-400' : highlight ? 'ring-2 ring-gold' : 'ring-1 ring-black/20'}
        ${onClick ? 'active:scale-95 transition-transform animate-pop' : ''}
        ${className}`}
      style={{ width: w, height: h }}
      aria-label={id}
    >
      {isWhiteDragon ? (
        <span className="absolute inset-[16%] rounded-sm border-[3px] border-[#1f3a5f] bg-gradient-to-br from-white to-slate-200 pointer-events-none" />
      ) : showImg ? (
        <img
          src={url}
          alt={id}
          draggable={false}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain p-0.5 pointer-events-none"
        />
      ) : (
        <span
          className="font-bold leading-none text-center px-0.5 pointer-events-none"
          style={{ color: chipColor(id), fontSize: Math.round(w * 0.42) }}
        >
          {tileShort(id)}
        </span>
      )}

      {/* dead / dim overlays */}
      {dead && (
        <span className="absolute inset-0 bg-red-900/55 flex items-center justify-center">
          <span
            className="block bg-red-500/90 rotate-[-20deg]"
            style={{ width: '120%', height: 3 }}
          />
        </span>
      )}
      {dim && !dead && <span className="absolute inset-0 bg-amber-400/25" />}

      {badge != null && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-jade-dark text-[11px] font-extrabold flex items-center justify-center shadow">
          {badge}
        </span>
      )}
    </button>
  );
}
