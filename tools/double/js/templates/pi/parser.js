// 解析客户发来的 PI（Excel）→ 结构化数据 + 校验提示
// 按“关键字”定位，不依赖固定行号，所以客户文件行数变化（产品多/少）也能正确识别。
(function (root) {
  const str = (v) => (v === null || v === undefined ? '' : String(v));
  const clean = (s) => str(s).replace(/ /g, ' ').replace(/\s+$/g, '').replace(/^\s+/g, '');
  const num = (v) => {
    if (typeof v === 'number') return v;
    const s = str(v).replace(/[,\s$]/g, '');
    if (s === '') return NaN;
    return Number(s);
  };
  // "NINGBO,CHINA" → "NINGBO, CHINA"；"SKIKDA ,ALGERIA" → "SKIKDA, ALGERIA"
  const fixComma = (s) => clean(s).replace(/\s*[,，]\s*/g, ', ');

  function sheetRows(ws) {
    const XLSX = root.XLSX;
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  }

  function findRow(rows, re, from = 0) {
    for (let r = from; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const m = str(row[c]).match(re);
        if (m) return { r, c, m, text: str(row[c]) };
      }
    }
    return null;
  }

  function rowTexts(row) {
    return (row || []).map((v, c) => ({ c, t: clean(v) })).filter((x) => x.t !== '');
  }

  function parseDate(s) {
    const m = str(s).match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const m2 = str(s).match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    return clean(s);
  }

  function applyReplacements(s, cfg) {
    let out = s;
    for (const [re, to] of (cfg && cfg.replacements) || []) out = out.replace(re, to);
    return out;
  }

  function parseWorkbook(wb, fileName, cfg) {
    return parseRows(sheetRows(wb.Sheets[wb.SheetNames[0]]), fileName, cfg);
  }

  // rows：二维数组（Excel 工作表或 PDF 还原出的表格）
  function parseRows(rows, fileName, cfg) {
    const warnings = []; // {level:'error'|'warn'|'info', msg}
    const warn = (level, msg) => warnings.push({ level, msg });
    // 运费行：如 "SEA FREIGHT USD: 2000" / "FRET MARITIME" / "FREIGHT" + 金额单元格
    let freightFound = false;
    const readFreight = (texts) => {
      const label = texts.map((x) => x.t).join(' ');
      if (!/FREIGHT|\bFRET\b|SHIPPING\s+COST/i.test(label)) return false;
      let v = NaN;
      const numCell = [...texts].reverse().find((x) => !isNaN(num(x.t)));
      if (numCell) v = num(numCell.t);
      else { const m = label.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:USD)?\s*$/i); if (m) v = num(m[1]); }
      if (isNaN(v)) return false;
      pi.seaFreight = v; freightFound = true;
      return true;
    };

    const pi = {
      fileName,
      invoiceNo: '',
      date: '',
      clientLines: [],
      bankLines: [],
      items: [],
      customerTotal: null,
      customerGrandTotal: null,
      customerTotalLabel: '',
      incoterm: '',
      seaFreight: (cfg && cfg.defaultSeaFreight) || 0,
      origin: '',
      loadingPort: '',
      destinationPort: '',
      payment: '',
      shipment: '',
      documents: [],
      otherTerms: [],
    };

    // ---- 发票号、日期 ----
    const noHit = findRow(rows, /^\s*(?:P\.?I\.?\s*)?NO\s*[:：.]\s*(\S.*)$/i);
    // 标签和值分在两个单元格的情况（如 "INVOICE NO:" | "106012026"）
    const nextCell = (re) => {
      const h = findRow(rows, re);
      if (!h) return null;
      const row = rows[h.r];
      for (let c = h.c + 1; c < row.length; c++) if (clean(row[c])) return { r: h.r, c, m: [null, clean(row[c])] };
      return null;
    };
    const noHit2 = noHit || nextCell(/^\s*(?:INVOICE|P\.?I\.?)?\s*N[O°]\.?\s*[:：]?\s*$/i);
    if (noHit2) pi.invoiceNo = clean(noHit2.m[1]);
    else warn('error', '没找到发票号（"NO: xxx"），请手动填写');
    const dateHit = findRow(rows, /DATE\s*[:：]\s*(.+)$/i) || nextCell(/^\s*(?:INVOICE\s*)?DATE\s*[:：]?\s*$/i);
    if (dateHit) pi.date = parseDate(dateHit.m[1]);
    else warn('error', '没找到日期（"DATE: xxx"），请手动填写');

    // ---- 产品表头 ----
    const head = findRow(rows, /d[ée]signation|description/i);
    if (!head) {
      warn('error', '没找到产品表头（Désignation），无法读取产品明细');
      return { pi, warnings };
    }
    const headRow = rows[head.r];
    const col = { no: -1, desc: head.c, qty: -1, unit: -1, price: -1, amount: -1 };
    headRow.forEach((v, c) => {
      const t = str(v).toLowerCase();
      if (/^\s*n\s*[°o]?\s*\.?\s*$/.test(t) || /^n°/.test(t)) col.no = c;
      else if (/quantit|qty/.test(t)) col.qty = c;
      else if (/unit[ée]?\s*$/.test(t) && !/p-?\s*unit|prix/.test(t)) col.unit = c;
      else if (/p-?\s*unit|prix|price/.test(t)) col.price = c;
      else if (/montant|amount/.test(t)) col.amount = c;
    });
    if (col.qty < 0 || col.price < 0) warn('error', '表头里没找到"数量"或"单价"列');

    // ---- 客户信息 / 客户银行（发票号行 与 表头 之间）----
    // 有「INFORMATIONS DE CLIENT / CLIENT / CONSIGNEE / BUYER」这类标题时，从标题下一行开始读；
    // 同一行右边的「INFORMATIONS DE BANQUE / BANK」标题决定银行信息所在的列。
    // 公司自己的抬头（公司名、地址、电话、单据标题、发票号/日期）一律跳过，这样用公司版 PI 转 CI/PL/COC 也不会乱。
    const CLIENT_LABEL = /^\s*(informations?\s+(de\s+|du\s+)?client|client\s*(information|info)?\s*[:：]?$|consignee|buyer|acheteur|importateur|messrs)/i;
    const BANK_LABEL = /^\s*(informations?\s+(de\s+la\s+|de\s+)?banque|bank\s*(information|info|details)?\s*[:：]?$|banque\s*[:：]?$)/i;
    const labelHit = findRow(rows.slice(0, head.r), CLIENT_LABEL);
    const firstNo = noHit || noHit2;
    const blockStart = labelHit ? labelHit.r : (firstNo ? firstNo.r + 1 : 0);
    const labelBank = labelHit ? rowTexts(rows[labelHit.r]).find((x) => BANK_LABEL.test(x.t)) : null;
    const bankHit = labelBank ? { r: labelHit.r, c: labelBank.c } : findRow(rows.slice(0, head.r), /^\s*(bank|banque)\b/i, blockStart);
    const bankCol = bankHit ? bankHit.c : 3;
    const own = [];
    if (cfg && cfg.company) own.push(cfg.company.name, ...cfg.company.lines);
    const ownNorm = own.map((t) => clean(t).toUpperCase().replace(/\s+/g, ''));
    const isOwn = (t) => {
      const u = clean(t).toUpperCase().replace(/\s+/g, '');
      if (!u) return true;
      if (ownNorm.some((o) => o && (o === u || (u.length > 12 && (o.includes(u) || u.includes(o)))))) return true;
      return /^(PROFORMA INVOICE|COMMERCIAL INVOICE|PACKING LIST|CERTIFICATE OF CONFORMITY|FACTURE( PROFORMA)?|\(ORIGINAL\)|INVOICE\s*(NO|DATE)\s*[:：]?)$/i.test(clean(t));
    };
    for (let r = blockStart; r < head.r; r++) {
      const tx = rowTexts(rows[r]).filter((x) => !/DATE\s*[:：]/i.test(x.t) && !CLIENT_LABEL.test(x.t) && !BANK_LABEL.test(x.t) && !isOwn(x.t)
        && !(firstNo && r === firstNo.r) && clean(x.t) !== pi.invoiceNo && clean(x.t) !== pi.date);
      tx.forEach(({ c, t }, k) => {
        // 同一行有两段文字时，右边那段属于银行信息
        const isBank = bankHit && r >= bankHit.r && (c >= bankCol || (tx.length >= 2 && k === tx.length - 1));
        (isBank ? pi.bankLines : pi.clientLines).push(t);
      });
    }
    if (!pi.clientLines.length) warn('error', '没读到客户信息');
    if (!pi.bankLines.length) warn('warn', '没读到客户银行信息');

    // ---- 产品明细（表头之后，直到 TOTAL 行）----
    let r = head.r + 1;
    let totalRow = -1;
    const numericUnits = [];
    for (; r < rows.length; r++) {
      const row = rows[r] || [];
      const texts = rowTexts(row);
      if (texts.some((x) => /^total\b/i.test(x.t))) { totalRow = r; break; }
      if (!texts.length) continue;
      if (texts.some((x) => /d[ée]signation|description/i.test(x.t))) continue; // PDF 跨页重复表头
      if (readFreight(texts)) continue;
      const desc = clean(row[col.desc]);
      // 品名换行（如 PDF 里 "... 1500" 下一行 "mm"）：只有品名、没有数量单价的行并入上一项
      const others = texts.filter((x) => x.c !== col.desc);
      if (desc && !others.length && pi.items.length && col.qty >= 0) {
        const prev = pi.items[pi.items.length - 1];
        prev.desc = (prev.desc + ' ' + desc).trim();
        continue;
      }
      const qty = num(row[col.qty]);
      const price = num(row[col.price]);
      const unit = col.unit >= 0 ? clean(row[col.unit]) : '';
      const origNo = col.no >= 0 ? row[col.no] : null;
      const item = { desc, qty: isNaN(qty) ? null : qty, unit, price: isNaN(price) ? null : price, origNo, srcRow: r + 1 };
      pi.items.push(item);
      const where = `第 ${pi.items.length} 项（Excel 第 ${r + 1} 行）`;
      if (!desc) warn('error', `${where}缺少品名`);
      if (item.qty === null) warn('error', `${where}数量不是数字："${str(row[col.qty])}"`);
      if (item.price === null) warn('error', `${where}单价不是数字："${str(row[col.price])}"`);
      if (!unit) warn('warn', `${where}缺少单位`);
      else if (/^[\d.,\s]+$/.test(unit)) numericUnits.push(pi.items.length);
    }
    if (totalRow < 0) warn('error', '没找到 TOTAL 行，产品明细可能读不全');
    if (!pi.items.length) warn('error', '没有读到任何产品');

    if (numericUnits.length)
      warn('warn', `有 ${numericUnits.length} 项的单位是数字（第 ${numericUnits.slice(0, 5).join('、')}${numericUnits.length > 5 ? ' 等' : ''} 项），客户文件可能把数量填进了单位列，请改成 PCS / SET 等`);
    // 客户原序号是否连续
    const badNo = [];
    pi.items.forEach((it, i) => {
      if (it.origNo !== null && it.origNo !== '' && num(it.origNo) !== i + 1) badNo.push(`第 ${i + 1} 项原为 "${it.origNo}"`);
      else if ((it.origNo === null || it.origNo === '') && i > 0) badNo.push(`第 ${i + 1} 项原序号为空`);
    });
    if (badNo.length) warn('warn', `客户原文件序号不连续（${badNo.slice(0, 3).join('，')}${badNo.length > 3 ? ` 等 ${badNo.length} 处` : ''}），已自动重新编号为 1–${pi.items.length}`);

    // ---- 合计行：金额 + 贸易术语 ----
    if (totalRow >= 0) {
      const texts = rowTexts(rows[totalRow]);
      pi.customerTotalLabel = texts.filter((x) => isNaN(num(x.t))).map((x) => x.t).join(' ');
      const numCell = texts.find((x) => !isNaN(num(x.t)));
      if (numCell) pi.customerTotal = num(numCell.t);
      const m = pi.customerTotalLabel.match(/\b(FOB|CFR|CNF|CIF|EXW|FCA|CPT|CIP|DAP|DDP)\b/i);
      if (m) pi.incoterm = m[1].toUpperCase();
    }

    // ---- 条款（合计行之后，直到 ACCOUNT DETAILS）----
    const accHit = findRow(rows, /ACCOUNT\s+DETAILS|DETAIL\s+DE\s+COMPTE/i, totalRow >= 0 ? totalRow + 1 : 0);
    const termsEnd = accHit ? accHit.r : rows.length;
    for (let i = (totalRow >= 0 ? totalRow + 1 : head.r + 1); i < termsEnd; i++) {
      const rt = rowTexts(rows[i]);
      if (readFreight(rt)) continue;
      if (rt.some((x) => /^total\b/i.test(x.t))) {
        const nc = rt.find((x) => !isNaN(num(x.t)));
        if (nc) pi.customerGrandTotal = num(nc.t);
        // 最终合计行的贸易术语（如 TOTAL CFR VALUE ...）优先于第一行 Total FOB
        const lab = rt.filter((x) => isNaN(num(x.t))).map((x) => x.t).join(' ');
        const mm = lab.match(/\b(FOB|CFR|CNF|CIF|EXW|FCA|CPT|CIP|DAP|DDP)\b/i);
        if (mm) { pi.incoterm = mm[1].toUpperCase(); pi.customerTotalLabel = lab; }
        continue;
      }
      for (const { t } of rt) {
        let m;
        if ((m = t.match(/PAYS?\s*D['’]\s*ORIGINE\s*[:：]\s*(.+)/i))) pi.origin = clean(m[1]);
        else if ((m = t.match(/LOAD(?:ING)?\s*PORT\s*[:：]\s*(?:FROM\s+)?(.+?)\s+TO\s+(.+)/i))) {
          pi.loadingPort = fixComma(m[1]);
          pi.destinationPort = fixComma(m[2]);
        } else if ((m = t.match(/LOAD(?:ING)?\s*PORT\s*[:：]\s*(.+)/i))) pi.loadingPort = fixComma(m[1].replace(/^FROM\s+/i, ''));
        else if ((m = t.match(/(?:DESTINATION|DISCHARGE)\s*PORT\s*[:：]\s*(.+)/i))) pi.destinationPort = fixComma(m[1]);
        else if ((m = t.match(/MODE\s+DE\s+PAIEMENT\s*[:：]\s*(.+)/i))) pi.payment = applyReplacements(clean(m[1]), cfg);
        else if ((m = t.match(/SHIPMENT\s*[:：]\s*(.+)/i))) pi.shipment = applyReplacements(clean(m[1]).replace(/(\d)\s*(DAYS)/i, '$1 $2'), cfg);
        else if (/^CERTIFICATE/i.test(t)) {
          pi.documents.push(clean(t.replace(/\s*[:：]\s*CHINA\s*$/i, '').replace(/\s*[:：]\s*/g, ' ')));
        } else if (/^DOCUMENTS?\s*[:：]?\s*$/i.test(t)) { /* 标题，忽略 */ }
        else pi.otherTerms.push(t);
      }
    }
    pi.freightFromFile = freightFound;
    pi.summary = defaultSummary(pi, freightFound);
    if (!freightFound) warn('info', '客户文件里没有写海运费，金额汇总只写一行合计。需要的话可在「金额汇总」里加行、改名');
    if (!pi.origin) warn('warn', '没找到原产地（PAYS D\'ORIGINE）');
    if (!pi.loadingPort) warn('error', '没找到装货港（LOAD PORT）');
    if (!pi.destinationPort) warn('error', '没找到目的港（... TO 目的港）');
    if (!pi.payment) warn('warn', '没找到付款方式（MODE DE PAIEMENT）');
    if (!pi.shipment) warn('warn', '没找到装运期（SHIPMENT）');
    pi.otherTerms.forEach((t) => warn('warn', `有一条条款无法自动归类，已原样保留在“其他条款”里：${t}`));

    // ---- 收款账户：与公司固定账户比对 ----
    if (accHit && cfg && cfg.beneficiary) {
      const accText = [];
      for (let i = accHit.r + 1; i < rows.length; i++) rowTexts(rows[i]).forEach((x) => accText.push(x.t));
      const joined = accText.join(' ').replace(/\s+/g, '');
      const b = cfg.beneficiary;
      [['账号', b.accountNo], ['收款行 SWIFT', b.swift], ['中转行 SWIFT', b.intermediarySwift]].forEach(([k, v]) => {
        if (v && !joined.includes(v.replace(/\s+/g, ''))) warn('warn', `客户文件里的${k}与公司固定账户（${v}）不一致，PDF 使用公司固定账户，请核对`);
      });
    }

    return { pi, warnings };
  }

  // 金额汇总行（单据底部合计框）：每行 { label, amount }。
  // amount 留空 = 自动累计（产品金额 + 上面所有填了金额的行），填了数字 = 固定金额（如海运费）。
  function defaultSummary(pi, withFreight) {
    const dest = destCity(pi);
    const cfr = `TOTAL CFR VALUE ${dest} en USD`.replace(/\s+/g, ' ');
    if (!withFreight) return [{ label: cfr, amount: null }];
    return [
      { label: 'Total FOB en USD', amount: null },
      { label: 'SEA FREIGHT en USD', amount: Number(pi.seaFreight) || 0 },
      { label: cfr, amount: null },
    ];
  }

  // 计算金额、核对总额（每次编辑后都会重新调用）
  function computeTotals(pi) {
    const round2 = (x) => Math.round(x * 100) / 100;
    const has = (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
    const lines = pi.items.map((it) => round2((Number(it.qty) || 0) * (Number(it.price) || 0)));
    const fob = round2(lines.reduce((a, b) => a + b, 0));
    if (!Array.isArray(pi.summary)) pi.summary = defaultSummary(pi, !!Number(pi.seaFreight));
    let run = fob;
    const summary = pi.summary.map((s) => {
      if (has(s.amount)) { const v = round2(Number(s.amount)); run = round2(run + v); return { label: s.label || '', value: v, auto: false }; }
      return { label: s.label || '', value: run, auto: true };
    });
    return { lines, fob, freight: round2(run - fob), summary, total: run };
  }

  function validate(pi) {
    const out = [];
    const t = computeTotals(pi);
    if (!pi.invoiceNo) out.push({ level: 'error', msg: '发票号为空' });
    if (!pi.date) out.push({ level: 'error', msg: '日期为空' });
    pi.items.forEach((it, i) => {
      if (!it.desc) out.push({ level: 'error', msg: `第 ${i + 1} 项品名为空` });
      if (it.qty === null || it.qty === '' || isNaN(Number(it.qty))) out.push({ level: 'error', msg: `第 ${i + 1} 项数量无效` });
      if (it.price === null || it.price === '' || isNaN(Number(it.price))) out.push({ level: 'error', msg: `第 ${i + 1} 项单价无效` });
    });
    const near = (a, b) => Math.abs(a - b) <= 0.005;
    if (pi.customerGrandTotal != null && !isNaN(pi.customerGrandTotal) && !near(pi.customerGrandTotal, t.total))
      out.push({ level: 'error', msg: `含运费总额 ${t.total.toFixed(2)} 与客户文件最终 TOTAL ${Number(pi.customerGrandTotal).toFixed(2)} 不一致，请核对运费` });
    if (pi.customerTotal !== null && !isNaN(pi.customerTotal) && !near(pi.customerTotal, t.fob) && !near(pi.customerTotal, t.total) && !t.summary.some((s) => near(s.value, pi.customerTotal)))
      out.push({ level: 'error', msg: `产品金额合计 ${t.fob.toFixed(2)}、单据总额 ${t.total.toFixed(2)} 都与客户文件 TOTAL ${Number(pi.customerTotal).toFixed(2)} 对不上，可能漏行、数字有误或少了运费行` });
    if (!t.summary.length) out.push({ level: 'error', msg: '金额汇总至少要有一行（如 TOTAL）' });
    t.summary.forEach((s, i) => { if (!String(s.label).trim()) out.push({ level: 'error', msg: `金额汇总第 ${i + 1} 行没有名称` }); });
    const last = t.summary[t.summary.length - 1];
    if (last && !last.auto) out.push({ level: 'warn', msg: `金额汇总最后一行「${last.label}」是固定金额，通常最后一行应留空自动算总额` });
    const lastLabel = last ? String(last.label).toUpperCase() : '';
    const m = lastLabel.match(/\b(FOB|CFR|CNF|CIF|EXW|FCA|CPT|CIP|DAP|DDP)\b/);
    if (pi.incoterm && m && m[1] !== pi.incoterm && !(['CFR', 'CNF'].includes(m[1]) && ['CFR', 'CNF'].includes(pi.incoterm)))
      out.push({ level: 'warn', msg: `客户文件的合计行是 ${pi.incoterm}（"${pi.customerTotalLabel}"），这里最后一行写的是「${last.label}」，请确认` });
    return out;
  }

  function destCity(pi) {
    return clean(str(pi.destinationPort).split(/[,，]/)[0]).toUpperCase();
  }

  root.PIParser = { parseWorkbook, parseRows, computeTotals, validate, destCity, defaultSummary };
})(typeof window !== 'undefined' ? window : globalThis);
