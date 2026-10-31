import React, { useMemo, useState } from 'react';
import { SCORING_RULES, SCORING_GUIDE } from '../data/pointSystem.js';

// Full-screen reference: how MCR hands are scored and paid, and every scoring
// rule with its points, sortable most → least or least → most, with a search box.
export default function PointSystem({ onClose }) {
  const [order, setOrder] = useState('desc'); // 'desc' = most points first
  const [query, setQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  // Rules grouped by point value, in the chosen order, filtered by the search.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (r) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.cn || '').includes(q) ||
      r.description.toLowerCase().includes(q);
    const byPoints = new Map();
    for (const r of SCORING_RULES.filter(match)) {
      if (!byPoints.has(r.points)) byPoints.set(r.points, []);
      byPoints.get(r.points).push(r);
    }
    return [...byPoints.entries()].sort((a, b) => (order === 'desc' ? b[0] - a[0] : a[0] - b[0]));
  }, [order, query]);
  const shown = groups.reduce((n, [, rules]) => n + rules.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-jade-deep overflow-y-auto">
      <div className="max-w-md mx-auto px-3 pb-10">
        {/* Header + controls stay at the top while scrolling */}
        <div className="sticky top-0 z-10 -mx-3 px-3 pt-3 pb-2 bg-jade-deep/95 backdrop-blur border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gold">Point system 番种</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg bg-jade-mid text-cream/80"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rules…"
              className="flex-1 min-w-0 rounded-lg bg-jade-dark text-cream text-sm px-2.5 py-1.5 ring-1 ring-white/10 focus:ring-gold outline-none"
            />
            <div className="flex rounded-lg bg-jade-dark p-0.5 shrink-0" role="radiogroup" aria-label="Sort">
              {[
                ['desc', 'Most → least'],
                ['asc', 'Least → most'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={order === key}
                  onClick={() => setOrder(key)}
                  className={`rounded-md px-2 text-[11px] font-semibold ${
                    order === key ? 'bg-gold text-jade-dark' : 'text-cream/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How scoring works */}
        <div className="mt-3 rounded-xl bg-jade-dark/70 ring-1 ring-gold/25">
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="w-full flex items-center justify-between p-3 text-left"
            aria-expanded={guideOpen}
          >
            <span className="text-sm font-bold text-cream">How scoring works</span>
            <span className="text-[11px] text-gold/80">{guideOpen ? '▲ less' : '▼ more'}</span>
          </button>
          {!guideOpen && (
            <p className="px-3 pb-3 -mt-1 text-[12px] text-cream/70 leading-snug">
              You need <b className="text-gold">8 points</b> to win (flowers don't count). Everyone pays
              the winner 8, plus the hand's value from the discarder or, on a self-draw, from everyone.
            </p>
          )}
          {guideOpen && (
            <div className="px-3 pb-3 space-y-3 text-[12px] text-cream/80 leading-snug">
              <ul className="space-y-1.5">
                {SCORING_GUIDE.basics.map((b, i) => (
                  <li key={i}>
                    <span className="text-gold/80 mr-1">▸</span>
                    {b}
                  </li>
                ))}
              </ul>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gold/80 font-bold mb-1">Paying out</div>
                <p>{SCORING_GUIDE.payments.rule}</p>
                <div className="mt-2 grid gap-2">
                  {SCORING_GUIDE.payments.examples.map((ex, i) => (
                    <div key={i} className="rounded-lg bg-jade-deep/70 p-2">
                      <div className="font-semibold text-cream">{ex.title}</div>
                      {ex.lines.map((l, j) => (
                        <div key={j} className="text-cream/70">{l}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gold/80 font-bold mb-1">Scoring principles</div>
                <div className="space-y-2">
                  {SCORING_GUIDE.principles.map((p) => (
                    <div key={p.name}>
                      <span className="font-semibold text-cream">{p.name}: </span>
                      {p.text}
                      <div className="text-cream/55 italic">e.g. {p.example}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Every scoring rule, grouped by points */}
        <div className="mt-4 flex items-baseline justify-between">
          <h3 className="text-[11px] uppercase tracking-widest text-gold/80 font-bold">All scoring rules</h3>
          <span className="text-[11px] text-cream/50">{shown} rule{shown === 1 ? '' : 's'}</span>
        </div>
        {groups.length === 0 && (
          <p className="mt-3 text-sm text-cream/60">No rule matches “{query}”.</p>
        )}
        <div className="mt-2 space-y-4">
          {groups.map(([points, rules]) => (
            <section key={points}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded-md bg-gold text-jade-dark text-sm font-extrabold px-2 py-0.5">{points}</span>
                <span className="text-[12px] text-cream/60">point{points === 1 ? '' : 's'} each</span>
              </div>
              <div className="space-y-1.5">
                {rules.map((r) => (
                  <div key={r.name} className="rounded-lg bg-jade-dark/60 px-2.5 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-cream">
                        {r.name} <span className="font-normal text-cream/60">{r.cn}</span>
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-gold">{r.points} pt{r.points === 1 ? '' : 's'}</span>
                    </div>
                    <p className="text-[12px] text-cream/75 leading-snug mt-0.5">{r.description}</p>
                    {r.notes.map((n, i) => (
                      <p key={i} className="text-[11px] text-cream/55 italic leading-snug mt-0.5">{n}</p>
                    ))}
                    {r.notCombine.length > 0 && (
                      <p className="text-[11px] text-amber-200/80 leading-snug mt-1">
                        <span className="font-semibold">Doesn't combine with: </span>
                        {r.notCombine.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-6 text-[10px] text-cream/40 text-center">
          Rules from{' '}
          <a href="https://playmahjong.io/chinese-official-rules" target="_blank" rel="noreferrer" className="underline">
            playmahjong.io
          </a>{' '}
          (Chinese Official / MCR).
        </p>
      </div>
    </div>
  );
}
