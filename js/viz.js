// Charts visuals — professional palette (slate / indigo / emerald).
// app.js calls window.HuffViz.update(result) on compress.

(function () {
  const $ = (id) => document.getElementById(id);

  function renderCharts(r, el) {
    if (!el) return;
    const entries = Object.keys(r.freqMap)
      .map((ch) => ({ ch, f: r.freqMap[ch], len: r.codes[ch].length }));
    const totalChars = entries.reduce((a, e) => a + e.f, 0);
    const fixedBits = totalChars * 8;
    const huffBits = r.bitstring.length;
    const pct = fixedBits ? Math.round((huffBits / fixedBits) * 100) : 0;
    const saved = fixedBits ? Math.round((1 - huffBits / fixedBits) * 100) : 0;

    const dist = {};
    entries.forEach((e) => { dist[e.len] = (dist[e.len] || 0) + 1; });
    const lens = Object.keys(dist).map(Number).sort((a, b) => a - b).slice(0, 8);
    const maxD = Math.max(...Object.values(dist), 1);
    const top = [...entries].sort((a, b) => b.f - a.f).slice(0, 3);

    let html = '';
    html += `<div class="rounded-xl p-4 bg-white/5 border border-white/10">` +
      `<div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total size (bits)</div>` +
      `<div class="mt-3 space-y-3">` +
      `<div><div class="flex justify-between text-xs mb-1 text-slate-300"><span>Fixed 8-bit encoding</span><span class="font-mono">${fixedBits}</span></div>` +
      `<div class="h-3.5 rounded-full bg-white/10 overflow-hidden"><div class="h-3.5 rounded-full bg-slate-400" style="width:100%"></div></div></div>` +
      `<div><div class="flex justify-between text-xs mb-1"><span class="text-emerald-300 font-semibold">Huffman encoding</span><span class="font-mono font-semibold text-emerald-300">${huffBits} (${pct}%)</span></div>` +
      `<div class="h-3.5 rounded-full bg-white/10 overflow-hidden"><div class="h-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style="width:${pct}%"></div></div></div>` +
      `</div>` +
      `<div class="mt-3 inline-block text-xs font-bold rounded-full px-3 py-1 ${saved >= 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}">${saved >= 0 ? saved + '% smaller' : 'kept as-is (input too small)'}</div></div>`;

    html += `<div class="grid grid-cols-3 gap-2 mt-3">`;
    top.forEach((e, i) => {
      const raw = e.ch === ' ' ? 'space' : (e.ch === '\n' ? 'newline' : e.ch);
      const name = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      html += `<div class="rounded-xl p-3 text-center bg-white border border-slate-200">` +
        `<div class="text-[11px] uppercase tracking-wider font-bold text-indigo-600">Most frequent ${i + 1}</div>` +
        `<div class="text-xl font-extrabold text-slate-900 font-mono">${name}</div>` +
        `<div class="text-xs text-slate-500">×${e.f} · ${e.len}-bit code</div></div>`;
    });
    html += `</div>`;

    html += `<div class="rounded-xl p-4 mt-3 bg-white/5 border border-white/10">` +
      `<div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Characters per code length</div>` +
      `<div class="flex items-end gap-2 mt-3" style="height:7rem">`;
    lens.forEach((L) => {
      const h = Math.max(8, Math.round((dist[L] / maxD) * 96));
      html += `<div class="flex-1 flex flex-col items-center gap-1">` +
        `<span class="text-[11px] font-bold text-indigo-300">${dist[L]}</span>` +
        `<div class="w-full rounded-md bg-gradient-to-t from-indigo-600 to-cyan-400" style="height:${h}px;min-height:8px"></div>` +
        `<span class="text-[11px] font-mono text-slate-400">${L}b</span></div>`;
    });
    html += `</div><p class="text-xs text-slate-500 mt-2">Short codes on the left belong to the most frequent characters. The full table is under “Character codes”.</p></div>`;

    el.innerHTML = html;
  }

  window.HuffViz = {
    update(r) {
      renderCharts(r, $('chartsView'));
    }
  };
})();
