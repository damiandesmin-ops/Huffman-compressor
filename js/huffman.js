// Core Huffman Coding logic — no DOM here.
// File format (.huff):
//   [4 bytes headerLen BE][header JSON utf-8][packed bytes]

class HuffmanNode {
  constructor(char, freq, left = null, right = null) {
    this.char = char;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
  isLeaf() {
    return this.left === null && this.right === null;
  }
}

function buildFrequencyMap(text) {
  const freq = {};
  for (const ch of text) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  return freq;
}

function getHeapClass() {
  const HeapClass = typeof MinHeap !== 'undefined' ? MinHeap : null;
  if (!HeapClass) throw new Error('MinHeap not loaded. Load js/heap.js first.');
  return HeapClass;
}

function buildTree(freqMap) {
  const chars = Object.keys(freqMap);
  if (chars.length === 0) return null;
  const HeapClass = getHeapClass();
  const heap = new HeapClass((a, b) => a.freq - b.freq);
  for (const ch of chars) {
    heap.insert(new HuffmanNode(ch, freqMap[ch]));
  }
  if (heap.size() === 1) {
    const only = heap.extractMin();
    return new HuffmanNode(null, only.freq, only, null);
  }
  while (heap.size() > 1) {
    const left = heap.extractMin();
    const right = heap.extractMin();
    heap.insert(new HuffmanNode(null, left.freq + right.freq, left, right));
  }
  return heap.extractMin();
}

function nodeLabel(n) {
  if (!n) return '?';
  if (n.isLeaf()) {
    if (n.char === ' ') return "' '";
    if (n.char === '\n') return "'\\n'";
    if (n.char === '\t') return "'\\t'";
    return n.char;
  }
  return '●' + n.freq;
}

function buildTreeWithSteps(freqMap) {
  const chars = Object.keys(freqMap);
  if (chars.length === 0) return { root: null, steps: [] };
  const HeapClass = getHeapClass();
  const heap = new HeapClass((a, b) => a.freq - b.freq);
  for (const ch of chars) heap.insert(new HuffmanNode(ch, freqMap[ch]));
  const steps = [];
  if (heap.size() === 1) {
    const only = heap.extractMin();
    const root = new HuffmanNode(null, only.freq, only, null);
    steps.push({ left: nodeLabel(only), leftFreq: only.freq, right: '—', rightFreq: 0, parentFreq: only.freq, remaining: 1 });
    return { root, steps };
  }
  while (heap.size() > 1) {
    const left = heap.extractMin();
    const right = heap.extractMin();
    const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
    heap.insert(parent);
    steps.push({ left: nodeLabel(left), leftFreq: left.freq, right: nodeLabel(right), rightFreq: right.freq, parentFreq: parent.freq, remaining: heap.size() });
  }
  return { root: heap.extractMin(), steps };
}

function generateCodes(root) {
  const codes = {};
  function dfs(node, path) {
    if (!node) return;
    if (node.isLeaf()) {
      codes[node.char] = path === '' ? '0' : path;
      return;
    }
    dfs(node.left, path + '0');
    dfs(node.right, path + '1');
  }
  if (root) dfs(root, '');
  return codes;
}

function encodeText(text, codes) {
  let bits = '';
  for (const ch of text) {
    const code = codes[ch];
    if (code === undefined) throw new Error('Missing code for char: ' + ch);
    bits += code;
  }
  return bits;
}

function packBits(bitstring) {
  const padding = (8 - (bitstring.length % 8)) % 8;
  const padded = bitstring + '0'.repeat(padding);
  const bytes = new Uint8Array(padded.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 8, i * 8 + 8), 2);
  }
  return { bytes, padding };
}

function unpackBits(bytes, padding) {
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0');
  }
  if (padding > 0) bits = bits.slice(0, -padding);
  return bits;
}

function decodeBits(bitstring, root) {
  if (!root) return '';
  if (root.isLeaf()) {
    return root.char.repeat(bitstring.length);
  }
  if (root.left && root.left.isLeaf() && root.right === null) {
    return root.left.char.repeat(bitstring.length);
  }
  let out = '';
  let node = root;
  for (const bit of bitstring) {
    node = bit === '0' ? node.left : node.right;
    if (!node) throw new Error('Corrupt bitstring: dead end in tree');
    if (node.isLeaf()) {
      out += node.char;
      node = root;
    }
  }
  return out;
}

