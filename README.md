# Huffman Compressor

Compress and restore text files in your browser with Huffman coding — live stats, codebook, analysis charts, PDF support, zero uploads.

## Run
Open `index.html` in a browser. No build step (uses Tailwind + pdf.js/jsPDF CDNs).

- `js/heap.js` — `MinHeap` (`insert` / `extractMin`)
- `js/huffman.js` — frequency map, tree build, code generation, bit packing, `.huff` file format
- `js/app.js` — UI wiring, history (localStorage), downloads
- `js/viz.js` — analysis charts

## Features
- Compress text / text files (`.txt`, `.md`, `.csv`, `.json`, `.pdf` with in-browser text extraction) with live stats
- Download `.huff` (`[4-byte headerLen][header JSON][packed bytes]`), restore losslessly
- Small inputs are stored as-is (raw) so files never grow
- Session history, `Text as .pdf` export
