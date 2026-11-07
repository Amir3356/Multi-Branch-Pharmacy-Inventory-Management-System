// A report as a printable PDF (landscape A4): header, cards matching the screen StatCards,
// charts in a 2x2 grid, then every table. It draws the same spec as the page, so the PDF and
// the screen always show the same figures and visual styling.

const TONES = {
  cyan: [31, 122, 77],
  teal: [23, 96, 60],
  green: [26, 107, 66],
  amber: [212, 147, 15],
  orange: [210, 105, 42],
  rose: [210, 67, 47],
  violet: [122, 89, 196],
  slate: [122, 133, 126],
  'role-1': [57, 135, 229],
  'role-2': [217, 89, 38],
  'role-3': [25, 158, 112],
  'role-4': [201, 133, 0],
  'status-good': [12, 163, 12],
  'status-warning': [217, 161, 15],
  'status-serious': [169, 84, 31],
  'status-neutral': [95, 107, 99],
  'status-critical': [208, 59, 59]
}

const INK = [28, 38, 32]
const MUTED = [95, 107, 99]
const GRID = [227, 223, 211]
const HEAD = [31, 122, 77]
const BORDER = [227, 223, 211]
const MARGIN = 40

const fill = (doc, tone) => doc.setFillColor(...(TONES[tone] || MUTED))
const plain = (v) => Number(v).toLocaleString('en-US')
// Money on a chart axis: "12.5K", "1.2M"
const short = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K` : plain(Math.round(v)))

// ---- Stat Cards ----

function drawStatCard(doc, card, x, y, w, h) {
  doc.setFillColor(255, 255, 255).setDrawColor(...BORDER).setLineWidth(0.8).roundedRect(x, y, w, h, 6, 6, 'FD')
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...MUTED).text(card.title, x + 10, y + 14)

  // Tone indicator in top-right
  const isWarn = card.tone === 'warning'
  const isDang = card.tone === 'danger'
  const iconBg = isWarn ? [254, 243, 199] : isDang ? [254, 237, 235] : [235, 246, 240]
  const iconFg = isWarn ? [180, 83, 9] : isDang ? [185, 28, 28] : [31, 122, 77]
  doc.setFillColor(...iconBg).roundedRect(x + w - 24, y + 7, 16, 16, 4, 4, 'F')
  doc.setFillColor(...iconFg).circle(x + w - 16, y + 15, 3, 'F')

  // Big Value
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK).text(String(card.value), x + 10, y + 32)

  // Chip pill
  if (card.chip) {
    const chipText = doc.splitTextToSize(String(card.chip), w - 24)[0]
    doc.setFont('helvetica', 'normal').setFontSize(6.5)
    const chipW = Math.min(w - 20, doc.getTextWidth(chipText) + 8)
    const isPos = card.chipTone === 'positive'
    const isNeg = card.chipTone === 'negative'
    const bg = isPos ? [235, 246, 240] : isNeg ? [254, 237, 235] : [241, 245, 249]
    const fg = isPos ? [26, 107, 66] : isNeg ? [179, 54, 31] : [74, 87, 79]
    doc.setFillColor(...bg).roundedRect(x + 10, y + 38, chipW, 11, 3, 3, 'F')
    doc.setTextColor(...fg).text(chipText, x + 14, y + 46)
  }
}

// ---- Charts ----

function slice(doc, cx, cy, r, a, b) {
  const steps = Math.max(2, Math.ceil((b - a) * 120))
  const points = [[cx, cy]]
  for (let i = 0; i <= steps; i++) {
    const t = (a + ((b - a) * i) / steps) * 2 * Math.PI
    points.push([cx + r * Math.sin(t), cy - r * Math.cos(t)])
  }
  doc.lines(points.slice(1).map(([x, y], i) => [x - points[i][0], y - points[i][1]]), cx, cy, [1, 1], 'FD', true)
}

function pie(doc, cx, cy, r, items) {
  const shown = items.filter((i) => i.value > 0)
  const total = shown.reduce((t, i) => t + i.value, 0)
  doc.setDrawColor(255).setLineWidth(1)
  let start = 0
  for (const item of shown) {
    const end = start + item.value / total
    fill(doc, item.tone)
    if (end - start >= 0.9999) doc.circle(cx, cy, r, 'F')
    else slice(doc, cx, cy, r, start, end)
    start = end
  }
}

function legend(doc, x, y, width, items, format, withShare) {
  const total = items.reduce((t, i) => t + i.value, 0)
  doc.setFontSize(7.5)
  items.forEach((item, i) => {
    const ly = y + i * 12
    fill(doc, item.tone)
    doc.rect(x, ly - 6, 7, 7, 'F')
    doc.setTextColor(...INK).text(doc.splitTextToSize(item.label, width - 95)[0], x + 11, ly)
    const value = withShare && total ? `${format(item.value)}  (${Math.round((item.value / total) * 100)}%)` : format(item.value)
    doc.setFont('helvetica', 'bold').text(value, x + width, ly, { align: 'right' }).setFont('helvetica', 'normal')
  })
}

function drawPieChart(doc, chart, x, y, w, h, format, donut) {
  const total = chart.items.reduce((t, i) => t + i.value, 0)
  const r = Math.min(48, (h - 40) / 2)
  const cx = x + 18 + r
  const cy = y + 38 + r
  if (!total) return empty(doc, chart, x, y, w, h)
  pie(doc, cx, cy, r, chart.items)
  if (donut) {
    doc.setFillColor(255).circle(cx, cy, r * 0.62, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK).text(plain(total), cx, cy + 3, { align: 'center' })
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...MUTED).text(chart.unit || '', cx, cy + 11, { align: 'center' })
  }
  legend(doc, cx + r + 16, y + 46, w - (cx + r + 16 - x) - 12, chart.items, donut ? plain : format, !donut)
}

function drawHBars(doc, chart, x, y, w, h, format) {
  const items = chart.items.slice(0, Math.floor((h - 44) / 16))
  if (!items.length || items.every((i) => !i.value)) return empty(doc, chart, x, y, w, h)
  const max = Math.max(...items.map((i) => i.value), 1)
  const labelW = Math.min(100, w * 0.3)
  const valueW = 100
  const trackW = w - 24 - labelW - valueW
  items.forEach((item, i) => {
    const ly = y + 42 + i * 16
    // Long labels ("GreenLife Pharmacy · Received") wrap onto a second line instead of being cut off
    const lines = doc.setFontSize(7.5).setTextColor(...INK).splitTextToSize(item.label, labelW - 4).slice(0, 2)
    if (lines.length === 1) doc.text(lines[0], x + 12, ly + 3)
    else doc.setFontSize(6.5).text(lines, x + 12, ly - 1, { lineHeightFactor: 1.1 }).setFontSize(7.5)
    doc.setFillColor(...GRID).roundedRect(x + 12 + labelW, ly - 3, trackW, 6, 2, 2, 'F')
    fill(doc, item.tone)
    if (item.value > 0) doc.roundedRect(x + 12 + labelW, ly - 3, Math.max(3, (trackW * item.value) / max), 6, 2, 2, 'F')
    doc.setFont('helvetica', 'bold').text(format(item.value), x + w - 12 - (item.detail ? 48 : 0), ly + 3, { align: 'right' }).setFont('helvetica', 'normal')
    if (item.detail) doc.setFontSize(6.5).setTextColor(...MUTED).text(item.detail, x + w - 12, ly + 3, { align: 'right' })
  })
}

// Whole-number-friendly axis steps
const niceStep = (max, whole) => {
  const rough = Math.max(max / 4, whole ? 1 : 0)
  const power = 10 ** Math.floor(Math.log10(rough || 1))
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((v) => v >= rough && (!whole || Number.isInteger(v))) || rough
}

function drawBars(doc, chart, x, y, w, h, format, isMoney) {
  const { columns, series } = chart
  const max = Math.max(0, ...columns.flatMap((c) => c.values))
  if (!max) return empty(doc, chart, x, y, w, h)
  const plot = { left: x + 40, right: x + w - 12, top: y + 42, bottom: y + h - 34 }
  const step = niceStep(max, chart.wholeNumbers)
  const top = Math.ceil(max / step) * step
  const yAt = (v) => plot.bottom - ((plot.bottom - plot.top) * v) / (top || 1)
  doc.setFontSize(6.5)
  for (let v = 0; v <= top + step / 2; v += step) {
    doc.setDrawColor(...GRID).setLineWidth(0.5).line(plot.left, yAt(v), plot.right, yAt(v))
    doc.setTextColor(...MUTED).text(isMoney ? short(v) : plain(v), plot.left - 4, yAt(v) + 2, { align: 'right' })
  }
  const groupW = (plot.right - plot.left) / columns.length
  const barW = Math.max(2, Math.min(18, (groupW - 6) / series.length - 2))
  const labelEvery = Math.ceil(columns.length / 12)
  columns.forEach((c, ci) => {
    const gx = plot.left + ci * groupW + (groupW - (barW + 2) * series.length + 2) / 2
    c.values.forEach((v, si) => {
      if (!v) return
      fill(doc, series[si]?.tone)
      doc.roundedRect(gx + si * (barW + 2), yAt(v), barW, Math.max(1, plot.bottom - yAt(v)), 1, 1, 'F')
      if (columns.length * series.length <= 16) {
        doc.setFontSize(6).setTextColor(...INK).text(isMoney ? short(v) : plain(v), gx + si * (barW + 2) + barW / 2, yAt(v) - 2, { align: 'center' })
      }
    })
    if (ci % labelEvery === 0) {
      doc.setFontSize(6.5).setTextColor(...MUTED).text(doc.splitTextToSize(c.label, groupW * labelEvery - 2)[0], plot.left + ci * groupW + groupW / 2, plot.bottom + 9, { align: 'center' })
    }
  })
  doc.setFontSize(7)
  let lx = plot.left
  series.forEach((s) => {
    fill(doc, s.tone)
    doc.rect(lx, y + h - 16, 6, 6, 'F')
    doc.setTextColor(...INK).text(s.label, lx + 9, y + h - 11)
    lx += doc.getTextWidth(s.label) + 24
  })
}

function empty(doc, chart, x, y, w, h) {
  doc.setFontSize(8).setTextColor(...MUTED).text(chart.empty || 'Nothing to show.', x + w / 2, y + h / 2 + 10, { align: 'center' })
}

// A headline figure: a badge (green tick when none, orange cross when some), the big count, then who it is about
function drawHeadline(doc, chart, x, y, w, h) {
  const cx = x + w / 2
  const warn = chart.count > 0
  fill(doc, warn ? 'status-serious' : 'status-good')
  doc.circle(cx, y + 48, 12, 'F')
  doc.setDrawColor(255).setLineWidth(2.2)
  if (warn) doc.line(cx - 5, y + 43, cx + 5, y + 53).line(cx + 5, y + 43, cx - 5, y + 53)
  else doc.line(cx - 5, y + 48, cx - 2, y + 52).line(cx - 2, y + 52, cx + 5, y + 44)
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...INK).text(String(chart.count), cx, y + 84, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(chart.label, cx, y + 95, { align: 'center' })
  if (!warn) return
  const fits = Math.floor((h - 110) / 18)
  chart.list.slice(0, fits).forEach((item, i) => {
    const ly = y + 112 + i * 18
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...INK).text(item.name, x + 14, ly, { maxWidth: w - 28 })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(item.why, x + 14, ly + 8, { maxWidth: w - 28 })
  })
  if (chart.list.length > fits) doc.setFontSize(7).text(`+ ${chart.list.length - fits} more (see the table)`, x + 14, y + h - 8)
}

function chartPanel(doc, chart, x, y, w, h, money) {
  doc.setFillColor(255, 255, 255).setDrawColor(...BORDER).setLineWidth(0.8).roundedRect(x, y, w, h, 6, 6, 'FD')
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...INK).text(chart.title, x + 12, y + 17)
  if (chart.subtitle) {
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(chart.subtitle, x + w - 12, y + 17, { align: 'right' })
  }
  doc.setFont('helvetica', 'normal')
  const format = chart.money ? money : plain
  if (chart.kind === 'headline') drawHeadline(doc, chart, x, y, w, h)
  else if (chart.kind === 'pie') drawPieChart(doc, chart, x, y, w, h, format, false)
  else if (chart.kind === 'donut') drawPieChart(doc, chart, x, y, w, h, format, true)
  else if (chart.kind === 'hbar') drawHBars(doc, chart, x, y, w, h, format)
  else drawBars(doc, chart, x, y, w, h, format, chart.money)
}

// ---- Document ----

// jsPDF's built-in font only has basic Latin characters: swap the few the screen uses that it can't draw
const PDF_SAFE = [[/−/g, '-'], [/▲/g, '+'], [/▼/g, '-'], [/→/g, '->'], [/×/g, 'x']]
const pdfText = (value) => (typeof value === 'string' ? PDF_SAFE.reduce((text, [from, to]) => text.replace(from, to), value) : value)
const pdfSafe = (value) => (Array.isArray(value) ? value.map(pdfSafe) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pdfSafe(v)])) : pdfText(value))

/** Builds the report as a jsPDF document (also used to check the output without downloading) */
export function buildReportPdf({ title, description, spec: screenSpec, periodText, scope }, { jsPDF, autoTable }, money) {
  const spec = pdfSafe(screenSpec)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const width = pageW - MARGIN * 2
  const centerX = pageW / 2

  // 1. Centered Header (matching centered PageHeader on screen)
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...INK).text(`${title} · ${scope}`, centerX, 30, { align: 'center' })
  if (description) {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(description, centerX, 42, { align: 'center', maxWidth: width })
  }
  const scopeY = description ? 54 : 44
  const scopeLine = `${periodText} · ${scope}${spec.note ? ` · ${spec.note}` : ''} · Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(scopeLine, centerX, scopeY, { align: 'center', maxWidth: width })

  // 2. Stat Cards (drawn as actual cards with borders, values, chips)
  const cardsY = scopeY + 11
  const cardH = 54
  const cardGap = 10
  const cardW = (width - cardGap * (spec.cards.length - 1)) / spec.cards.length
  spec.cards.forEach((card, i) => {
    drawStatCard(doc, card, MARGIN + i * (cardW + cardGap), cardsY, cardW, cardH)
  })

  // 3. Charts in 2 by 2 grid
  const chartGap = 12
  const chartW = (width - chartGap) / 2
  const chartH = 170
  let chartStartY = cardsY + cardH + 13
  spec.charts.forEach((chart, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cy = chartStartY + row * (chartH + chartGap)
    if (cy + chartH > pageH - 25) {
      doc.addPage()
      chartStartY = MARGIN
    }
    const actualY = cy + chartH > pageH - 25 ? chartStartY + (row % 2) * (chartH + chartGap) : cy
    chartPanel(doc, chart, MARGIN + col * (chartW + chartGap), actualY, chartW, chartH, money)
  })

  // 4. Tables start on Page 2
  if (spec.tables.length > 0) {
    doc.addPage()
    let y = MARGIN
    spec.tables.forEach((table) => {
      if (y > pageH - 90) {
        doc.addPage()
        y = MARGIN
      }
      // Centered Table Title
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(table.title, centerX, y, { align: 'center' })
      if (table.note) {
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(table.note, centerX, y + 10, { align: 'center' })
        y += 12
      }
      const align = Object.fromEntries(table.columns.map((c, j) => [j, { halign: c.align === 'right' ? 'right' : 'left' }]))
      autoTable(doc, {
        startY: y + 6,
        head: [table.columns.map((c) => c.label)],
        body: table.rows.length ? table.rows : [[{ content: table.empty, colSpan: table.columns.length, styles: { halign: 'center', textColor: MUTED } }]],
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 5, valign: 'middle', textColor: INK },
        headStyles: { fillColor: HEAD, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 246] },
        columnStyles: align,
        didParseCell: (cell) => {
          if (cell.section === 'body' && table.strongRows?.includes(cell.row.index)) {
            cell.cell.styles.fontStyle = 'bold'
            cell.cell.styles.fillColor = [240, 246, 242]
          }
          if (cell.section === 'head') cell.cell.styles.halign = align[cell.column.index]?.halign || 'left'
        }
      })
      y = doc.lastAutoTable.finalY + 12
      if (table.footnote) {
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(table.footnote, centerX, y + 2, { align: 'center', maxWidth: width })
        y += 14
      }
      y += 14
    })
  }

  // Footer: Page numbers
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page).setFontSize(8).setTextColor(...MUTED)
    doc.text(`${title} · Page ${page} of ${pages}`, pageW - MARGIN, pageH - 18, { align: 'right' })
  }
  return doc
}

/** Downloads the report as a PDF; jsPDF loads only when someone exports */
export async function exportReportPdf({ title, description, spec, periodText, scope, kind, from, to }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  // Plain "ETB 1,234.00": jsPDF's built-in font has no special characters
  const money = (v) => `ETB ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  buildReportPdf({ title, description, spec, periodText, scope }, { jsPDF, autoTable }, money).save(`${kind}-report-${from}-to-${to}.pdf`)
}
