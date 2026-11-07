// 模版：银行交单 · 装箱单 PL、符合性证书 COC
// 数据来源：客户 PI（品名、数量、客户信息、港口）+ 提单（提单号、船名、柜号/封号、件数、毛重、体积）
(function () {
  const cfg = window.PI_CONFIG;
  const P = window.PIParser;
  const K = window.PdfKit;
  const SH = window.DocShipping;
  const safeName = (s) => String(s || 'DOC').replace(/[\\/:*?"<>|]/g, '_');
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const STICKY = /序号不连续|无法自动归类|表头|来自 PDF/;

  const companyLines = () => [cfg.company.name, ...cfg.company.lines];
  const city = (port) => String(port || '').split(/[,，]/)[0].trim();
  const country = (port) => (String(port || '').split(/[,，]/)[1] || '').trim();
  const routeOf = (doc) => {
    const a = city(doc.loadingPort), b = city(doc.destinationPort);
    if (!a && !b) return '';
    const ca = country(doc.loadingPort), cb = country(doc.destinationPort);
    return `FROM ${a}${ca ? ` (${ca})` : ''} TO ${b}${cb ? ` (${cb})` : ''}`;
  };

  function totals(doc) {
    const sum = (k) => doc.containers.reduce((a, c) => a + (Number(c[k]) || 0), 0);
    const unit = doc.packageUnit || (doc.containers.find((c) => c.unit) || {}).unit || 'PACKAGES';
    return {
      packages: doc.containers.length ? sum('packages') : null,
      weight: doc.containers.length ? r3(sum('weight')) : null,
      cbm: doc.containers.length ? r3(sum('cbm')) : null,
      unit,
      summary: SH.containerSummary(doc.containers),
    };
  }

  function baseParse(rows, ctx) {
    const { pi, warnings } = P.parseRows(rows, ctx.fileName, cfg);
    const doc = {
      ...pi,
      blNo: '', vessel: '', containers: [], packageUnit: '',
      supplierLines: companyLines(),
      goodsDesc: pi.items.map((it) => it.desc).filter(Boolean),
      route: '',
      origin: pi.origin || 'CHINA',
    };
    doc.route = routeOf(doc);
    if (ctx.source === 'pdf') warnings.unshift({ level: 'info', msg: '来自 PDF：已按版面位置还原表格，请核对' });
    const out = warnings.filter((w) => STICKY.test(w.msg));
    out.push({ level: 'info', msg: '下一步：点「上传提单识别」，自动填入提单号、船名、柜号/封号、件数、毛重、体积', id: 'need-bl' });
    return { doc, warnings: out };
  }

  // 补充资料：提单（图片/PDF）或装箱资料（Excel/PDF）
  const blAttachment = {
    id: 'bl', label: '上传提单识别', accept: '.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls',
    async handle(file, doc, onProgress) {
      const { text, method } = await DocOCR.readText(file, onProgress);
      const { ship, warnings } = SH.parseShipping(text);
      if (ship.blNo) doc.blNo = ship.blNo;
      if (ship.vessel) doc.vessel = ship.vessel;
      if (ship.containers.length) doc.containers = ship.containers.map(({ no, seal, type, packages, unit, weight, cbm }) => ({ no, seal, type, packages, unit, weight, cbm }));
      if (ship.packageUnit) doc.packageUnit = ship.packageUnit;
      if (!doc.loadingPort && ship.loadingPort) doc.loadingPort = ship.loadingPort;
      if (!doc.destinationPort && ship.destinationPort) doc.destinationPort = ship.destinationPort;
      doc.route = routeOf(doc);
      const head = method === 'ocr'
        ? { level: 'warn', msg: `已从「${file.name}」用图片识别（OCR）填入运输信息，图片识别可能有错，请逐项核对柜号、封号和数字` }
        : { level: 'info', msg: `已从「${file.name}」读取运输信息` };
      if (ship.totalWeight != null) {
        const t = totals(doc);
        if (t.weight && Math.abs(t.weight - ship.totalWeight) > 0.5) warnings.push({ level: 'warn', msg: `提单总毛重 ${ship.totalWeight} KGS，各柜相加 ${t.weight} KGS，请核对` });
      }
      return [head, ...warnings];
    },
  };

  function validateShip(doc, needVessel) {
    const out = [];
    if (!doc.invoiceNo) out.push({ level: 'error', msg: '发票号为空' });
    if (!doc.clientLines.length) out.push({ level: 'error', msg: '客户信息为空' });
    if (!doc.blNo) out.push({ level: 'error', msg: '提单号为空' });
    if (needVessel && !doc.vessel) out.push({ level: 'error', msg: '船名航次为空' });
    if (!doc.containers.length) out.push({ level: 'error', msg: '还没有柜号信息' });
    doc.containers.forEach((c, i) => {
      const no = String(c.no || '').toUpperCase().replace(/\s/g, '');
      if (!no) out.push({ level: 'error', msg: `第 ${i + 1} 个柜没有柜号` });
      else if (!SH.containerCheckOk(no)) out.push({ level: 'warn', msg: `柜号 ${no} 校验位不对，请核对` });
      if (!c.seal) out.push({ level: 'warn', msg: `柜 ${i + 1} 封号为空` });
      if (!c.type) out.push({ level: 'warn', msg: `柜 ${i + 1} 柜型为空（如 40HQ / 20GP）` });
      if (c.weight === null || c.weight === '' || c.weight === undefined) out.push({ level: 'warn', msg: `柜 ${i + 1} 毛重为空` });
      if (c.cbm === null || c.cbm === '' || c.cbm === undefined) out.push({ level: 'warn', msg: `柜 ${i + 1} 体积为空` });
      if (c.packages === null || c.packages === '' || c.packages === undefined) out.push({ level: 'warn', msg: `柜 ${i + 1} 件数为空` });
    });
    return out;
  }

  const containerSection = {
    title: '柜号 / 封号', items: {
      key: 'containers', hint: '可上传提单自动识别，也可以手动填写',
      columns: [
        { key: 'no', label: '柜号', width: '18%' }, { key: 'seal', label: '封号', width: '16%' }, { key: 'type', label: '柜型' },
        { key: 'packages', label: '件数', type: 'number' }, { key: 'unit', label: '单位' },
        { key: 'weight', label: '毛重 KGS', type: 'number' }, { key: 'cbm', label: '体积 CBM', type: 'number' },
      ],
      newRow: () => ({ no: '', seal: '', type: '40HQ', packages: null, unit: 'PACKAGES', weight: null, cbm: null }),
      totals: (doc) => { const t = totals(doc); return [['柜型', t.summary || '—'], ['总件数', `${K.fmt(t.packages)} ${t.unit}`], ['总毛重', `${K.fmt(t.weight, 3)} KGS`], ['总体积', `${K.fmt(t.cbm, 3)} CBM`]]; },
    },
  };

  const stats = (doc) => {
    const t = totals(doc);
    return [
      { label: '柜数', value: doc.containers.length ? `${doc.containers.length} 个` : '未填' , tone: doc.containers.length ? '' : 'error' },
      { label: '件数', value: t.packages ? `${t.packages}` : '—' },
      { label: '毛重', value: t.weight ? `${K.fmt(t.weight)} KGS` : '—' },
      { label: '体积', value: t.cbm ? `${K.fmt(t.cbm, 3)} CBM` : '—' },
    ];
  };

  const assets = () => window.PI_ASSETS || {};
  const headerOf = (doc, title) => ({ company: cfg.company, logo: assets().logo, title, boxes: [['INVOICE NO:', doc.invoiceNo], ['INVOICE DATE:', doc.date]] });

  // ---------------- 装箱单 PL ----------------
  const plPdf = (doc) => K.fitOnePage((k) => plRender(doc, k));
  function plRender(doc, k) {
    const t = totals(doc);
    const d = K.newDoc();
    K.header(d, headerOf(doc, 'PACKING LIST'));
    let y = K.twoBoxes(d, 152, { title: 'INFORMATIONS CLIENT', lines: doc.clientLines }, { title: 'INFORMATIONS FOURNISSEUR', lines: doc.supplierLines }, k);
    const n = doc.items.length;
    const body = doc.items.map((it, i) => {
      const row = [String(i + 1), K.safe(it.desc), it.qty ?? '', K.safe(it.unit)];
      if (i === 0) {
        const span = { rowSpan: n, styles: { valign: 'middle', halign: 'center' } };
        row.push({ content: t.packages != null ? `${K.fmt(t.packages)} ${t.unit}` : '', ...span });
        row.push({ content: t.weight != null ? `${K.fmt(t.weight)} KGS` : '', ...span });
        row.push({ content: t.cbm != null ? `${K.fmt(t.cbm, 3)}CBM` : '', ...span });
      }
      return row;
    });
    d.autoTable({
      ...K.tableStyles,
      styles: { ...K.tableStyles.styles, cellPadding: K.pad(k) },
      startY: y + Math.max(10, 20 * k),
      head: [['NO', 'DESIGNATION', 'QUANTITÉ', 'UNITÉ', 'PACKAGES', 'GROSS\nWEIGHT', 'MEASURE\nMENT']],
      body,
      foot: [[{ content: 'TOTAL', colSpan: 4, styles: { halign: 'left' } }, `${K.fmt(t.packages)} ${t.unit}`, `${K.fmt(t.weight, 1)} KGS`, `${K.fmt(t.cbm, 3)}CBM`]],
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', halign: 'center', lineWidth: 0.6, lineColor: 0 },
      showFoot: 'lastPage',
      columnStyles: { 0: { halign: 'center', cellWidth: 32 }, 1: { cellWidth: 180 }, 2: { halign: 'center', cellWidth: 55 }, 3: { halign: 'center', cellWidth: 45 }, 4: { halign: 'center', cellWidth: 80 }, 5: { halign: 'center', cellWidth: 78 }, 6: { halign: 'center', cellWidth: 75 } },
    });
    y = d.lastAutoTable.finalY + Math.max(8, 18 * k);
    const ls = Math.max(10, 12.5 * k);
    const lines = [
      ['SUMMARY:', ''], ['', ''],
      ['TOTAL NO. OF CONTAINER: ', t.summary],
      [`TOTAL NO. OF ${t.unit}: `, `${K.fmt(t.packages)} ${t.unit}`],
      ['TOTAL GROSS WEIGHT: ', `${K.fmt(t.weight)} KGS`],
      ['TOTAL MEASUREMENT: ', `${K.fmt(t.cbm, 3)} CBM`],
      ['B/L No.: ', doc.blNo],
      ['CONTAINER / SEAL NO.:', ''],
      ...doc.containers.map((c, i) => ['', SH.containerLine(c, i)]),
    ];
    const h = 12 + lines.length * ls;
    if (y + h > 800) { d.addPage(); y = 40; }
    d.setFillColor(...K.GREY).rect(K.L, y, K.W, h, 'F');
    lines.forEach(([k, v], i) => {
      const ly = y + 14 + i * ls;
      d.setFont('helvetica', 'bold').setFontSize(7.5).text(K.safe(k), K.L + 4, ly);
      d.setFont('helvetica', k ? 'bold' : 'normal').text(K.safe(v), K.L + 4 + (k ? d.getTextWidth(K.safe(k)) + 2 : 0), ly);
    });
    K.pageNumbers(d);
    return d;
  }

  DocTool.register({
    id: 'pl', group: 'bank', badge: '银行', name: '装箱单 PL', nameEn: 'Packing List',
    description: '上传客户 PI，再上传提单（图片或 PDF），自动生成银行交单用的装箱单',
    uploadHint: '客户发来的 PI',
    parse: baseParse,
    attachments: [blAttachment],
    validate: (doc) => {
      const out = validateShip(doc, false);
      if (!doc.items.length) out.push({ level: 'error', msg: '没有品名明细' });
      return out;
    },
    title: (doc) => `PL ${doc.invoiceNo || ''}`.trim(),
    stats,
    sections: [
      { title: '基本信息', fields: [{ key: 'invoiceNo', label: '发票号 INVOICE NO' }, { key: 'date', label: '日期 INVOICE DATE' }] },
      { title: '客户与供应商', fields: [
        { key: 'clientLines', label: '客户信息 INFORMATIONS CLIENT（每行一条）', type: 'lines', rows: 6 },
        { key: 'supplierLines', label: '供应商 INFORMATIONS FOURNISSEUR（每行一条）', type: 'lines', rows: 6 },
      ] },
      { title: '品名明细', items: {
        key: 'items', hint: '来自客户 PI',
        columns: [{ key: 'desc', label: '品名 DESIGNATION', width: '55%' }, { key: 'qty', label: '数量', type: 'number' }, { key: 'unit', label: '单位' }],
        newRow: () => ({ desc: '', qty: null, unit: '', price: null }),
      } },
      { title: '运输信息', fields: [{ key: 'blNo', label: '提单号 B/L No.' }, { key: 'packageUnit', label: '包装单位（PACKAGES / CARTONS / BAGS …）' }] },
      containerSection,
    ],
    preview: (doc) => plPdf(doc).output('blob'),
    exports: [{ id: 'pdf', label: 'PDF', perDoc: true, build: async (docs) => plPdf(docs[0]).output('blob'), fileName: (docs) => `${safeName(docs[0].invoiceNo)} PL.pdf` }],
  });

  // ---------------- 符合性证书 COC ----------------
  const cocPdf = (doc) => K.fitOnePage((k) => cocRender(doc, k));
  function cocRender(doc, k) {
    const sp = (x, min) => Math.max(min, x * k);
    const t = totals(doc);
    const d = K.newDoc();
    K.header(d, headerOf(doc, 'CERTIFICATE OF CONFORMITY'));
    let y = 150;
    d.setFont('helvetica', 'bold').setFontSize(8);
    const l1 = d.splitTextToSize(K.safe(`${K.fmt(t.cbm, 3)} CBM OF ${doc.goodsDesc.join(', ')}`), K.W);
    d.text(l1, K.L, y); y += l1.length * 11 + sp(12, 6);
    d.text(K.safe(`PACKED IN ${K.fmt(t.packages)} ${t.unit} OF ${K.fmt(t.weight, 2)} KGS GROSS WEIGHT`), K.L, y); y += sp(22, 14);
    d.text('DETAILS AS FOLLOW:', K.L, y); y += sp(16, 10);
    const rows = [
      ['CONSIGNEE', doc.clientLines],
      ['INVOICE NO', [doc.invoiceNo]],
      ['VESSEL', [doc.vessel]],
      ['B/L NO', [doc.blNo]],
      ['CONTAINER', doc.containers.map((c, i) => SH.containerLine(c, i))],
      ['ROUTE', [doc.route]],
      ['ORIGIN', [doc.origin === 'CHINE' ? 'CHINA' : doc.origin]],
      ['MEASUREMENT', [`${t.summary} ${K.fmt(t.cbm, 3)} CBM`]],
      [t.unit, [`${K.fmt(t.packages)} ${t.unit}`]],
      ['DESCRIPTION\nOF GOODS', doc.goodsDesc],
    ];
    const lx = K.L + 20, bx = 140, bw = K.R - bx; // 框尽量宽，柜号等一行写完不换行
    d.setFontSize(7.5);
    rows.forEach(([k, vals]) => {
      const lines = vals.flatMap((v) => d.splitTextToSize(K.safe(v), bw - 10));
      const h = Math.max(sp(16, 14), 8 + lines.length * 10);
      if (y + h > 790) { d.addPage(); y = 40; }
      d.setFont('helvetica', 'bold').text(k.split('\n'), lx, y + 11);
      d.setDrawColor(0).setLineWidth(0.6).rect(bx, y, bw, h);
      d.setFont('helvetica', 'normal').text(lines, bx + 5, y + 11);
      y += h + sp(12, 5);
    });
    y += sp(10, 4);
    d.setFont('helvetica', 'bolditalic').setFontSize(7.2);
    const stmt = d.splitTextToSize(K.safe(`WE, ${cfg.company.name} ARE MANUFACTURER AND SUPPLIER, HEREBY CERTIFY THAT THE PRODUCTS MENTIONED ABOVE ARE ORIGINALLY FROM ${doc.origin === 'CHINE' ? 'CHINA' : doc.origin} AND ARE IN CONFORMITY WITH INTERNATIONAL STANDARDS.`), K.W - 20);
    if (y + stmt.length * 9 + 85 > 810) { d.addPage(); y = 50; }
    d.text(stmt, K.MID, y, { align: 'center' });
    y += stmt.length * 9 + 8;
    if (assets().stamp) d.addImage(assets().stamp, 'JPEG', 380, y, 165, 69);
    K.pageNumbers(d);
    return d;
  }

  DocTool.register({
    id: 'coc', group: 'bank', badge: '银行', name: '符合性证书 COC', nameEn: 'Certificate of Conformity',
    description: '上传客户 PI，再上传提单（图片或 PDF），自动生成银行交单用的符合性证书',
    uploadHint: '客户发来的 PI',
    parse: baseParse,
    attachments: [blAttachment],
    validate: (doc) => {
      const out = validateShip(doc, true);
      if (!doc.goodsDesc.length) out.push({ level: 'error', msg: '货物描述为空' });
      if (!doc.route) out.push({ level: 'warn', msg: '运输路线为空' });
      return out;
    },
    title: (doc) => `COC ${doc.invoiceNo || ''}`.trim(),
    stats,
    sections: [
      { title: '基本信息', fields: [{ key: 'invoiceNo', label: '发票号 INVOICE NO' }, { key: 'date', label: '日期 INVOICE DATE' }] },
      { title: '收货人与货物', fields: [
        { key: 'clientLines', label: '收货人 CONSIGNEE（每行一条）', type: 'lines', rows: 6 },
        { key: 'goodsDesc', label: '货物描述 DESCRIPTION OF GOODS（每行一条）', type: 'lines', rows: 6 },
      ] },
      { title: '运输信息', fields: [
        { key: 'blNo', label: '提单号 B/L NO' }, { key: 'vessel', label: '船名航次 VESSEL' },
        { key: 'route', label: '路线 ROUTE' }, { key: 'origin', label: '原产地 ORIGIN' },
        { key: 'packageUnit', label: '包装单位（PACKAGES / CARTONS / BAGS …）' },
      ] },
      containerSection,
    ],
    preview: (doc) => cocPdf(doc).output('blob'),
    exports: [{ id: 'pdf', label: 'PDF', perDoc: true, build: async (docs) => cocPdf(docs[0]).output('blob'), fileName: (docs) => `${safeName(docs[0].invoiceNo)} COC.pdf` }],
  });

  window.BankDocs = { plPdf, cocPdf, totals, baseParse, blAttachment };
})();
