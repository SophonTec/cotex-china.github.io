// PDF 公共部件：公司抬头、单号框、标题、灰底信息框、页码。各单证模版共用，保证版式统一。
(function (root) {
  const L = 25, R = 570, W = R - L, MID = 297.6;
  const BLACK = [0, 0, 0], GREY = [236, 236, 236];

  const safe = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/，/g, ', ').replace(/：/g, ':')
    .replace(/．/g, '.').replace(/、/g, ', ').replace(/（/g, '(').replace(/）/g, ')').replace(/ /g, ' ')
    .replace(/[^\x00-\xff€’]/g, ''); // 内置字体不支持中文，去掉
  const money = (x, cur = '$') => (x === null || x === undefined || x === '' || isNaN(x)) ? '' :
    cur + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (x, d = 0) => (x === null || x === undefined || x === '' || isNaN(x)) ? '' :
    Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  function newDoc() {
    const doc = new root.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'normal').setTextColor(0);
    return doc;
  }

  // 公司抬头 + 右上角单号框 + 标题
  function header(doc, { company, logo, boxes, title, subtitle = '(ORIGINAL)' }) {
    if (logo) doc.addImage(logo, 'JPEG', L, 20, 52, 39);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(0);
    doc.text(safe(company.name), 85, 33);
    doc.setFont('helvetica', 'normal').setFontSize(5.8);
    company.lines.forEach((t, i) => doc.text(safe(t), 85, 42 + i * 6.5));
    const bx = 398, lw = 78, vw = R - bx - lw, rh = 26 * 2 / Math.max(boxes.length, 2);
    boxes.forEach(([k, v], i) => {
      const y = 18 + i * rh;
      doc.setFillColor(...BLACK).rect(bx, y, lw, rh, 'F');
      doc.setFillColor(...GREY).rect(bx + lw, y, vw, rh, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255).text(safe(k), bx + 6, y + rh / 2 + 3);
      doc.setTextColor(0).setFontSize(9).text(safe(v), bx + lw + 6, y + rh / 2 + 3);
    });
    doc.setFont('helvetica', 'bold').setFontSize(title.length > 22 ? 19 : 23).setTextColor(0);
    doc.text(safe(title), MID, 108, { align: 'center' });
    if (subtitle) doc.setFontSize(7.5).text(subtitle, MID, 123, { align: 'center' });
  }

  function infoBox(doc, x, y, w, h, title, lines) {
    doc.setFillColor(...GREY).rect(x, y, w, h, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0).text(safe(title), x + 4, y + 11);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    wrap(doc, lines, w - 8).forEach((t, i) => doc.text(t, x + 4, y + 24 + i * 12));
  }
  const wrap = (doc, lines, w) => { doc.setFontSize(7.5); return lines.flatMap((t) => doc.splitTextToSize(safe(t), w)); };

  function twoBoxes(doc, y, left, right, k = 1) {
    const n = Math.max(wrap(doc, left.lines, 285 - 8).length, wrap(doc, right.lines, R - 330 - 8).length);
    const h = Math.max(Math.max(70, 100 * k), 30 + n * 12);
    infoBox(doc, L, y, 285, h, left.title, left.lines);
    infoBox(doc, 330, y, R - 330, h, right.title, right.lines);
    return y + h;
  }

  function pageNumbers(doc) {
    const n = doc.getNumberOfPages(), PH = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(90).text(`${p}/${n}`, MID, PH - 18, { align: 'center' });
      doc.setTextColor(0);
    }
  }

  const tableStyles = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, textColor: 0, lineColor: 0, lineWidth: 0.6, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 }, valign: 'middle' },
    headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7.5, minCellHeight: 24 },
    margin: { left: L, right: 595.28 - R, top: 30, bottom: 45 },
    showHead: 'everyPage',
  };

  // 尽量一页排完：build(k) 里 k 是间距系数（1 = 正常，越小越紧凑）。都排不下就用正常间距分页
  function fitOnePage(build) {
    for (const k of [1, 0.85, 0.72, 0.6]) {
      const d = build(k);
      if (d.getNumberOfPages() === 1) return d;
    }
    return build(1);
  }
  const pad = (k) => ({ top: Math.max(1.6, 3.5 * k), bottom: Math.max(1.6, 3.5 * k), left: 3, right: 3 });

  root.PdfKit = { fitOnePage, pad, L, R, W, MID, GREY, BLACK, safe, money, fmt, newDoc, header, infoBox, twoBoxes, pageNumbers, tableStyles };
})(typeof window !== 'undefined' ? window : globalThis);
