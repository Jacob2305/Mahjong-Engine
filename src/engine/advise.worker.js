// Runs advise() off the main thread for the live camera, so the video and boxes
// keep moving while the engine thinks (it can take a few seconds on a phone).
// In: { key, state } (advise() input). Out: { key, ok, summary | error }.
import { advise } from './advisor.js';
import { summarizeAdvice } from './liveAdvice.js';

self.onmessage = (e) => {
  const { key, state } = e.data;
  try {
    self.postMessage({ key, ok: true, summary: summarizeAdvice(advise(state)) });
  } catch (err) {
    self.postMessage({ key, ok: false, error: String(err?.message || err) });
  }
};
