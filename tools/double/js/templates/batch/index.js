// 模版：客户单证 · 每次装柜 —— 批次装箱单 PACKING LIST、批次发票 FACTURE（蓝色版式）
// 数据来源：工厂/仓库发来的装箱资料（Excel 或文字型 PDF），格式经常变，按列名同义词识别。
(function () {
  const cfg = window.PI_CONFIG;
  const B = window.BatchParser;
  const K = window.PdfKit;
  const SH = window.DocShipping;
  const L = K.L, R = K.R, W = K.W;
  const NAVY = [12, 52, 82], BLUE = [27, 158, 212], LIGHT = [220, 220, 220], PALE = [240, 240, 240];
  const safeName = (s) => String(s || 'DOC').replace(/[\\/:*?"<>|]/g, '_');
  const has = (v) => v !== null && v !== undefined && v !== '';

  // 柜序号在编辑器里从 1 开始
  function parse(rows, ctx) {
    const res = B.parse(rows, ctx);
    res.doc.items.forEach((it) => { it.container = (it.container || 0) + 1; });
    res.doc.rate = 0;
    return res;
  }

  // ---------- 公共版头：标志 + 公司 + 标题 + DATE/NO.CLIENT/NO.CDE ----------
  function header(d, doc, title) {
    const logo = (window.BATCH_ASSETS || {}).logo;
    if (logo) d.addImage(logo, 'JPEG', L + 2, 34, 58, 40);
    d.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...BLUE).text('DOUBLE', L + 66, 52);
    d.setFontSize(12).setTextColor(...NAVY).text('International', L + 66, 69);
    d.setFont('helvetica', 'normal').setFontSize(5).setTextColor(...NAVY);
    cfg.company.lines.forEach((t, i) => d.text(K.safe(t), L, 84 + i * 6));
    d.setTextColor(0);
    const bx = 360, bw = R - bx, cw = bw / 3;
    d.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY).text(title, bx + bw / 2, 52, { align: 'center' });
    d.setFontSize(6.5).text('(ORIGINAL)', bx + bw / 2, 63, { align: 'center' });
    [['DATE', doc.date], ['NO.CLIENT', doc.clientNo], ['NO.CDE', doc.orderNo]].forEach(([k, v], i) => {
      const x = bx + i * cw;
      d.setFillColor(...NAVY).rect(x, 70, cw, 11, 'F');
      d.setFillColor(...BLUE).rect(x, 81, cw, 11, 'F');
      d.setTextColor(255).setFontSize(7).text(k, x + cw / 2, 78, { align: 'center' });
      d.text(K.safe(v), x + cw / 2, 89, { align: 'center' });
    });
    d.setTextColor(0);
  }

  let K_ = 1; // 当前间距系数（尽量一页排完）
  const tbl = (startY, extra) => ({
    theme: 'grid', startY,
    styles: { font: 'helvetica', fontSize: 7, textColor: 0, lineColor: 0, lineWidth: 0.5, cellPadding: { top: Math.max(1.4, 3 * K_), bottom: Math.max(1.4, 3 * K_), left: 3, right: 3 }, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
    margin: { left: L, right: 595.28 - R, top: 30, bottom: 45 },
    showHead: 'everyPage',
    ...extra,
  });

  function containerText(c, i) {
    const parts = [c.no, c.seal, c.type, has(c.packages) ? `${c.packages}${c.unit || ''}` : '', has(c.weight) ? `${c.weight}KGS` : '', has(c.cbm) ? `${c.cbm}CBM` : ''].filter(Boolean);
    return `Container No.${i + 1}: ${parts.join('/')}`;
  }

  // 币种：批次发票可以是 USD 或 RMB（银行单证固定 USD）
  const curOf = (doc) => (doc.currency === 'RMB' ? 'RMB' : 'USD');
  const M = (doc, x) => K.money(x, curOf(doc) === 'RMB' ? '¥' : '$');
  const feeLabel = (doc, f) => String(f.label || '').replace(/\b(en|in)\s+(USD|RMB|CNY|EUR)\b/i, (a, w) => `${w} ${curOf(doc)}`)
    + (f.kind === 'rate' && !/%/.test(f.label) ? ` (${feeRate(f.rate)}%)` : '');
  const benOf = (doc) => (curOf(doc) === 'RMB' && cfg.beneficiaryRMB) || cfg.beneficiary;
  const feeRate = (x) => String(Math.round(Number(x) * 1000) / 1000);

  // ---------- 批次装箱单 ----------
  const plPdf = (doc) => K.fitOnePage((k) => { K_ = k; return plRender(doc); });
  function plRender(doc) {
    const t = B.totals(doc);
    const d = K.newDoc();
    header(d, doc, 'PACKING LIST');
    const types = SH.containerSummary(doc.containers) || doc.containerType;
    d.autoTable(tbl(118, {
      head: [['Bill of Lading', 'Port Chargement', 'Port Déchargement', 'Vessel', 'No. Containeur', 'Type Containeur']],
      body: [[doc.blNo, doc.loadingPort, doc.destinationPort, doc.vessel, String(doc.containers.length || ''), types].map(K.safe)],
      bodyStyles: { halign: 'center' },
      margin: { left: L + 95, right: 595.28 - R },
    }));

    // 明细：按柜分组，柜行在前；毛重/体积只写在每柜第一行时合并显示
    const body = [];
    const groups = [];
    doc.items.forEach((it, i) => {
      const g = Number(it.container) || 1;
      let grp = groups.find((x) => x.g === g);
      if (!grp) groups.push((grp = { g, items: [] }));
      grp.items.push({ it, i });
    });
    groups.sort((a, b) => a.g - b.g);
    groups.forEach(({ g, items }) => {
      const c = doc.containers[g - 1];
      if (c) body.push([{ content: K.safe(containerText(c, g - 1)), colSpan: 8, styles: { fillColor: LIGHT, fontStyle: 'bold' } }]);
      const restEmpty = (k) => items.slice(1).every(({ it }) => !has(it[k]));
      const mergeGw = restEmpty('gw'), mergeCbm = restEmpty('cbm');
      items.forEach(({ it }, j) => {
        const row = [String(body.filter((r) => r.length > 1).length + 1), K.safe(it.ref), K.safe(it.desc), K.fmt(it.pcsPerCtn), K.fmt(it.cartons), K.fmt(it.qty)];
        const span = { rowSpan: items.length, styles: { halign: 'center', valign: 'middle' } };
        const gw = has(it.gw) ? it.gw : (c && j === 0 ? c.weight : null);
        const cbm = has(it.cbm) ? it.cbm : (c && j === 0 ? c.cbm : null);
        if (!mergeGw) row.push(K.fmt(it.gw)); else if (j === 0) row.push({ content: K.fmt(gw), ...span });
        if (!mergeCbm) row.push(K.fmt(it.cbm, 2)); else if (j === 0) row.push({ content: K.fmt(cbm, 2), ...span });
        body.push(row);
      });
    });
    d.autoTable(tbl(d.lastAutoTable.finalY + Math.max(6, 12 * K_), {
      head: [['NO', 'REF', 'DESIGNATION', 'PCS/CTN', 'Cartons', 'Quantité', 'P.Brut(kg)', 'MEAST(m³)']],
      body,
      foot: [[{ content: '', colSpan: 3, styles: { lineWidth: 0, fillColor: false } }, 'TOTAL', K.fmt(t.cartons), K.fmt(t.qty), K.fmt(t.gw, 1), K.fmt(t.cbm, 1)]],
      footStyles: { fillColor: PALE, textColor: 0, fontStyle: 'bold', halign: 'center' },
      showFoot: 'lastPage',
      columnStyles: { 0: { halign: 'center', cellWidth: 26 }, 1: { halign: 'center', cellWidth: 52 }, 2: { cellWidth: 135 }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' } },
    }));

    // 说明框：货物性质 + 柜列表 + 备注
    const n = doc.containers.length;
    const lines = [];
    if (doc.nature) lines.push(`Nature des marchandises : ${doc.nature}`, '');
    if (n) { lines.push(`Les marchandises sont expédiées en ${n} container${n > 1 ? 's' : ''}:`); doc.containers.forEach((c, i) => lines.push(containerText(c, i))); }
    if (doc.comments) lines.push('', `Commentaires: ${doc.comments}`);
    if (lines.length) {
      d.setFont('helvetica', 'normal').setFontSize(6.5);
      const wrapped = lines.flatMap((x) => (x ? d.splitTextToSize(K.safe(x), W - 30) : ['']));
      let y = d.lastAutoTable.finalY + Math.max(12, 30 * K_);
      const h = 16 + wrapped.length * 9;
      if (y + h > 800) { d.addPage(); y = 40; }
      d.setFillColor(...PALE).rect(L + 10, y, W - 20, h, 'F');
      wrapped.forEach((x, i) => d.text(x, L + 16, y + 14 + i * 9));
    }
    K.pageNumbers(d);
    return d;
  }

  // ---------- 批次发票 ----------
  const facturePdf = (doc) => K.fitOnePage((k) => { K_ = k; return factureRender(doc); });
  function factureRender(doc) {
    const t = B.totals(doc);
    const d = K.newDoc();
    header(d, doc, 'FACTURE');
    d.autoTable(tbl(118, {
      head: [['NO', 'REF', 'DESIGNATION', 'Cartons', 'Quantité', `Prix Unitaire (${curOf(doc)})`, `Montant (${curOf(doc)})`]],
      body: doc.items.map((it, i) => [String(i + 1), K.safe(it.ref), K.safe(it.desc), K.fmt(it.cartons), K.fmt(it.qty), has(it.price) ? M(doc, it.price) : '', M(doc, t.lines[i])]),
      columnStyles: { 0: { halign: 'center', cellWidth: 40 }, 1: { halign: 'center', cellWidth: 60 }, 2: { cellWidth: 160 }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    }));
    let y = d.lastAutoTable.finalY + 4;
    const sums = t.fees.map((f) => [feeLabel(doc, f), M(doc, f.value)]);
    if (Number(doc.rate)) sums.push(['Taux de change', String(doc.rate)]);
    const bankLines = [
      `BENEFICIARY NAME: ${benOf(doc).name}`,
      `BENEFICIARY ACCOUNT NO: ${benOf(doc).accountNo}`,
      `BENEFICIARY BANK: ${benOf(doc).bank}`,
      `SWIFT CODE NO.: ${benOf(doc).swift}`,
      `INTERMEDIARY BANK: ${benOf(doc).intermediaryBank}`,
      `SWIFT CODE NO: ${benOf(doc).intermediarySwift}`,
    ].filter((l) => !/:\s*(undefined|null)?\s*$/.test(l));
    const blockH = Math.max(sums.length * 12 + 8, 28 + bankLines.length * 12);
    if (y + blockH + 70 > 800) { d.addPage(); y = 40; }
    const vx = 480;
    d.setFillColor(...LIGHT).rect(vx, y, R - vx, blockH, 'F');
    sums.forEach(([k, v], i) => {
      const ly = y + 10 + i * 12;
      d.setFont('helvetica', 'bold').setFontSize(7).text(K.safe(k), vx - 4, ly, { align: 'right' });
      d.text(v, R - 4, ly, { align: 'right' });
    });
    d.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...BLUE).text('DETAIL DE COMPTE BANCAIRE DU VENDEUR', L, y + 28);
    d.setTextColor(0).setFont('helvetica', 'normal').setFontSize(7);
    bankLines.forEach((x, i) => d.text(K.safe(x), L, y + 42 + i * 12));
    y += blockH + 40;
    d.setFont('helvetica', 'italic').setFontSize(5.8);
    d.text(K.safe('Paiement à effectuer par virement bancaire sur le compte du vendeur. La marchandise reste la propriété du vendeur jusqu’au paiement intégral.'), K.MID, y, { align: 'center' });
    d.text(K.safe('Tout retard de paiement pourra entraîner des pénalités conformément aux conditions commerciales.'), K.MID, y + 11, { align: 'center' });
    K.pageNumbers(d);
    return d;
  }

  // ---------- Excel（数据版：版式简单，方便再编辑） ----------
  function xlsxBlob(docs, kind) {
    const wb = XLSX.utils.book_new();
    docs.forEach((doc, n) => {
      const t = B.totals(doc);
      const aoa = [[kind === 'pl' ? 'PACKING LIST' : 'FACTURE'], [], ['DATE', doc.date, 'NO.CLIENT', doc.clientNo, 'NO.CDE', doc.orderNo], []];
      if (kind === 'pl') {
        aoa.push(['Bill of Lading', 'Port Chargement', 'Port Déchargement', 'Vessel', 'No. Containeur', 'Type Containeur']);
        aoa.push([doc.blNo, doc.loadingPort, doc.destinationPort, doc.vessel, doc.containers.length, SH.containerSummary(doc.containers) || doc.containerType], []);
        aoa.push(['NO', 'REF', 'DESIGNATION', 'PCS/CTN', 'Cartons', 'Quantité', 'P.Brut(kg)', 'MEAST(m³)']);
        let cur = null, no = 0;
        [...doc.items].sort((a, b) => (a.container || 1) - (b.container || 1)).forEach((it) => {
          if (it.container !== cur) { cur = it.container; const c = doc.containers[(cur || 1) - 1]; if (c) aoa.push([containerText(c, (cur || 1) - 1)]); }
          aoa.push([++no, it.ref, it.desc, it.pcsPerCtn, it.cartons, it.qty, it.gw, it.cbm]);
        });
        aoa.push(['', '', '', 'TOTAL', t.cartons, t.qty, t.gw, t.cbm], []);
        if (doc.nature) aoa.push([`Nature des marchandises : ${doc.nature}`]);
        if (doc.comments) aoa.push([`Commentaires: ${doc.comments}`]);
      } else {
        aoa.push(['NO', 'REF', 'DESIGNATION', 'Cartons', 'Quantité', `Prix Unitaire (${curOf(doc)})`, `Montant (${curOf(doc)})`]);
        doc.items.forEach((it, i) => aoa.push([i + 1, it.ref, it.desc, it.cartons, it.qty, it.price, t.lines[i]]));
        aoa.push([], ...t.fees.map((f) => ['', '', '', '', '', feeLabel(doc, f), f.value]), [],
          ['DETAIL DE COMPTE BANCAIRE DU VENDEUR'], [`BENEFICIARY NAME: ${benOf(doc).name}`], [`BENEFICIARY ACCOUNT NO: ${benOf(doc).accountNo}`],
          [`BENEFICIARY BANK: ${benOf(doc).bank}`], [`SWIFT CODE NO.: ${benOf(doc).swift}`], [`INTERMEDIARY BANK: ${benOf(doc).intermediaryBank}`], [`SWIFT CODE NO: ${benOf(doc).intermediarySwift}`]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
      const base = String(doc.orderNo || doc.clientNo || `Sheet${n + 1}`).replace(/[\\/?*[\]:]/g, '_').slice(0, 28);
      let name = base, k = 2;
      while (wb.SheetNames.includes(name)) name = `${base}-${k++}`;
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------- 校验 ----------
  function validateCommon(doc) {
    const out = [];
    if (!doc.items.length) out.push({ level: 'error', msg: '没有明细行' });
    if (!doc.date) out.push({ level: 'warn', msg: '日期 DATE 为空' });
    if (!doc.clientNo) out.push({ level: 'warn', msg: '客户号 NO.CLIENT 为空' });
    if (!doc.orderNo) out.push({ level: 'warn', msg: '订单号 NO.CDE 为空' });
    const noDesc = doc.items.map((it, i) => (!it.desc && !it.ref ? i + 1 : 0)).filter(Boolean);
    if (noDesc.length) out.push({ level: 'error', msg: `第 ${noDesc.join('、')} 行没有 REF 也没有品名` });
    const noQty = doc.items.map((it, i) => (!has(it.qty) ? i + 1 : 0)).filter(Boolean);
    if (noQty.length) out.push({ level: 'error', msg: `第 ${noQty.join('、')} 行没有数量` });
    const bad = doc.items.map((it, i) => (has(it.pcsPerCtn) && has(it.cartons) && has(it.qty) && Math.abs(it.pcsPerCtn * it.cartons - it.qty) > 0.01 ? i + 1 : 0)).filter(Boolean);
    if (bad.length) out.push({ level: 'warn', msg: `第 ${bad.join('、')} 行：每箱件数 × 箱数 ≠ 数量，请核对` });
    return out;
  }

  function validatePl(doc) {
    const out = validateCommon(doc);
    if (!doc.blNo) out.push({ level: 'warn', msg: '提单号为空' });
    if (!doc.containers.length) out.push({ level: 'warn', msg: '没有柜号信息（Container No.）' });
    doc.containers.forEach((c, i) => {
      const no = String(c.no || '').toUpperCase().replace(/\s/g, '');
      if (!no) out.push({ level: 'error', msg: `第 ${i + 1} 个柜没有柜号` });
      else if (!SH.containerCheckOk(no)) out.push({ level: 'warn', msg: `柜号 ${no} 校验位不对，请核对` });
      if (!c.seal) out.push({ level: 'warn', msg: `柜 ${i + 1} 封号为空` });
      const its = doc.items.filter((it) => Number(it.container) === i + 1);
      const ctn = its.reduce((a, it) => a + (Number(it.cartons) || 0), 0);
      if (has(c.packages) && its.length && Math.abs(ctn - c.packages) > 0.01) out.push({ level: 'warn', msg: `柜 ${i + 1}：明细箱数合计 ${ctn}，柜信息写的是 ${c.packages}${c.unit || ''}，请核对` });
      const gw = its.reduce((a, it) => a + (Number(it.gw) || 0), 0);
      if (has(c.weight) && gw && Math.abs(gw - c.weight) > 0.5) out.push({ level: 'warn', msg: `柜 ${i + 1}：明细毛重合计 ${gw}，柜信息写的是 ${c.weight} KGS，请核对` });
    });
    const maxC = Math.max(0, ...doc.items.map((it) => Number(it.container) || 0));
    if (doc.containers.length && maxC > doc.containers.length) out.push({ level: 'warn', msg: `有明细标在第 ${maxC} 柜，但只有 ${doc.containers.length} 个柜信息` });
    return out;
  }

  function validateFacture(doc) {
    const out = validateCommon(doc);
    const noPrice = doc.items.map((it, i) => (!has(it.price) || !Number(it.price) ? i + 1 : 0)).filter(Boolean);
    const t = B.totals(doc);
    if (!t.fees.length) out.push({ level: 'error', msg: '金额汇总至少要有一行（如 TOTAL À PAYER）' });
    t.fees.forEach((f, i) => {
      if (!String(f.label).trim()) out.push({ level: 'error', msg: `金额汇总第 ${i + 1} 行没有名称` });
      else if (f.kind !== 'auto' && !f.value) out.push({ level: 'info', msg: `「${f.label}」是 0，如有费用请在「金额汇总」里填写，不需要可以删掉这一行` });
    });
    const last = t.fees[t.fees.length - 1];
    if (last && last.kind !== 'auto') out.push({ level: 'warn', msg: `金额汇总最后一行「${last.label}」不是自动总额，请确认应付合计` });
    if (noPrice.length) out.push({ level: 'error', msg: noPrice.length === doc.items.length ? '还没有单价：可以点「导入单价」上传报价/订单文件，或在下面逐行填写' : `第 ${noPrice.join('、')} 行没有单价` });
    return out;
  }

  // ---------- 补充资料：导入单价（按 REF，其次按品名匹配） ----------
  const norm = (s) => String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');
  const priceAttachment = {
    id: 'price', label: '导入单价', accept: '.xlsx,.xls,.xlsm,.pdf',
    async handle(file, doc) {
      const { rows } = await DocReaders.readFile(file);
      const fileCur = B.detectCurrency(rows.map((r) => (r || []).join(' ')).join('\n'));
      const curNote = fileCur && fileCur !== curOf(doc) ? (doc.currency = fileCur, [{ level: 'warn', msg: `「${file.name}」里的单价是 ${fileCur}，已把发票币种改成 ${fileCur}，请确认` }]) : [];
      const head = B.findHeader(rows, 'price');
      if (!head || head.map.price === undefined) return [{ level: 'error', msg: `「${file.name}」里没找到单价列（Prix / Price / 单价）` }];
      const c = head.map;
      const prices = [];
      for (let r = head.r + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const p = Number(String(row[c.price] ?? '').replace(/[^\d.\-]/g, ''));
        if (!p) continue;
        prices.push({ ref: norm(c.ref !== undefined ? row[c.ref] : ''), desc: norm(c.desc !== undefined ? row[c.desc] : ''), price: p });
      }
      let hit = 0;
      const miss = [];
      doc.items.forEach((it, i) => {
        const m = (it.ref && prices.find((p) => p.ref && p.ref === norm(it.ref))) || (it.desc && prices.find((p) => p.desc && p.desc === norm(it.desc)));
        if (m) { it.price = m.price; hit++; } else miss.push(i + 1);
      });
      const out = [{ level: 'info', msg: `已从「${file.name}」按 REF/品名匹配到 ${hit} 行单价` }];
      if (miss.length) out.push({ level: 'warn', msg: `第 ${miss.join('、')} 行没匹配到单价，请手动填写` });
      return [...curNote, ...out];
    },
  };

  // ---------- 编辑器 ----------
  const headFields = { title: '抬头', fields: [
    { key: 'date', label: '日期 DATE' }, { key: 'clientNo', label: '客户号 NO.CLIENT' }, { key: 'orderNo', label: '订单号 NO.CDE' },
  ] };
  const containerSection = {
    title: '柜号 / 封号', items: {
      key: 'containers', hint: '来自原文件里的 Container No. 行，可修改',
      columns: [
        { key: 'no', label: '柜号', width: '18%' }, { key: 'seal', label: '封号', width: '16%' }, { key: 'type', label: '柜型' },
        { key: 'packages', label: '件数', type: 'number' }, { key: 'unit', label: '单位' },
        { key: 'weight', label: '毛重 KGS', type: 'number' }, { key: 'cbm', label: '体积 CBM', type: 'number' },
      ],
      newRow: () => ({ no: '', seal: '', type: '40HQ', packages: null, unit: 'CTNS', weight: null, cbm: null }),
    },
  };
  const newItem = () => ({ ref: '', desc: '', unit: '', pcsPerCtn: null, cartons: null, qty: null, gw: null, nw: null, cbm: null, price: null, container: 1 });
  const statsOf = (withMoney) => (doc) => {
    const t = B.totals(doc);
    const s = [
      { label: '明细', value: `${doc.items.length} 行` },
      { label: '箱数', value: K.fmt(t.cartons) },
      { label: '数量', value: K.fmt(t.qty) },
    ];
    if (withMoney) s.push({ label: '应付合计', value: M(doc, t.total), tone: doc.items.some((it) => !Number(it.price)) ? 'error' : '' });
    else s.push({ label: '毛重 / 体积', value: `${K.fmt(t.gw)} KGS / ${K.fmt(t.cbm, 2)} CBM` });
    return s;
  };

  DocTool.register({
    id: 'batch-pl', group: 'batch', badge: '客户', name: '批次装箱单', nameEn: 'Packing List',
    description: '上传工厂/仓库的装箱资料（Excel 或 PDF，格式不固定），按列名自动识别，生成给客户的批次装箱单',
    uploadHint: '装箱资料',
    parse,
    validate: validatePl,
    title: (doc) => `装箱单 ${doc.orderNo || doc.clientNo || ''}`.trim(),
    stats: statsOf(false),
    sections: [
      headFields,
      { title: '运输信息', fields: [
        { key: 'blNo', label: '提单号 Bill of Lading' }, { key: 'vessel', label: '船名 Vessel' },
        { key: 'loadingPort', label: '起运港 Port Chargement' }, { key: 'destinationPort', label: '目的港 Port Déchargement' },
        { key: 'nature', label: '货物性质 Nature des marchandises' }, { key: 'comments', label: '备注 Commentaires' },
      ] },
      containerSection,
      { title: '装箱明细', items: {
        key: 'items', hint: '「柜」填第几柜（1、2…），导出时按柜分组',
        columns: [
          { key: 'container', label: '柜', type: 'number', width: '6%' }, { key: 'ref', label: 'REF', width: '12%' }, { key: 'desc', label: '品名 DESIGNATION', width: '26%' },
          { key: 'pcsPerCtn', label: '每箱件数', type: 'number' }, { key: 'cartons', label: '箱数', type: 'number' }, { key: 'qty', label: '数量', type: 'number' },
          { key: 'gw', label: '毛重 kg', type: 'number' }, { key: 'cbm', label: '体积 m³', type: 'number' },
        ],
        newRow: newItem,
        totals: (doc) => { const t = B.totals(doc); return [['总箱数', K.fmt(t.cartons)], ['总数量', K.fmt(t.qty)], ['总毛重', `${K.fmt(t.gw, 1)} KGS${t.gwFromContainers ? '（取自柜信息）' : ''}`], ['总体积', `${K.fmt(t.cbm, 2)} CBM${t.cbmFromContainers ? '（取自柜信息）' : ''}`]]; },
      } },
    ],
    preview: (doc) => plPdf(doc).output('blob'),
    exports: [
      { id: 'pdf', label: 'PDF', perDoc: true, build: async (docs) => plPdf(docs[0]).output('blob'), fileName: (docs) => `${safeName(docs[0].orderNo || docs[0].clientNo)} Packing List.pdf` },
      { id: 'xlsx', label: 'Excel', perDoc: true, merge: true, mergeLabel: '合并导出 Excel（每份一个工作表）', build: async (docs) => xlsxBlob(docs, 'pl'), fileName: (docs) => docs.length > 1 ? `Packing List-${docs.length}份.xlsx` : `${safeName(docs[0].orderNo || docs[0].clientNo)} Packing List.xlsx` },
    ],
  });

  DocTool.register({
    id: 'batch-facture', group: 'batch', badge: '客户', name: '批次发票', nameEn: 'Facture',
    description: '上传装箱资料（Excel 或 PDF），没有单价时可再导入报价/订单文件按 REF 自动匹配，生成给客户的批次发票',
    uploadHint: '装箱资料',
    parse: (rows, ctx) => {
      const res = parse(rows, ctx);
      res.warnings = res.warnings.filter((w) => !/单价列/.test(w.msg));
      if (res.doc.items.length && res.doc.items.every((it) => !has(it.price))) res.warnings.push({ level: 'info', msg: '原文件没有单价。下一步：点「导入单价」上传带单价的文件（按 REF 匹配），或在下面逐行填写', id: 'need-price' });
      return res;
    },
    attachments: [priceAttachment],
    validate: validateFacture,
    title: (doc) => `发票 ${doc.orderNo || doc.clientNo || ''}`.trim(),
    stats: statsOf(true),
    sections: [
      { title: '抬头', fields: [
        ...headFields.fields,
        { key: 'currency', label: '币种（发票上的金额和 en USD / en RMB 跟着变）', options: [['USD', 'USD 美元'], ['RMB', 'RMB 人民币']] },
      ] },
      { title: '发票明细', items: {
        key: 'items', hint: '金额 = 数量 × 单价，自动计算',
        columns: [
          { key: 'ref', label: 'REF', width: '13%' }, { key: 'desc', label: '品名 DESIGNATION', width: '32%' },
          { key: 'cartons', label: '箱数', type: 'number' }, { key: 'qty', label: '数量', type: 'number' }, { key: 'price', label: '单价', type: 'number' },
        ],
        computed: { label: '金额', value: (doc, i) => M(doc, B.totals(doc).lines[i]) },
        newRow: newItem,
        totals: (doc) => [['货款合计', M(doc, B.totals(doc).goods)]],
      } },
      { title: '金额汇总', items: {
        key: 'fees',
        hint: '印在发票底部，可改名、删除、加行。填「比例%」= 货款 × 比例（如佣金）；填「金额」= 固定金额（如物流费）；两个都空 = 自动累计（货款 + 上面所有费用）',
        addLabel: '添加一行（如 ASSURANCE、FRAIS DE DOUANE）',
        columns: [
          { key: 'label', label: '名称（印在发票上）', width: '46%' },
          { key: 'rate', label: '比例 %', type: 'number' },
          { key: 'amount', label: '金额', type: 'number' },
        ],
        computed: { label: '显示金额', value: (doc, i) => M(doc, B.totals(doc).fees[i].value) },
        newRow: () => ({ label: '', rate: null, amount: 0 }),
        // 新行加在最后的「应付合计」上面
        insertAt: (doc) => { const f = doc.fees, l = f[f.length - 1]; return f.length && l.amount == null && l.rate == null ? f.length - 1 : f.length; },
        totals: (doc) => [['应付合计', M(doc, B.totals(doc).total)]],
      } },
      { title: '汇率', fields: [
        { key: 'rate', label: '汇率 Taux de change（0 = 不显示）', type: 'number' },
      ] },
    ],
    preview: (doc) => facturePdf(doc).output('blob'),
    exports: [
      { id: 'pdf', label: 'PDF', perDoc: true, build: async (docs) => facturePdf(docs[0]).output('blob'), fileName: (docs) => `${safeName(docs[0].orderNo || docs[0].clientNo)} Facture.pdf` },
      { id: 'xlsx', label: 'Excel', perDoc: true, merge: true, mergeLabel: '合并导出 Excel（每份一个工作表）', build: async (docs) => xlsxBlob(docs, 'facture'), fileName: (docs) => docs.length > 1 ? `Facture-${docs.length}份.xlsx` : `${safeName(docs[0].orderNo || docs[0].clientNo)} Facture.xlsx` },
    ],
  });

  window.BatchDocs = { plPdf, facturePdf, xlsxBlob };
})();