function compressText(text) {
  const t0 = performance.now ? performance.now() : Date.now();
  const freqMap = buildFrequencyMap(text);
  const root = buildTree(freqMap);
  const codes = root ? generateCodes(root) : {};
  const bitstring = encodeText(text, codes);
  const { bytes, padding } = packBits(bitstring);
  const t1 = performance.now ? performance.now() : Date.now();

  const originalBits = [...text].length * 8;
  const compressedBits = bytes.length * 8;
  const ratio = originalBits === 0 ? 0 : (1 - bytes.length / [...text].length) * 100;
  const avgBits = [...text].length === 0 ? 0 : bitstring.length / [...text].length;

  return {
    freqMap, root, codes, bitstring,
    bytes, padding,
    originalBytes: [...text].length,
    compressedBytes: bytes.length,
    originalBits, compressedBits,
    ratio, avgBits,
    timeMs: t1 - t0,
  };
}

// Build a .huff Blob from text.
// If Huffman + header is bigger than original UTF-8, store raw instead.
function createHuffBlob(text, originalName = 'input.txt') {
  const enc = new TextEncoder();
  const origBytes = enc.encode(text);
  const { freqMap, bytes, padding } = compressText(text);
  const huffHeader = JSON.stringify({
    v: 2,
    raw: false,
    freq: freqMap,
    padding,
    originalName,
    originalChars: [...text].length,
  });
  const huffHeaderBytes = enc.encode(huffHeader);
  const huffTotal = 4 + huffHeaderBytes.length + bytes.length;

  if (huffTotal > origBytes.length) {
    const header = JSON.stringify({
      v: 2,
      raw: true,
      originalName,
      originalChars: [...text].length,
      reason: 'too-small',
    });
    const headerBytes = enc.encode(header);
    const out = new Uint8Array(4 + headerBytes.length + origBytes.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, headerBytes.length, false);
    out.set(headerBytes, 4);
    out.set(origBytes, 4 + headerBytes.length);
    return {
      blob: new Blob([out], { type: 'application/octet-stream' }),
      header, padding: 0, raw: true,
      reason: 'too-small',
      origSize: origBytes.length, huffSize: out.length,
    };
  }

  const out = new Uint8Array(4 + huffHeaderBytes.length + bytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, huffHeaderBytes.length, false);
  out.set(huffHeaderBytes, 4);
  out.set(bytes, 4 + huffHeaderBytes.length);
  return {
    blob: new Blob([out], { type: 'application/octet-stream' }),
    header: huffHeader, padding, raw: false,
    origSize: origBytes.length, huffSize: out.length,
  };
}

// Parse a .huff ArrayBuffer back to text (supports v1, v2 huffman + v2 raw)
function parseHuffBuffer(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 4) throw new Error('File too small, not a .huff file');
  const headerLen = view.getUint32(0, false);
  if (4 + headerLen > buffer.byteLength) throw new Error('Corrupt header length');
  const headerBytes = new Uint8Array(buffer, 4, headerLen);
  const header = JSON.parse(new TextDecoder().decode(headerBytes));
  const packed = new Uint8Array(buffer, 4 + headerLen);
  if (header.raw === true) {
    const text = new TextDecoder().decode(packed);
    return { text, header, bitstring: '', raw: true };
  }
  if (!header.freq || header.padding === undefined) throw new Error('Invalid .huff header');
  const root = buildTree(header.freq);
  const bitstring = unpackBits(packed, header.padding);
  const text = decodeBits(bitstring, root);
  return { text, header, bitstring, raw: false };
}

function treeToString(root) {
  if (!root) return '(empty)';
  const lines = [];
  function walk(node, prefix, isLeft) {
    if (!node) return;
    const ch = node.char === null ? '*' : (node.char === ' ' ? "' '" : (node.char === '\n' ? "'\\n'" : JSON.stringify(node.char)));
    lines.push(prefix + (isLeft === null ? '' : isLeft ? '├──0 ' : '└──1 ') + `${ch}:${node.freq}`);
    const childPrefix = prefix + (isLeft === null ? '' : isLeft ? '│   ' : '    ');
    if (!node.isLeaf()) {
      if (node.left) walk(node.left, childPrefix, true);
      if (node.right) walk(node.right, childPrefix, false);
    }
  }
  walk(root, '', null);
  return lines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HuffmanNode, buildFrequencyMap, buildTree, buildTreeWithSteps, nodeLabel, generateCodes,
    encodeText, packBits, unpackBits, decodeBits,
    compressText, createHuffBlob, parseHuffBuffer, treeToString,
  };
}
