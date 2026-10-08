// UI wiring for Huffman Compressor — Core + Dashboard
// Depends on: js/heap.js (MinHeap), js/huffman.js (compressText, etc.)

(function () {
  const $ = (id) => document.getElementById(id);

  const SAMPLE = 'huffman coding compresses text by giving short codes to frequent characters.\n\nTry uploading a .txt file, then download the .huff and decompress it back!';

  let lastResult = null;
  let lastFileName = 'input.txt';
  let lastHuffBytes = null;
  let lastDecompressed = '';

  // ---------- Tabs ----------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      $('tab-compress').classList.toggle('hidden', tab !== 'compress');
      $('tab-decompress').classList.toggle('hidden', tab !== 'decompress');
      $('tab-dashboard').classList.toggle('hidden', tab !== 'dashboard');
      if (tab === 'dashboard') renderHistory();
    });
  });

  // ---------- Helpers ----------
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(2) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function displayChar(ch) {
    if (ch === ' ') return "' '";
    if (ch === '\n') return "'\\n'";
    if (ch === '\t') return "'\\t'";
    return ch;
  }

  function utf8len(str) {
    return new TextEncoder().encode(str).length;
  }

  try {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  } catch (e) {}

  function readTextFile(f) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => resolve(String(rd.result || ''));
      rd.onerror = () => reject(new Error('read failed'));
      rd.readAsText(f);
    });
  }

  function readPdfFile(f) {
    if (typeof pdfjsLib === 'undefined') {
      return Promise.reject(new Error('PDF engine still loading — needs internet once, then try again.'));
    }
    return f.arrayBuffer().then((buf) =>
      pdfjsLib.getDocument({ data: buf }).promise.then((pdf) => {
        const jobs = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          jobs.push(pdf.getPage(i).then((page) =>
            page.getTextContent().then((tc) => tc.items.map((it) => it.str).join(' '))
          ));
        }
        return Promise.all(jobs).then((pages) => pages.join('\n'));
      })
    );
  }

  function getFileText(f) {
    if (/\.pdf$/i.test(f.name)) return readPdfFile(f);
    return readTextFile(f);
  }

  function baseName(f) {
    return f.name.replace(/\.pdf$/i, '.txt');
  }

  // ---------- History ----------
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('huffman-history') || '[]'); }
    catch { return []; }
  }
  function saveHistory(h) {
    try { localStorage.setItem('huffman-history', JSON.stringify(h.slice(0, 50))); } catch {}
  }
  function addHistory(entry) {
    const h = getHistory();
    h.unshift(entry);
    saveHistory(h);
  }
  function renderHistory() {
    const h = getHistory();
    const tb = $('historyTable');
    if (!h.length) {
      tb.innerHTML = '<tr><td colspan="6" class="p-3 text-gray-500">No compressions yet. Go to Compress tab.</td></tr>';
      return;
    }
    tb.innerHTML = h.map((e) =>
      `<tr class="border-t"><td class="p-2 font-mono">${escHtml(e.name)}</td>` +
      `<td class="p-2">${fmtBytes(e.orig)}</td><td class="p-2">${fmtBytes(e.comp)}</td>` +
      `<td class="p-2 ${e.saved >= 0 ? 'text-green-700' : 'text-red-600'} font-semibold">${e.saved.toFixed(1)}%</td>` +
      `<td class="p-2">${e.chars}</td><td class="p-2">${e.ms.toFixed(1)} ms</td></tr>`
    ).join('');
  }

  // ---------- Compress ----------
  function doCompress(text, fileName) {
    if (!text) { alert('Enter text or upload a file first.'); return; }
    const r = compressText(text);
    lastResult = r;
    lastFileName = fileName || 'input.txt';

    // Real byte sizes
    const origBytes = utf8len(text);
    // Build actual .huff bytes — auto raw fallback if too small
    const huffResult = createHuffBlob(text, lastFileName);
    lastHuffBytes = huffResult.blob;
    blobToNote(huffResult);
    function blobToNote(hr) {
      hr.blob.arrayBuffer().then((buf) => {
        const total = buf.byteLength;
        const saved = origBytes === 0 ? 0 : (1 - total / origBytes) * 100;
        $('statOrig').textContent = fmtBytes(origBytes);
        $('statComp').textContent = fmtBytes(total);
        if (hr.raw) {
          $('statRatio').textContent = '0% — too small';
          $('statRatio').className = 'font-extrabold mt-1 text-lg text-amber-600';
        } else {
          $('statRatio').textContent = saved.toFixed(1) + '% saved';
          $('statRatio').className = 'font-extrabold mt-1 text-lg ' + (saved >= 0 ? 'text-green-700' : 'text-red-600');
        }
        $('statAvg').textContent = r.avgBits.toFixed(2);
        $('statTime').textContent = r.timeMs.toFixed(2) + ' ms';
        if (!hr.raw && isFinite(saved)) {
          const avgTo = r.avgBits, dur = 650, t0 = performance.now();
          const finalR = saved.toFixed(1) + '% saved', finalA = avgTo.toFixed(2);
          let done = false;
          const finish = () => { if (!done) { done = true; $('statRatio').textContent = finalR; $('statAvg').textContent = finalA; } };
          const step = (t) => {
            if (done) return;
            const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
            $('statRatio').textContent = (saved * e).toFixed(1) + '% saved';
            $('statAvg').textContent = (8 + (avgTo - 8) * e).toFixed(2);
            if (k < 1) requestAnimationFrame(step); else finish();
          };
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
          setTimeout(finish, dur + 300);
        }
        $('huffSizeNote').textContent = hr.raw
          ? `File too small — doesn't require compression. Saved original as-is so it restores perfectly. Try 5-10KB repetitive text to see savings.`
          : `Header + data = ${total} B.`;
        addHistory({ name: lastFileName + (hr.raw ? ' (raw)' : ''), orig: origBytes, comp: total, saved: hr.raw ? 0 : saved, chars: [...text].length, ms: r.timeMs, date: Date.now() });
      });
    }

    // Codes table sorted by freq
    const rows = Object.keys(r.freqMap)
      .map((ch) => ({ ch, f: r.freqMap[ch], c: r.codes[ch] }))
      .sort((a, b) => b.f - a.f);
    $('codesTable').innerHTML = rows.map((x) =>
      `<tr class="border-t hover:bg-indigo-50/50 transition"><td class="p-2.5 font-mono font-bold">${escHtml(displayChar(x.ch))}</td>` +
      `<td class="p-2.5 text-slate-500">${x.f}</td><td class="p-2.5"><span class="code-pill font-mono">${x.c}</span></td><td class="p-2.5 text-slate-500">${x.c.length}</td></tr>`
    ).join('');

    if ($('treeView')) renderTree(r.root, $('treeView'));
    if ($('bitsPreview')) $('bitsPreview').textContent = r.bitstring.length > 2000
      ? r.bitstring.slice(0, 2000) + `... (${r.bitstring.length} bits total)`
      : r.bitstring || '(empty)';
    if (window.HuffViz && window.HuffViz.update) {
      try { window.HuffViz.update(r); } catch (e) { console.warn(e); }
    }
    $('results').classList.remove('hidden');
  }

  $('compressBtn').addEventListener('click', () => {
    const btn = $('compressBtn');
    const origLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Pressing…';
    btn.classList.add('opacity-70');
    setTimeout(() => {
      try {
        if (fileQueue.length > 1) compressQueue();
        else {
          fileQueue = [];
          renderQueue();
          doCompress($('inputText').value, lastFileName);
        }
      }
      finally {
        btn.disabled = false;
        btn.innerHTML = origLabel;
        btn.classList.remove('opacity-70');
      }
    }, 40);
  });

  function compressQueue() {
    const files = [...fileQueue];
    fileQueue = [];
    renderQueue();
    let done = 0;
    $('fileInfo').textContent = `Compressing ${files.length} staged files…`;
    const finishMaybe = () => {
      if (done === files.length) {
        $('fileInfo').textContent = `Batch: ${done}/${files.length} compressed.`;
        renderHistory();
      }
    };
    files.forEach((f) => {
      getFileText(f).then((text) => {
        if (!text.trim()) { done++; finishMaybe(); return; }
        const name = baseName(f);
        const r = compressText(text);
        const hr = createHuffBlob(text, name);
        hr.blob.arrayBuffer().then((buf) => {
          const orig = utf8len(text);
          const saved = hr.raw ? 0 : (orig === 0 ? 0 : (1 - buf.byteLength / orig) * 100);
          addHistory({ name: name + (hr.raw ? ' (raw)' : ''), orig, comp: buf.byteLength, saved, chars: [...text].length, ms: r.timeMs, date: Date.now() });
          done++;
          if (done === 1) { $('inputText').value = text; lastFileName = name; doCompress(text, name); }
          else finishMaybe();
        });
      }).catch(() => { done++; finishMaybe(); });
    });
  }

  $('sampleBtn').addEventListener('click', () => {
    $('inputText').value = SAMPLE;
    lastFileName = 'sample.txt';
    $('fileInfo').textContent = 'Sample loaded.';
  });

  $('clearBtn').addEventListener('click', () => {
    $('inputText').value = '';
    $('results').classList.add('hidden');
    $('fileInfo').textContent = '';
  });

  let fileQueue = [];
  function renderQueue() {
    const box = $('fileQueue');
    if (!box) return;
    if (!fileQueue.length) {
      box.classList.add('hidden');
      box.classList.remove('flex');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    box.classList.add('flex');
    box.innerHTML = fileQueue.map((f, i) =>
      `<span class="inline-flex items-center gap-2 text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full pl-3 pr-1.5 py-1">` +
      `<span class="font-mono">${escHtml(f.name)}</span><span class="text-indigo-400">${fmtBytes(f.size)}</span>` +
      `<button data-q="${i}" class="fq-x w-5 h-5 rounded-full bg-indigo-200 hover:bg-red-400 hover:text-white font-bold leading-none" title="Remove">×</button></span>`
    ).join('');
    box.querySelectorAll('.fq-x').forEach((b) => b.addEventListener('click', () => {
      fileQueue.splice(parseInt(b.getAttribute('data-q'), 10), 1);
      renderQueue();
    }));
  }

  function handleFiles(fileList) {
    const all = [...fileList];
    if (!all.length) return;
    const huffs = all.filter((f) => /\.huff$/i.test(f.name));
    const files = all.filter((f) => !/\.huff$/i.test(f.name));
    if (huffs.length && !files.length) {
      // Dropped a compressed file — hand it to the Restore tab
      const tab = document.querySelector('[data-tab="decompress"]');
      if (tab) tab.click();
      setRestoreFile(huffs[0]);
      return;
    }
    if (!files.length) return;
    // Stage files in the visible queue (no duplicates)
    files.forEach((f) => {
      if (!fileQueue.some((q) => q.name === f.name && q.size === f.size)) fileQueue.push(f);
    });
    renderQueue();
    if (files.length === 1) {
      const f = files[0];
      lastFileName = baseName(f);
      $('fileInfo').textContent = `Reading ${f.name}…`;
      getFileText(f).then((text) => {
        if (!text.trim()) {
          $('fileInfo').textContent = `${f.name}: no extractable text (scanned-image PDFs have none).`;
          return;
        }
        $('inputText').value = text;
        const tag = /\.pdf$/i.test(f.name) ? ` (${[...text].length.toLocaleString()} chars from PDF)` : ` (${fmtBytes(f.size)})`;
        $('fileInfo').textContent = `Loaded ${f.name}${tag}`;
      }).catch((err) => {
        $('fileInfo').textContent = `Could not read ${f.name}: ${err.message || err}`;
      });
    } else {
      // Multiple files: stage them, preview the first, wait for Compress
      const first = files[0];
      $('fileInfo').textContent = `Loading preview of ${first.name}… (${files.length} files staged)`;
      getFileText(first).then((text) => {
        if (!text.trim()) {
          $('fileInfo').textContent = `${files.length} files staged — first has no readable text. Press Compress anyway, or remove it.`;
          return;
        }
        $('inputText').value = text;
        lastFileName = baseName(first);
        $('fileInfo').textContent = `${files.length} files staged — previewing ${first.name}. Review, then press Compress.`;
      }).catch((err) => {
        $('fileInfo').textContent = `${files.length} files staged, but preview failed: ${err.message || err}`;
      });
    }
  }

  $('fileInput').addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  // Drop files anywhere on the page
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer.types || [])].includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    const o = $('dropOverlay');
    if (o) { o.classList.remove('hidden'); o.classList.add('flex'); }
  });
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (--dragDepth <= 0) {
      dragDepth = 0;
      const o = $('dropOverlay');
      if (o) { o.classList.add('hidden'); o.classList.remove('flex'); }
    }
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    const o = $('dropOverlay');
    if (o) { o.classList.add('hidden'); o.classList.remove('flex'); }
    if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  function fallbackAnchor(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Save-picker when available (shows a Save dialog), else classic download
  function saveBlob(blob, filename) {
    try {
      if (window.showSaveFilePicker) {
        const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '.bin';
        window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Files', accept: { 'application/octet-stream': [ext] } }],
        }).then(async (handle) => {
          const w = await handle.createWritable();
          await w.write(blob);
          await w.close();
        }).catch((e) => {
          if (!e || e.name !== 'AbortError') fallbackAnchor(blob, filename);
        });
        return;
      }
    } catch (e) {}
    fallbackAnchor(blob, filename);
  }

  $('downloadHuff').addEventListener('click', () => {
    if (!lastHuffBytes) { alert('Compress something first.'); return; }
    saveBlob(lastHuffBytes, lastFileName.replace(/\.[^.]+$/, '') + '.huff');
  });

  function saveTextAsPdf(text, filename) {
    if (typeof window.jspdf === 'undefined') { alert('PDF engine still loading — needs internet once, then try again.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text || '(empty)', pageW - margin * 2);
    const lineH = 14;
    let y = margin;
    lines.forEach((ln) => {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(ln, margin, y);
      y += lineH;
    });
    doc.save(filename);
  }

  $('downloadInputPdf').addEventListener('click', () => {
    const text = $('inputText').value || '';
    if (!text) { alert('Nothing to save — add text first.'); return; }
    saveTextAsPdf(text, (lastFileName.replace(/\.[^.]+$/, '') || 'input') + '.pdf');
  });

  // ---------- Decompress ----------
  let huffFile = null;
  let lastPdfName = 'restored.pdf';
  function setRestoreFile(f) {
    if (!f) return;
    huffFile = f;
    try {
      const dt = new DataTransfer();
      dt.items.add(f);
      $('huffInput').files = dt.files;
    } catch (e) {}
    $('decompStatus').textContent = `Selected ${f.name} — press Restore.`;
    $('decompOutput').classList.add('hidden');
    $('downloadTxt').classList.add('hidden');
    $('downloadPdf').classList.add('hidden');
    const pv = $('restorePreview');
    if (pv) {
      pv.classList.remove('hidden');
      pv.innerHTML = `<span class="text-slate-500 font-mono">Reading ${escHtml(f.name)}…</span>`;
      f.arrayBuffer().then((buf) => {
        try {
          const { header } = parseHuffBuffer(buf);
          const mode = header.raw === true
            ? 'stored as-is <span class="text-slate-500">(small file, needs no decoding)</span>'
            : `Huffman-coded <span class="text-slate-500">(${(Object.keys(header.freq || {}).length)} unique symbols)</span>`;
          pv.innerHTML =
            `<div class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">` +
            `<span class="text-slate-500">file</span><span class="font-semibold">${escHtml(f.name)} (${fmtBytes(f.size)})</span>` +
            `<span class="text-slate-500">holds</span><span class="font-semibold">${escHtml(header.originalName || 'unknown')} · ${(header.originalChars || 0).toLocaleString()} chars</span>` +
            `<span class="text-slate-500">method</span><span class="font-semibold">${mode}</span></div>`;
        } catch (err) {
          pv.innerHTML = `<span class="text-red-600 font-semibold">Not a valid .huff file:</span> <span class="font-mono">${escHtml(err.message || err)}</span>`;
        }
      }).catch((err) => {
        pv.innerHTML = `<span class="text-red-600 font-semibold">Could not read file:</span> <span class="font-mono">${escHtml(err.message || err)}</span>`;
      });
    }
  }
  $('huffInput').addEventListener('change', (e) => {
    huffFile = e.target.files[0] || null;
    if (huffFile) setRestoreFile(huffFile);
  });
  const restoreZone = $('restoreDrop');
  if (restoreZone) {
    restoreZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    restoreZone.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      const f = [...(e.dataTransfer.files || [])].find((x) => /\.huff$/i.test(x.name))
        || (e.dataTransfer.files || [])[0];
      if (f) setRestoreFile(f);
    });
  }
  $('decompressBtn').addEventListener('click', () => {
    if (!huffFile) { alert('Choose a .huff file first.'); return; }
    $('decompStatus').textContent = 'Decoding...';
    huffFile.arrayBuffer().then((buf) => {
      try {
        const { text, header, raw } = parseHuffBuffer(buf);
        lastDecompressed = text;
        lastPdfName = ((header.originalName || 'restored').replace(/\.[^.]+$/, '') || 'restored') + '.pdf';
        $('decompOutput').value = text;
        $('decompOutput').classList.remove('hidden');
        $('downloadTxt').classList.remove('hidden');
        $('downloadPdf').classList.remove('hidden');
        $('decompStatus').textContent = raw
          ? `OK: ${header.originalName || huffFile.name} — ${[...text].length} chars restored. Note: this file was too small and stored as-is (raw), no compression needed.`
          : `OK: ${header.originalName || huffFile.name} — ${[...text].length} chars restored.`;
      } catch (err) {
        $('decompStatus').textContent = 'Error: ' + err.message;
      }
    });
  });
  $('downloadTxt').addEventListener('click', () => {
    if (!lastDecompressed) return;
    saveBlob(new Blob([lastDecompressed], { type: 'text/plain' }), 'restored.txt');
  });
  $('downloadPdf').addEventListener('click', () => {
    if (!lastDecompressed && lastDecompressed !== '') return;
    saveTextAsPdf(lastDecompressed, lastPdfName);
  });

  $('clearHistory').addEventListener('click', () => {
    localStorage.removeItem('huffman-history');
    renderHistory();
  });

  // Init with sample text as requested
  if (!$('inputText').value) $('inputText').value = SAMPLE;
  renderHistory();
})();
