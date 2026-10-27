import React from 'react';
import Tile from './Tile.jsx';
import MeldAdvice from './MeldAdvice.jsx';
import IdealHand from './IdealHand.jsx';
import { tileToId, tileName } from '../engine/tiles.js';

function SectionTitle({ children }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-gold/80 font-bold mb-2">
      {children}
    </h3>
  );
}

const MELD_LABEL = { chow: 'Chow 吃', pung: 'Pung 碰', kong: 'Kong 槓' };

// Inline advice panel (rendered at the bottom of the main page, not a modal).
export default function AdvisorSheet({ advice }) {
  if (!advice) return null;
  const {
    recommendedDiscard,
    meldAdvice,
    tenpaiStatus,
    idealHand,
    alternativeGoals = [],
    moveLog,
    played,
  } = advice;

  const showPlayedTiles = played && (played.thrownId || played.claimed);

  return (
    <div className="rounded-2xl bg-jade-deep ring-1 ring-gold/30 shadow-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <span className="text-base font-bold text-gold">🀄 What I did</span>
      </div>

      <div className="px-3 py-3 space-y-5">
        {/* 0. What the system just played */}
        {moveLog && moveLog.length > 0 && (
          <div>
            <SectionTitle>Move played</SectionTitle>
            <div className="rounded-xl bg-green-900/30 ring-1 ring-green-400/40 p-3">
              {showPlayedTiles && (
                <div className="float-left mr-3 mb-1 flex gap-3">
                  {played.claimed && (
                    <div>
                      <div className="text-[10px] text-gold/70 mb-1">
                        Claimed {MELD_LABEL[played.claimed.type] || played.claimed.type}
                      </div>
                      <div className="flex gap-1">
                        {played.claimed.tiles.map((t, i) => (
                          <Tile key={i} id={t} size="md" highlight />
                        ))}
                      </div>
                    </div>
                  )}
                  {played.thrownId && (
                    <div>
                      <div className="text-[10px] text-red-300/80 mb-1">Threw out</div>
                      <Tile id={played.thrownId} size="lg" />
                    </div>
                  )}
                </div>
              )}
              {moveLog.map((line, i) => (
                <p key={i} className="text-sm text-cream/90 leading-snug mb-1.5 last:mb-0">
                  <span className="text-green-300 mr-1.5">▸</span>
                  {line}
                </p>
              ))}
              <div className="clear-both" />
            </div>
          </div>
        )}

        {/* 1. Primary recommendation */}
        {recommendedDiscard && (
          <div>
            <SectionTitle>Best discard now</SectionTitle>
            <div className="flex items-center gap-3 rounded-xl bg-gold/15 ring-2 ring-gold p-3">
              <Tile id={recommendedDiscard.id} size="xl" highlight />
              <div className="flex-1">
                <div className="text-xl font-extrabold text-gold">
                  {tileName(recommendedDiscard.id)}
                </div>
                <p className="text-sm text-cream/85 leading-snug mt-1">
                  {recommendedDiscard.reason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Meld advice (when a claim is on the table but not auto-done).
            Hidden once we've thrown a tile — that turn's claim window is gone. */}
        {meldAdvice && !played?.thrownId && (
          <div>
            <SectionTitle>Claim the last discard?</SectionTitle>
            <MeldAdvice advice={meldAdvice} />
          </div>
        )}

        {/* 3. How close you are */}
        <div>
          <SectionTitle>How close you are</SectionTitle>
          {tenpaiStatus.isTenpai ? (
            <div className="rounded-xl bg-gold/20 ring-2 ring-gold p-3 animate-pulseGold">
              <div className="text-2xl font-extrabold text-gold tracking-wide">
                READY TO WIN 🀄
              </div>
              <div className="text-[11px] text-cream/70 mt-1">
                Tiles that win it (copies left · points):
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {tenpaiStatus.winningTiles.map((w, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <Tile id={tileToId(w.tile)} size="sm" highlight dead={w.liveCopies <= 0} />
                    <span
                      className={`text-[9px] font-bold ${
                        w.liveCopies <= 0 ? 'text-red-400' : 'text-green-300'
                      }`}
                    >
                      {w.liveCopies} left · {w.points}p
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : tenpaiStatus.valueShort ? (
            <div className="rounded-xl bg-amber-900/40 ring-2 ring-amber-400/70 p-3">
              <div className="text-lg font-extrabold text-amber-300">
                One tile from complete — but worth under 8 points
              </div>
              <p className="text-[12px] text-cream/80 mt-1 leading-snug">
                Any of these tiles finishes the shape, but the hand would score
                below the 8-point minimum, so it can’t be declared a win yet.
                Keep building toward the goal above to add value.
              </p>
              {tenpaiStatus.shortWins && tenpaiStatus.shortWins.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tenpaiStatus.shortWins.map((w, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <Tile id={tileToId(w.tile)} size="sm" dim dead={w.liveCopies <= 0} />
                      <span className="text-[9px] font-bold text-amber-300">
                        only {w.points}p
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tenpaiStatus.shantenNumber === 1 ? (
            <div className="rounded-xl bg-jade-dark/70 p-3">
              <div className="font-bold text-cream">
                1 good tile away from being ready
              </div>
              <div className="text-[11px] text-cream/60 mt-1">
                Best tiles to draw (copies left):
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(tenpaiStatus.bestDraws || []).map((w, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <Tile id={tileToId(w.tile)} size="sm" highlight />
                    <span className="text-[9px] font-bold text-green-300">{w.liveCopies}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-jade-dark/70 p-3">
              <span className="text-cream font-bold text-lg">
                {tenpaiStatus.shantenNumber}
              </span>
              <span className="text-cream/70">
                {' '}
                useful tile{tenpaiStatus.shantenNumber === 1 ? '' : 's'} from being
                ready to win
              </span>
            </div>
          )}
        </div>

        {/* 4. The concrete hand it's going for */}
        <div>
          <SectionTitle>What I'm building toward (≥8 pts)</SectionTitle>
          {idealHand ? (
            <IdealHand ideal={idealHand} />
          ) : (
            <div className="text-sm text-cream/70 rounded-xl bg-jade-dark/60 p-3 leading-snug">
              No 8-point hand is within reach yet. Keep flexible shapes — pairs and
              runs that can grow — and aim to line up a scoring pattern (a flush, a
              straight, or shifted/mixed runs) before committing.
            </div>
          )}
        </div>

        {/* 5. Other reachable ≥8 directions */}
        {alternativeGoals.length > 0 && (
          <div>
            <SectionTitle>Other ways to reach 8 points</SectionTitle>
            <div className="space-y-2">
              {alternativeGoals.map((g, i) => (
                <IdealHand key={i} ideal={g} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
