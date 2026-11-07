// 读取客户发来的 PDF（文字型），按坐标还原成“行 × 列”表格，再交给同一个解析器。
// 扫描件/图片 PDF 没有文字层，无法识别，会提示改用 Excel 或文字版 PDF。
(function (root) {
  const Y_TOL = 3.5; // 同一行的纵向容差（pt）
  const MERGE_GAP = 14; // 表格外，两段文字间距小于此值视为同一句

  // items: [{ str, x, y, w, page }]（y 为自上而下的累计坐标）
  function itemsToRows(items) {
    const clean = items
      .map((it) => ({ ...it, str: it.str.replace(/ /g, ' ') }))
      .filter((it) => it.str.trim() !== '');
    clean.sort((a, b) => a.y - b.y || a.x - b.x);

    // 合并同一行里紧挨着的碎片（pdf 常把一个单词拆开）
    const joinItems = (arr, gapMax) => {
      const out = [];
      for (const it of arr) {
        const prev = out[out.length - 1];
        const gap = prev ? it.x - (prev.x + prev.w) : Infinity;
        if (prev && gap < gapMax) {
          prev.str += (gap > 0.9 && !/\s$/.test(prev.str) && !/^\s/.test(it.str) ? ' ' : '') + it.str;
          prev.w = Math.max(prev.w, it.x + it.w - prev.x);
        } else out.push({ str: it.str, x: it.x, w: it.w });
      }
      return out.map((c) => ({ ...c, str: c.str.replace(/\s+/g, ' ').trim() }));
    };

    // 1) 分行
    let lines = [];
    for (const it of clean) {
      const last = lines[lines.length - 1];
      if (last && last.page === it.page && Math.abs(it.y - last.y) <= Y_TOL) last.items.push(it);
      else lines.push({ y: it.y, page: it.page, items: [it] });
    }
    lines.forEach((l) => {
      l.items.sort((a, b) => a.x - b.x);
      l.text = joinItems(l.items, 1.5).map((c) => c.str).join(' ').replace(/\s+/g, ' ').trim();
    });
    // 去掉页码、以及第 2 页起重复打印的页眉（与第 1 页表头以上内容相同的行）
    lines = lines.filter((l) => !/^(page\s*)?\d+\s*(\/|of)\s*\d+$/i.test(l.text) && !/^page\s*\d+$/i.test(l.text));
    const isHead = (l) => /d[ée]\s?signation|description/i.test(l.text);
    const firstHead = lines.findIndex(isHead);
    if (firstHead >= 0) {
      const top = new Set(lines.slice(0, firstHead).map((l) => l.text));
      lines = lines.filter((l, i) => l.page === lines[firstHead].page || i <= firstHead || !top.has(l.text));
    }

    // 表头可能分两三行打印（如 "Prix Unitaire" / "(USD)"），把紧挨着、且不含数字的行并入表头
    let h0 = lines.findIndex(isHead);
    if (h0 >= 0) {
      const near = (l) => l && l.page === lines[h0].page && Math.abs(l.y - lines[h0].y) < 14 && !/\d/.test(l.text);
      while (near(lines[h0 - 1])) { lines[h0].items.push(...lines[h0 - 1].items); lines.splice(h0 - 1, 1); h0--; }
      while (near(lines[h0 + 1])) { lines[h0].items.push(...lines[h0 + 1].items); lines.splice(h0 + 1, 1); }
      lines[h0].items.sort((a, b) => a.x - b.x);
    }

    // 2) 表格区域（表头 → TOTAL），用所有表格内文字的横向覆盖范围求出“列”
    const headIdx = lines.findIndex(isHead);
    let totalIdx = lines.findIndex((l, i) => i > headIdx && /(^|\s)total\b/i.test(l.text));
    if (totalIdx < 0) totalIdx = lines.length;
    let cols = []; // [{s,e}]
    if (headIdx >= 0) {
      // 只用表头行和“像产品行”的行（至少两个数字）来求列，避免运费说明等长句把列连成一片
      const isNum = (t) => /^[$€]?\s*-?[\d.,]+\s*%?$/.test(t.trim());
      const itemLike = (l) => l.items.filter((it) => isNum(it.str)).length >= 2;
      const iv = [];
      for (let i = headIdx; i < totalIdx; i++) {
        if (i !== headIdx && !itemLike(lines[i])) continue;
        for (const it of lines[i].items) if (it.str.trim()) iv.push([it.x, it.x + Math.max(it.w, 1)]);
      }
      iv.sort((a, b) => a[0] - b[0]);
      for (const [s0, e0] of iv) {
        const last = cols[cols.length - 1];
        if (last && s0 <= last.e + 2) last.e = Math.max(last.e, e0);
        else cols.push({ s: s0, e: e0 });
      }
      // 一列里如果包含两个以上表头词（如 "Quantité" "Unité" 挨得太近），按表头拆开
      const hc = joinItems(lines[headIdx].items, 4);
      const split = [];
      for (const c of cols) {
        const inside = hc.filter((h) => h.x + h.w / 2 >= c.s && h.x + h.w / 2 <= c.e);
        if (inside.length < 2) { split.push(c); continue; }
        let s0 = c.s;
        for (let k = 0; k < inside.length - 1; k++) {
          const cut = (inside[k].x + inside[k].w + inside[k + 1].x) / 2;
          split.push({ s: s0, e: cut }); s0 = cut + 0.01;
        }
        split.push({ s: s0, e: c.e });
      }
      cols = split;
    }
    const colOfX = (x) => {
      if (!cols.length) return 0;
      let k = 0;
      for (let i = 0; i < cols.length; i++) if (x >= cols[i].s - 2) k = i;
      return k;
    };

    // 3) 生成二维数组
    return lines.map((l, i) => {
      const inTable = headIdx >= 0 && i >= headIdx && i < totalIdx;
      const row = [];
      if (inTable) {
        const byCol = {};
        for (const it of l.items) (byCol[colOfX(it.x + Math.min(it.w, 4) / 2)] ||= []).push(it);
        for (const k of Object.keys(byCol)) row[+k] = joinItems(byCol[k], 1e9).map((c) => c.str).join(' ');
      } else {
        for (const c of joinItems(l.items, MERGE_GAP)) {
          let k = colOfX(c.x + c.w / 2);
          while (row[k] !== undefined && row[k] !== null) k++;
          row[k] = c.str;
        }
      }
      for (let k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = null;
      return row;
    });
  }

  async function pdfToRows(arrayBuffer) {
    const lib = root.pdfjsLib;
    if (!lib) throw new Error('PDF 组件没有加载');
    // 已通过 <script> 加载 pdf.worker.min.js，pdf.js 会在页面内直接解析（双击本地打开也能用）
    const doc = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const items = [];
    let offset = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const h = page.getViewport({ scale: 1 }).height;
      const tc = await page.getTextContent();
      for (const it of tc.items) {
        if (!it.str) continue;
        items.push({ str: it.str, x: it.transform[4], y: offset + (h - it.transform[5]), w: it.width, page: p });
      }
      offset += h + 50;
    }
    return { rows: itemsToRows(items), textCount: items.filter((i) => i.str.trim()).length, pages: doc.numPages };
  }

  root.PIPdfReader = { pdfToRows, itemsToRows };
})(typeof window !== 'undefined' ? window : globalThis);
