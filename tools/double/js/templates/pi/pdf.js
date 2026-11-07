// 按公司模版生成 PDF（A4，矢量文字，可复制可搜索）
(function (root) {
  const BLACK = [0, 0, 0];
  const GREY = [236, 236, 236];
  const L = 25; // 左边距
  const R = 570; // 右边界
  const W = R - L;

  // jsPDF 内置字体只支持西文（含 é è à 等），把全角/特殊符号转成普通符号
  const safe = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/，/g, ', ')
      .replace(/：/g, ':')
      .replace(/．/g, '.')
      .replace(/ /g, ' ');

  const money = (x) => '$' + Number(x || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qtyFmt = (x) => (x === null || x === undefined || x === '' ? '' : String(Number(x)));

  function drawHeader(doc, pi, cfg, assets, title) {
    if (assets && assets.logo) doc.addImage(assets.logo, 'JPEG', L, 20, 52, 39);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(0);
    doc.text(safe(cfg.company.name), 85, 33);
    doc.setFont('helvetica', 'normal').setFontSize(5.8);
    cfg.company.lines.forEach((t, i) => doc.text(safe(t), 85, 42 + i * 6.5));

    // 右上角：发票号 / 日期
    const bx = 398, by = 18, lw = 78, vw = R - bx - lw, rh = 26;
    [['INVOICE NO:', pi.invoiceNo], ['INVOICE DATE:', pi.date]].forEach(([k, v], i) => {
      const y = by + i * rh;
      doc.setFillColor(...BLACK).rect(bx, y, lw, rh, 'F');
      doc.setFillColor(...GREY).rect(bx + lw, y, vw, rh, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255);
      doc.text(k, bx + 6, y + rh / 2 + 3);
      doc.setTextColor(0).setFontSize(9);
      doc.text(safe(v), bx + lw + 6, y + rh / 2 + 3);
    });

    doc.setFont('helvetica', 'bold').setFontSize(23).setTextColor(0);
    doc.text(title || 'PROFORMA INVOICE', 297.6, 108, { align: 'center' });
    doc.setFontSize(7.5).text('(ORIGINAL)', 297.6, 123, { align: 'center' });
  }

  function infoBox(doc, x, y, w, h, title, lines, step = 13) {
    doc.setFillColor(...GREY).rect(x, y, w, h, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0);
    doc.text(title, x + 4, y + 11);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    lines.forEach((t, i) => doc.text(t, x + 4, y + 24 + i * step));
  }
  const wrapLines = (doc, lines, w) => { doc.setFont('helvetica', 'normal').setFontSize(7.5); return lines.flatMap((t) => doc.splitTextToSize(safe(t), w)); };

  // 尽量一页排完：先按正常间距排，超过一页就逐步收紧行距再试；明细实在太多才分页
  function buildPdf(jsPDF, pi, cfg, assets, opts = {}) {
    for (const k of [1, 0.85, 0.72, 0.6]) {
      const d = render(jsPDF, pi, cfg, assets, opts, k);
      if (d.getNumberOfPages() === 1) return d;
    }
    return render(jsPDF, pi, cfg, assets, opts, 1);
  }

  function render(jsPDF, pi, cfg, assets, opts, k) {
    const sp = (x, min = 0) => Math.max(min, x * k);
    const P = root.PIParser;
    const tot = P.computeTotals(pi);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PH = doc.internal.pageSize.getHeight();
    const BOTTOM = PH - 40;

    drawHeader(doc, pi, cfg, assets, opts.title);

    // 客户 / 银行信息
    const cl = wrapLines(doc, pi.clientLines, 285 - 8), bl = wrapLines(doc, pi.bankLines, R - 330 - 8);
    const step = sp(13, 9.5);
    const boxH = Math.max(sp(100, 70), 30 + Math.max(cl.length, bl.length) * step);
    infoBox(doc, L, 152, 285, boxH, 'INFORMATIONS DE CLIENT', cl, step);
    infoBox(doc, 330, 152, R - 330, boxH, 'INFORMATIONS DE BANQUE', bl, step);

    // 产品表
    const body = pi.items.map((it, i) => [
      String(i + 1),
      safe(it.desc),
      qtyFmt(it.qty),
      safe(it.unit),
      money(it.price),
      money(tot.lines[i]),
    ]);
    const headCell = (t, sub) => ({ content: sub ? `${t}\n${sub}` : t });
    doc.autoTable({
      startY: 152 + boxH + sp(20, 10),
      margin: { left: L, right: 595.28 - R, top: 30, bottom: 45 },
      head: [[headCell('NO'), headCell('DESIGNATION'), headCell('QUANTITÉ'), headCell('UNITÉ'), headCell('Prix Unitaire', '(USD)'), headCell('Montant', '(USD)')]],
      body,
      theme: 'grid',
      showHead: 'everyPage',
      styles: { font: 'helvetica', fontSize: 7.5, textColor: 0, lineColor: 0, lineWidth: 0.6, cellPadding: { top: sp(3.5, 1.6), bottom: sp(3.5, 1.6), left: 3, right: 3 }, valign: 'middle' },
      headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7.5, minCellHeight: sp(24, 18) },
      columnStyles: {
        0: { halign: 'center', cellWidth: 40 },
        1: { halign: 'left', cellWidth: 220 },
        2: { halign: 'center', cellWidth: 65 },
        3: { halign: 'center', cellWidth: 55 },
        4: { halign: 'right', cellWidth: 82.5 },
        5: { halign: 'right', cellWidth: 82.5 },
      },
      didParseCell: (d) => {
        if (d.section === 'head' && d.column.index >= 4) d.cell.styles.fontSize = 7;
      },
    });
    let y = doc.lastAutoTable.finalY + sp(14, 8);

    const ensure = (h) => {
      if (y + h > BOTTOM) { doc.addPage(); y = 40; }
    };

    // 合计框（行数、名称来自「金额汇总」，可编辑）
    const totals = tot.summary.map((x) => [safe(x.label), money(x.value)]);
    const rs = sp(17, 12);
    const bh = Math.max(1, totals.length) * rs + 7;
    ensure(bh + 2);
    const tx = 248;
    doc.setDrawColor(0).setLineWidth(0.6).rect(tx, y, R - tx, bh);
    doc.line(R - 75, y, R - 75, y + bh);
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    totals.forEach(([k, v], i) => {
      const ly = y + rs - 3 + i * rs;
      doc.text(k, R - 80, ly, { align: 'right' });
      doc.text(v, R - 3, ly, { align: 'right' });
    });
    y += bh + sp(14, 8);

    // 条款
    const terms = [
      ['PAYS D\'ORIGINE: ', pi.origin, false],
      ['LOADING PORT: ', pi.loadingPort, true],
      ['DESTINATION PORT: ', pi.destinationPort, true],
      ['MODE DE PAIEMENT: ', pi.payment, true],
      ['SHIPMENT: ', pi.shipment, false],
      ['DOCUMENTS: ', '', false],
      ...pi.documents.map((d) => ['', d, false]),
      ...pi.otherTerms.map((d) => ['', d, false]),
    ];
    const ts = sp(13.5, 10);
    const termH = 10 + terms.length * ts;
    ensure(termH);
    doc.setFillColor(...GREY).rect(L, y, W, termH, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    terms.forEach(([k, v, underline], i) => {
      const ly = y + 13 + i * ts;
      const key = safe(k).trim();
      doc.text(key, L + 4, ly);
      const kx = L + 4 + (key ? doc.getTextWidth(key) + 3 : 0);
      doc.text(safe(v), kx, ly, { maxWidth: W - (kx - L) - 4 });
      if (underline && v) {
        const vw = doc.getTextWidth(safe(v));
        doc.setLineWidth(0.5).line(kx, ly + 1.5, kx + vw, ly + 1.5);
      }
    });
    y += termH + sp(22, 12);

    // 公司收款账户 + 签章
    const b = cfg.beneficiary;
    const bank = [
      'BENEFICIARY NAME: ' + b.name,
      'BENEFICIARY ACCOUNT NO: ' + b.accountNo,
      'BENEFICIARY BANK: ' + b.bank,
      'ADDRESS: ' + b.address,
      'BENEFICIARY BANK SWIFT CODE NO.:' + b.swift,
      'INTERMEDIARY BANK:' + b.intermediaryBank,
      'INTERMEDIARY BANK SWIFT CODE NO: ' + b.intermediarySwift,
    ];
    const bs = sp(13.5, 10);
    ensure(Math.max(20 + bank.length * bs, 95));
    doc.setFont('helvetica', 'bold').setFontSize(7.5).text('DETAIL DE COMPTE BANCAIRE', L + 4, y);
    doc.setFont('helvetica', 'normal');
    bank.forEach((t, i) => doc.text(safe(t), L + 4, y + 14 + i * bs));
    if (assets && assets.stamp) doc.addImage(assets.stamp, 'JPEG', 370, y + sp(22, 8), 165, 69);

    // 页码
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(90);
      doc.text(`${p}/${n}`, 297.6, PH - 18, { align: 'center' });
      doc.setTextColor(0);
    }
    return doc;
  }

  root.PIPdf = { buildPdf, money };
})(typeof window !== 'undefined' ? window : globalThis);
