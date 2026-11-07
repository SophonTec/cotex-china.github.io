// 批次单证解析：工厂/仓库发来的装箱资料（Excel 或文字型 PDF），格式经常变。
// 做法：按“同义词”找表头列（REF、品名、每箱件数、箱数、数量、毛重、体积、单价…），
// 再从全文里找日期、客户号、订单号、提单号、港口、船名、柜号/封号。
(function (root) {
  const str = (v) => (v === null || v === undefined ? '' : String(v));
  const clean = (v) => str(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const num = (v) => {
    if (typeof v === 'number') return v;
    const s = str(v).replace(/[\s$€¥￥]|RMB|CNY|USD/gi, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (!s || !/^-?\d*\.?\d+$/.test(s)) return null;
    return Number(s);
  };

  // 列同义词（小写匹配）。顺序有意义：先匹配更具体的。
  const COLS = [
    ['no', /^(no\.?|n°|nº|item|序号|#)$/],
    ['ref', /^(ref\.?|réf|reference|référence|art\.?|article|item no\.?|code|货号|款号|型号|model)/],
    ['pcsPerCtn', /(pcs|qty|pieces|件|只|个)\s*\/\s*(ctn|carton|box|bag|箱|袋)|per\s*(ctn|carton)|每箱/],
    ['cartons', /^(cartons?|ctns?|bags?|packages?|pkgs?|colis|箱数|件数|袋数|total\s*ctns?)(?=$|[\s(（.:/])/],
    ['qty', /^(quantit|qty|quantity|total\s*(qty|pcs)|pcs|数量|总数)/],
    ['gw', /(p\.?\s*brut|g\.?\s*w|gross|毛重|poids\s*brut)/],
    ['nw', /(p\.?\s*net|n\.?\s*w|net\s*weight|净重)/],
    ['cbm', /(meas|cbm|volume|m3|m³|体积|立方)/],
    ['price', /(prix|unit\s*price|price|p\.?\s*u|单价)/],
    ['amount', /(montant|amount|金额|total\s*usd|total\s*amount)/],
    ['desc', /(d[ée]signation|description|desc|product|produit|nom|品名|名称|货物)/],
    ['unit', /^(unit[ée]?|unit|单位)$/],
  ];

  function matchCol(text) {
    const t = clean(text).toLowerCase();
    if (!t || t.length > 40) return null;
    for (const [k, re] of COLS) if (re.test(t)) return k;
    return null;
  }

  function findHeader(rows, need) {
    let best = null;
    rows.forEach((row, r) => {
      const map = {};
      (row || []).forEach((v, c) => { const k = matchCol(v); if (k && map[k] === undefined) map[k] = c; });
      const score = Object.keys(map).length + (map.desc !== undefined ? 1 : 0);
      if (need && map[need] === undefined) return;
      if (score >= 4 && (!best || score > best.score)) best = { r, map, score };
    });
    return best;
  }

  // 找“标签 → 值”：值在右边（同一行）或下方（同一列，中间可隔空行）。
  // PDF 里相邻两个标签有时会挤进同一格（如 "Port Chargement Port Déchargement"），这时按顺序往右取下方的值。
  const LABELS = /^(date|日期|no\.?\s*client|no\.?\s*cde|bill of lading|port\b|vessel|no\.?\s*containeur|type containeur|navire)/i;
  const LABEL_ANY = /(date|no\.?\s*client|no\.?\s*cde|bill of lading|port\s+(de\s+)?(chargement|d[ée]chargement)|vessel|no\.?\s*containeur|type containeur)/gi;
  const matchLabel = (t) => LABELS.test(t);
  function below(rows, r, c, isValue) {
    for (let k = 1; k <= 3; k++) {
      const v = clean((rows[r + k] || [])[c]);
      if (v) return isValue(v) && !matchLabel(v) ? v : '';
    }
    return '';
  }
  function labelValue(rows, re, isValue = () => true) {
    const loose = new RegExp(re.source.replace(/\^/g, ''), 'i');
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const t = clean(row[c]);
        if (!t) continue;
        if (re.test(t)) {
          const inline = t.replace(re, '').replace(/^[\s:：.]+/, '').trim();
          if (inline && !matchLabel(inline) && isValue(inline)) return inline;
          const right = clean(row[c + 1]);
          if (right && !matchLabel(right) && isValue(right)) return right;
          const b = below(rows, r, c, isValue);
          if (b) return b;
        } else if (matchLabel(t) && loose.test(t)) {
          // 同一格里有多个标签：数一数目标标签前面有几个
          const pos = t.search(loose);
          const n = (t.slice(0, pos).match(LABEL_ANY) || []).length;
          if (n) { const b = below(rows, r, c + n, isValue); if (b) return b; }
        }
      }
    }
    return '';
  }

  function excelDate(v) {
    if (typeof v === 'string' && /^\d{5}(\.\d+)?$/.test(v.trim())) v = Number(v);
    if (typeof v === 'number' && v > 30000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const s = str(v);
    let m = s.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return clean(s);
  }

  // PDF 还原的表格偶尔会把某列错开一格（表头在第 3 格、内容在第 2 格）。
  // 如果某列下面几乎都是空的，而旁边一格没有表头却有内容，就把这列挪过去。
  function fixShift(rows, head) {
    const map = { ...head.map };
    let end = rows.findIndex((r, i) => i > head.r && (r || []).some((v) => /^(total\b|合计|总计)/i.test(clean(v))));
    if (end < 0) end = head.r + 40;
    const data = rows.slice(head.r + 1, Math.min(end, head.r + 40)).filter((r) => r && r.filter((v) => clean(v)).length >= 3);
    if (!data.length) return map;
    const filled = (c) => data.filter((r) => clean(r[c])).length;
    const used = new Set(Object.values(map));
    Object.keys(map).forEach((k) => {
      const c = map[k], own = filled(c);
      if (own >= data.length / 2) return;
      const cand = [c - 1, c + 1].filter((x) => x >= 0 && !used.has(x)).map((x) => [x, filled(x)]).sort((a, b) => b[1] - a[1])[0];
      if (cand && cand[1] >= data.length / 2 && cand[1] > own) { used.delete(c); used.add(cand[0]); map[k] = cand[0]; }
    });
    return map;
  }

  // 币种：文件里出现 RMB / CNY / 人民币 / ¥ 就是人民币，出现 USD / $ 就是美元
  function detectCurrency(text) {
    const rmb = (text.match(/\b(RMB|CNY)\b|人民币|[¥￥]/gi) || []).length;
    const usd = (text.match(/\bUSD\b|US\$|\$|美元|美金/gi) || []).length;
    if (rmb > usd) return 'RMB';
    if (usd) return 'USD';
    return '';
  }

  function parse(rows, ctx) {
    const warnings = [];
    const warn = (level, msg) => warnings.push({ level, msg });
    const doc = {
      fileName: ctx.fileName,
      date: '', clientNo: '', orderNo: '',
      blNo: '', loadingPort: '', destinationPort: '', vessel: '', containerType: '',
      nature: '', comments: '',
      containers: [], items: [],
      fees: defaultFees(),
    };

    // ---- 抬头信息 ----
    const rawDate = labelValue(rows, /^(date\b|日期|出货日期)/i, (v) => /\d/.test(v));
    doc.date = excelDate(rawDate) || '';
    doc.clientNo = labelValue(rows, /^no\.?\s*client|^client\s*no|^客户号/i);
    doc.orderNo = labelValue(rows, /^no\.?\s*cde|^order\s*no|^commande|^订单号|^p\.?o\.?\s*no/i);
    doc.blNo = labelValue(rows, /^(bill of lading|b\s*\/\s*l\s*no\.?|提单号)/i, (v) => /[A-Z0-9]{6,}/i.test(v));
    doc.loadingPort = labelValue(rows, /^(port\s*(de\s*)?chargement|port of loading|loading port|起运港|装货港)/i);
    doc.destinationPort = labelValue(rows, /^(port\s*(de\s*)?d[ée]chargement|port of discharge|destination port|目的港)/i);
    doc.vessel = labelValue(rows, /^(vessel|navire|船名)/i);
    doc.containerType = labelValue(rows, /^(type\s*containeur|container\s*type|柜型)/i);
    const fullText = rows.map((r) => (r || []).map(clean).filter(Boolean).join('   ')).join('\n');
    let m;
    doc.currency = detectCurrency(fullText) || 'USD';
    if ((m = fullText.match(/Nature des marchandises\s*:?\s*(.+)/i))) doc.nature = m[1].trim();

    // ---- 柜号 ----
    const { ship } = root.DocShipping.parseShipping(fullText);
    doc.containers = ship.containers.map(({ no, seal, type, packages, unit, weight, cbm }) => ({ no, seal, type: type || root.DocShipping.normType(doc.containerType), packages, unit, weight, cbm }));
    if (!doc.blNo && ship.blNo) doc.blNo = ship.blNo;

    // ---- 明细 ----
    const head = findHeader(rows);
    if (!head) {
      warn('error', '没找到明细表头（需要有 品名/DESIGNATION、箱数/CARTONS、数量/QTY 等列名）');
      return { doc, warnings };
    }
    const col = fixShift(rows, head);
    const get = (row, k) => (col[k] === undefined ? null : row[col[k]]);
    let containerIdx = 0, blank = 0, srcTotal = null;
    for (let r = head.r + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const texts = row.map(clean).filter(Boolean);
      if (!texts.length) { if (++blank >= 3 && doc.items.length) break; continue; }
      blank = 0;
      const line = texts.join(' ');
      if (/^container\s*no\.?\s*\d+/i.test(line) || /\b[A-Z]{4}\d{7}\b/.test(line) && !num(get(row, 'qty'))) {
        const mm = line.match(/container\s*no\.?\s*(\d+)/i);
        containerIdx = mm ? Number(mm[1]) - 1 : containerIdx + 1;
        continue;
      }
      if (texts.some((t) => /^sub\s*-?total\b|^小计/i.test(t))) continue;
      if (texts.some((t) => /^(total\b|合计|总计)/i.test(t))) { srcTotal = { cartons: num(get(row, 'cartons')), qty: num(get(row, 'qty')) }; break; }
      if (texts.some((t) => matchCol(t) === 'desc')) continue; // 跨页重复表头
      const it = {
        ref: clean(get(row, 'ref')),
        desc: clean(get(row, 'desc')),
        unit: clean(get(row, 'unit')),
        pcsPerCtn: num(get(row, 'pcsPerCtn')),
        cartons: num(get(row, 'cartons')),
        qty: num(get(row, 'qty')),
        gw: num(get(row, 'gw')),
        nw: num(get(row, 'nw')),
        cbm: num(get(row, 'cbm')),
        price: num(get(row, 'price')),
        container: containerIdx,
      };
      if (!it.desc && !it.ref && it.qty === null && it.cartons === null) continue;
      if (it.qty === null && it.pcsPerCtn !== null && it.cartons !== null) it.qty = it.pcsPerCtn * it.cartons;
      doc.items.push(it);
    }
    if (!doc.items.length) warn('error', '没有读到任何明细行');
    if (srcTotal) {
      const sum = (k) => doc.items.reduce((a, it) => a + (Number(it[k]) || 0), 0);
      [['cartons', '箱数'], ['qty', '数量']].forEach(([k, label]) => {
        if (srcTotal[k] !== null && Math.abs(srcTotal[k] - sum(k)) > 0.01) warn('error', `原文件合计${label} ${srcTotal[k]}，读到的明细相加 ${sum(k)}，可能漏行，请核对`);
      });
    } else if (doc.items.length) warn('info', '原文件没有 TOTAL 合计行，无法自动比对是否漏行');
    if (ctx.source === 'pdf') warn('info', '来自 PDF：已按版面位置还原表格，请核对明细');
    return { doc, warnings };
  }

  // 发票底部的金额行（可改名、删除、增加）：
  //   比例% 有值 = 货款 × 比例（如佣金 1%）；金额有值 = 固定金额（如物流费）；两者都空 = 自动累计（货款 + 上面所有费用）
  function defaultFees() {
    return [
      { label: 'MARCHANDISES', rate: null, amount: null },
      { label: 'COMMISSIONS', rate: 1, amount: null },
      { label: 'FRAIS LOGISTIQUES', rate: null, amount: 0 },
      { label: 'AUTRES', rate: null, amount: 0 },
      { label: 'TOTAL À PAYER en USD', rate: null, amount: null },
    ];
  }

  function totals(doc) {
    const s = (k) => doc.items.reduce((a, it) => a + (Number(it[k]) || 0), 0);
    const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
    const lines = doc.items.map((it) => r((Number(it.qty) || 0) * (Number(it.price) || 0), 2));
    const goods = r(lines.reduce((a, b) => a + b, 0), 2);
    const hasN = (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
    if (!Array.isArray(doc.fees)) doc.fees = defaultFees();
    let run = goods;
    const fees = doc.fees.map((f) => {
      if (hasN(f.amount)) { const v = r(Number(f.amount), 2); run = r(run + v, 2); return { label: f.label || '', value: v, kind: 'fixed' }; }
      if (hasN(f.rate)) { const v = r(goods * Number(f.rate) / 100, 2); run = r(run + v, 2); return { label: f.label || '', value: v, kind: 'rate', rate: Number(f.rate) }; }
      return { label: f.label || '', value: run, kind: 'auto' };
    });
    const cw = doc.containers.reduce((a, c) => a + (Number(c.weight) || 0), 0);
    const cc = doc.containers.reduce((a, c) => a + (Number(c.cbm) || 0), 0);
    return {
      cartons: s('cartons'), qty: s('qty'),
      gw: r(s('gw') || cw, 3), cbm: r(s('cbm') || cc, 3),
      gwFromContainers: !s('gw') && !!cw, cbmFromContainers: !s('cbm') && !!cc,
      lines, goods, fees, total: run,
    };
  }

  root.BatchParser = { parse, totals, findHeader, matchCol, defaultFees, detectCurrency };
})(typeof window !== 'undefined' ? window : globalThis);
