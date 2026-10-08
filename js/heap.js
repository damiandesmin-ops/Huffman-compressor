class MinHeap {
  constructor(compareFn) {
    this.heap = [];
    // Default: min-heap by freq
    this.compare = compareFn || ((a, b) => a.freq - b.freq);
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  insert(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return min;
  }

  peek() {
    return this.heap[0] || null;
  }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i) { return 2 * i + 1; }
  _right(i) { return 2 * i + 2; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = this._parent(i);
      if (this.compare(this.heap[i], this.heap[p]) < 0) {
        [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]];
        i = p;
      } else break;
    }
  }

  _bubbleDown(i) {
    const n = this.heap.length;
    while (true) {
      const l = this._left(i);
      const r = this._right(i);
      let smallest = i;
      if (l < n && this.compare(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.compare(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
}

// Export for Node / browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MinHeap };
}
