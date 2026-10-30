import React, { useState } from 'react';
import Tile from './Tile.jsx';
import IdealHand from './IdealHand.jsx';
import { tileName } from '../engine/tiles.js';

function SectionTitle({ children }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-gold/80 font-bold mb-2">
      {children}
    </h3>
  );
}

// One decision in the move card: a tile, what happened, and a one-line reason.
function MoveRow({ tiles, title, tone, short }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5 shrink-0">
        {tiles.map((id, i) => (
          <Tile key={i} id={id} size={tiles.length > 1 ? 'sm' : 'lg'} />
        ))}
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-bold ${tone}`}>{title}</div>
        {short && <p className="text-[12px] text-cream/80 leading-snug">{short}</p>}
      </div>
    </div>
  );
}

// Shown instead of the move card when the hand is a legal 8+ win.
function WinCard({ win }) {
  const selfDrawn = win.winType === 'selfdraw';
  return (
    <div className="rounded-2xl bg-jade-deep ring-2 ring-gold shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Tile id={win.id} size="lg" />
        <div>
          <div className="text-lg font-extrabold text-gold">Declare the win 🀄</div>
          <p className="text-[12px] text-cream/85 leading-snug">
            {selfDrawn
              ? `You drew ${tileName(win.id)} — call self-drawn win (zimo 自摸).`
              : `Take ${tileName(win.id)} and call the win (hu 和).`}
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-green-900/25 ring-1 ring-green-400/40 p-3">
        <div className="text-sm font-bold text-green-300 mb-1">{win.points} points</div>
        <ul className="space-y-0.5">
          {win.reasons.map((r, i) => (
            <li key={i} className="text-[12px] text-cream/80 leading-snug">
              <span className="text-gold/70 mr-1">▸</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Advice panel at the bottom of the page, shown after "Make My Move".
// Everything about the move is in one card with a short reason per decision;
// "Show more" opens the full reasoning. Below it, the hands being built.
export default function AdvisorSheet({ advice }) {
  const [more, setMore] = useState(false);
  if (!advice) return null;
  const { recommendedDiscard, idealHand, alternativeGoals = [], moveLog = [], played = {} } = advice;

  if (played.win) return <WinCard win={played.win} />;

  const claim = played.claim;
  const thrown = played.discard;
  // No tile thrown this turn but one is recommended (e.g. you added a draw by hand).
  const next = !thrown && recommendedDiscard ? recommendedDiscard : null;
  const details = [
    ...(claim?.details || []),
    ...(thrown?.details || []),
    ...(next?.details || []),
  ];
  const plans = [idealHand, ...alternativeGoals].filter(Boolean);

  return (
    <div className="rounded-2xl bg-jade-deep ring-1 ring-gold/30 shadow-xl overflow-hidden">
      <div className="px-3 py-3 space-y-4">
        {/* Move played: claim decision + tile thrown, each with a short reason */}
        <div>
          <SectionTitle>Move played</SectionTitle>
          <div className="rounded-xl bg-green-900/25 ring-1 ring-green-400/40 p-3 space-y-3">
            {claim && (
              <MoveRow
                tiles={claim.taken && played.claimed ? played.claimed.tiles : [claim.tile]}
                title={claim.taken ? `Claimed ${tileName(claim.tile)}` : `Skipped ${tileName(claim.tile)}`}
                tone={claim.taken ? 'text-green-300' : 'text-cream/80'}
                short={claim.short}
              />
            )}
            {thrown && (
              <MoveRow tiles={[thrown.id]} title={`Threw ${tileName(thrown.id)}`} tone="text-red-300" short={thrown.short} />
            )}
            {next && (
              <MoveRow tiles={[next.id]} title={`Throw ${tileName(next.id)}`} tone="text-gold" short={next.short} />
            )}
            {!claim && !thrown && !next && moveLog.map((line, i) => (
              <p key={i} className="text-sm text-cream/85 leading-snug">{line}</p>
            ))}

            {details.length > 0 && (
              <>
                {more && (
                  <ul className="space-y-1 border-t border-white/10 pt-2">
                    {details.map((line, i) => (
                      <li key={i} className="text-[12px] text-cream/75 leading-snug">
                        <span className="text-gold/70 mr-1">▸</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setMore((m) => !m)}
                  className="text-[11px] font-semibold text-gold/90 underline"
                >
                  {more ? 'Show less' : 'Show more'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* The hands being built: compact, tap one for details */}
        <div>
          <SectionTitle>Hands I'm building (8+ pts)</SectionTitle>
          {plans.length ? (
            <div className="space-y-1.5">
              {plans.map((g, i) => (
                <IdealHand key={i} ideal={g} label={i === 0 ? 'Main plan' : 'Backup'} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-cream/70 rounded-xl bg-jade-dark/60 p-3 leading-snug">
              No 8-point hand is within reach yet. Keeping flexible shapes — pairs and runs that can grow.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
