"use strict";
const Payroll     = require("../models/Payroll");
const User        = require("../models/User");
const Attendance  = require("../models/Attendance");
const Leave       = require("../models/Leave");
const PDFDocument = require("pdfkit");
const path        = require("path");
const fs          = require("fs");

/* ─── Logo path ────────────────────────────────────────────── */
const LOGO_PATH = path.resolve(__dirname, "..", "..", "src", "assets", "hrms-login.png");

/* ─── Draw Quibo Tech Logo (PDFKit vector) ─────────────────── */
// Draws the exact Quibo Tech logo:
//   - Large black outer ring (donut)
//   - Black inner circle (offset upper-left inside the ring)
//   - Orange crescent arc (lower-right quadrant)
//   - Small orange dot (lower-right)
function drawQuiboLogo(doc, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const R  = size / 2;          // outer radius
  const strokeW = R * 0.28;     // ring stroke thickness

  doc.save();

  // 1. Large black outer ring (drawn as a thick-stroked circle)
  doc.circle(cx, cy, R - strokeW / 2)
     .lineWidth(strokeW)
     .strokeColor("#1a1a1a")
     .stroke();

  // 2. Black inner circle — offset upper-left
  const innerR  = R * 0.38;
  const offsetX = -R * 0.18;
  const offsetY = -R * 0.18;
  doc.circle(cx + offsetX, cy + offsetY, innerR)
     .fillColor("#1a1a1a")
     .fill();

  // 3. Orange crescent arc — lower-right quadrant of the ring
  //    Drawn as a thick arc from ~330° to ~90° (going clockwise through 0°)
  //    PDFKit arc: arc(x, y, radius, startAngle, endAngle, anticlockwise)
  //    angles in radians, 0 = right, going clockwise
  const arcStartDeg = 310;
  const arcEndDeg   = 100;
  const arcStartRad = (arcStartDeg * Math.PI) / 180;
  const arcEndRad   = (arcEndDeg   * Math.PI) / 180;
  const arcR        = R - strokeW / 2;

  doc.path(
    arcPath(cx, cy, arcR, arcStartRad, arcEndRad, false)
  )
  .lineWidth(strokeW)
  .strokeColor("#f97316")
  .stroke();

  // 4. Small orange dot — lower-right
  const dotR  = R * 0.13;
  const dotCx = cx + R * 0.52;
  const dotCy = cy + R * 0.52;
  doc.circle(dotCx, dotCy, dotR)
     .fillColor("#f97316")
     .fill();

  doc.restore();
}

// Helper: generate SVG arc path string for PDFKit .path()
function arcPath(cx, cy, r, startAngle, endAngle, anticlockwise) {
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX   = cx + r * Math.cos(endAngle);
  const endY   = cy + r * Math.sin(endAngle);

  // large-arc-flag: 1 if arc > 180 degrees
  let delta = endAngle - startAngle;
  if (anticlockwise) delta = -delta;
  if (delta < 0)     delta += 2 * Math.PI;
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep    = anticlockwise ? 0 : 1;

  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
}

/* ─── Quibo Tech logo as inline SVG for email HTML ─────────── */
function quiboLogoSVG(size = 50) {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size / 2;
  const strokeW = R * 0.28;

  // Inner circle offset
  const innerR  = R * 0.38;
  const icx     = cx - R * 0.18;
  const icy     = cy - R * 0.18;

  // Orange arc: from 310° to 100° clockwise
  const arcR   = R - strokeW / 2;
  const startRad = (310 * Math.PI) / 180;
  const endRad   = (100 * Math.PI) / 180;
  const sx = cx + arcR * Math.cos(startRad);
  const sy = cy + arcR * Math.sin(startRad);
  const ex = cx + arcR * Math.cos(endRad);
  const ey = cy + arcR * Math.sin(endRad);
  // Arc is ~150°, so large-arc = 0, sweep = 1
  const arcD = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;

  // Small dot
  const dotR  = R * 0.13;
  const dcx   = cx + R * 0.52;
  const dcy   = cy + R * 0.52;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer black ring -->
  <circle cx="${cx}" cy="${cy}" r="${(R - strokeW / 2).toFixed(2)}"
    fill="none" stroke="#1a1a1a" stroke-width="${strokeW.toFixed(2)}"/>
  <!-- Inner black circle (upper-left offset) -->
  <circle cx="${icx.toFixed(2)}" cy="${icy.toFixed(2)}" r="${innerR.toFixed(2)}" fill="#1a1a1a"/>
  <!-- Orange crescent arc (lower-right) -->
  <path d="${arcD}" fill="none" stroke="#f97316" stroke-width="${strokeW.toFixed(2)}" stroke-linecap="round"/>
  <!-- Orange dot -->
  <circle cx="${dcx.toFixed(2)}" cy="${dcy.toFixed(2)}" r="${dotR.toFixed(2)}" fill="#f97316"/>
</svg>`;
}

/* ─── Salary Breakdown ─────────────────────────────────────── */
function getSalaryBreakdown(netSalary) {
  const n = Math.round(netSalary);
  if (n <= 10000) {
    const basic      = Math.round(n * 0.50);
    const hra        = Math.round(n * 0.25);
    const medical    = Math.round(n * 0.125);
    const conveyance = n - basic - hra - medical;
    return { basic, hra, medical, conveyance, special: 0, gross: n };
  } else {
    const basic      = Math.round(n * 0.50);
    const hra        = 2000;
    const medical    = 2000;
    const conveyance = 2000;
    const special    = n - basic - hra - medical - conveyance;
    return { basic, hra, medical, conveyance, special: Math.max(0, special), gross: n };
  }
}

/* ─── Number to Words ──────────────────────────────────────── */
function numberToWords(num) {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function inWords(n) {
    if (n === 0)      return "";
    if (n < 20)       return a[n];
    if (n < 100)      return b[Math.floor(n/10)] + (n%10 ? " "+a[n%10] : "");
    if (n < 1000)     return a[Math.floor(n/100)]+" Hundred"+(n%100 ? " "+inWords(n%100) : "");
    if (n < 100000)   return inWords(Math.floor(n/1000))+" Thousand"+(n%1000 ? " "+inWords(n%1000) : "");
    if (n < 10000000) return inWords(Math.floor(n/100000))+" Lakh"+(n%100000 ? " "+inWords(n%100000) : "");
    return inWords(Math.floor(n/10000000))+" Crore"+(n%10000000 ? " "+inWords(n%10000000) : "");
  }
  if (!num || num === 0) return "Zero";
  return inWords(Math.round(num));
}

/* ─── Format money ─────────────────────────────────────────── */
function fmtPDF(n) {
  return "Rs." + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Generate PDF ─────────────────────────────────────────── */
function generatePayslipPDF({
  name, employeeId, role, month,
  workingDays, presentDays, leaveDays,
  netSalary, paymentDate
}) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data",  c => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pW     = 595.28;
    const margin = 40;
    const cW     = pW - margin * 2;

    const monthLabel = (() => {
      try {
        const [yr, mo] = month.split("-");
        return new Date(yr, mo - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      } catch { return month; }
    })();

    const payDateStr = paymentDate
      ? new Date(paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("en-IN",             { day: "2-digit", month: "2-digit", year: "numeric" });

    const bd      = getSalaryBreakdown(netSalary);
    const lopDays = leaveDays || 0;
    const words   = numberToWords(netSalary);

    /* ── White background ── */
    doc.rect(0, 0, pW, 841.89).fill("#ffffff");

    /* ════════ HEADER ════════ */
    const logoSize = 48;
    const logoX    = margin;
    const logoY    = 18;

    // Try to embed the PNG logo first; fall back to vector drawing
    let logoEmbedded = false;
    try {
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, logoX, logoY, { width: logoSize, height: logoSize });
        logoEmbedded = true;
      }
    } catch (err) {
      console.warn("[Payslip PDF] Failed to embed logo:", err.message);
    }

    // Fallback: draw the real Quibo Tech logo as PDFKit vector shapes
    if (!logoEmbedded) {
      drawQuiboLogo(doc, logoX, logoY, logoSize);
    }

    // "Quibo Tech" company name
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(20)
       .text("Quibo Tech", logoX + logoSize + 10, logoY + 6, { lineBreak: false });

    // Address lines
    doc.fillColor("#64748b").font("Helvetica").fontSize(7.5)
       .text("10th Floor, Millennia Business Park Campus II, Dr, MGR Main Rd,",
             logoX + logoSize + 10, logoY + 30)
       .text("Kandhanchavadi, Perungudi, Chennai, Chennai-600096 India",
             logoX + logoSize + 10, logoY + 41);

    // Right: pay slip label
    doc.fillColor("#475569").font("Helvetica").fontSize(9)
       .text("Pay slip For the Month", pW - margin - 160, logoY + 8, { align: "right", width: 160, lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(14)
       .text(monthLabel, pW - margin - 160, logoY + 24, { align: "right", width: 160, lineBreak: false });

    // Divider
    doc.moveTo(margin, 78).lineTo(pW - margin, 78)
       .strokeColor("#e2e8f0").lineWidth(0.8).stroke();

    /* ════════ EMPLOYEE SUMMARY ════════ */
    let y = 90;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9)
       .text("EMPLOYEE SUMMARY", margin, y);
    y += 16;

    const labelX = margin;
    const colonX = margin + 98;
    const valueX = margin + 108;

    const displayEmployeeId = employeeId ? String(employeeId) : "—";

    const details = [
      ["Employee Name", name  || "—"],
      ["Employee ID",   displayEmployeeId],
      ["Pay Period",    monthLabel],
      ["Pay Date",      payDateStr],
    ];

    const detailStartY = y;
    details.forEach(([lbl, val]) => {
      doc.fillColor("#374151").font("Helvetica").fontSize(9)
         .text(lbl, labelX, y, { width: 95, lineBreak: false });
      doc.fillColor("#374151").font("Helvetica").fontSize(9)
         .text(":", colonX, y, { lineBreak: false });
      doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9)
         .text(val, valueX, y, { width: 200, lineBreak: false });
      y += 15;
    });

    /* ── Net Pay box (right side) ── */
    const boxX = pW / 2 + 10;
    const boxY = detailStartY - 4;
    const boxW = pW - margin - boxX;
    const boxH = 82;

    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
       .strokeColor("#d1fae5").lineWidth(1.2).stroke();
    doc.rect(boxX, boxY, 4, boxH).fill("#22c55e");

    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(17)
       .text(fmtPDF(netSalary), boxX + 10, boxY + 12, {
         width:     boxW - 16,
         lineBreak: false,
         align:     "left",
       });

    doc.fillColor("#22c55e").font("Helvetica").fontSize(9)
       .text("Total Net Pay", boxX + 12, boxY + 38, { lineBreak: false });

    doc.save()
       .moveTo(boxX + 12, boxY + 52)
       .lineTo(boxX + boxW - 12, boxY + 52)
       .dash(3, { space: 2 }).strokeColor("#bbf7d0").lineWidth(0.8).stroke()
       .restore();

    doc.fillColor("#64748b").font("Helvetica").fontSize(8.5)
       .text("Paid Days", boxX + 12, boxY + 58, { lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(8.5)
       .text(": " + presentDays, boxX + 72, boxY + 58, { lineBreak: false });
    doc.fillColor("#64748b").font("Helvetica").fontSize(8.5)
       .text("LOP Days", boxX + 12, boxY + 70, { lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(8.5)
       .text(": " + lopDays, boxX + 72, boxY + 70, { lineBreak: false });

    y = Math.max(y, boxY + boxH) + 18;

    /* ════════ EARNINGS / DEDUCTIONS TABLE ════════ */
    const tX    = margin;
    const tW    = cW;
    const halfW = tW / 2;
    const rH    = 22;

    const earningsRows = [
      ["Basic",                bd.basic],
      ["House Rent Allowance", bd.hra],
      ["Medical Allowance",    bd.medical],
      ["Conveyance Allowance", bd.conveyance],
    ];
    if (netSalary > 10000) earningsRows.push(["Special Allowance", bd.special]);

    const deductionRows = [
      ["Income Tax",     0],
      ["Provident Fund", 0],
    ];

    const numRows = Math.max(earningsRows.length, deductionRows.length);
    const tH      = 28 + numRows * rH + 26;

    doc.roundedRect(tX, y, tW, tH, 4)
       .strokeColor("#e2e8f0").lineWidth(0.8).stroke();
    doc.rect(tX, y, tW, 26).fill("#f8fafc");

    const c1 = tX + 8;
    const c2 = tX + halfW - 8;
    const c3 = tX + halfW + 8;
    const c4 = tX + tW - 8;

    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
       .text("EARNINGS",   c1,       y + 9, { lineBreak: false });
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
       .text("AMOUNT",     c2 - 55,  y + 9, { width: 55, align: "right", lineBreak: false });
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
       .text("DEDUCTIONS", c3,       y + 9, { lineBreak: false });
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
       .text("AMOUNT",     c4 - 55,  y + 9, { width: 55, align: "right", lineBreak: false });

    doc.moveTo(tX + halfW, y).lineTo(tX + halfW, y + tH)
       .strokeColor("#e2e8f0").lineWidth(0.8).stroke();
    doc.moveTo(tX, y + 26).lineTo(tX + tW, y + 26)
       .strokeColor("#e2e8f0").lineWidth(0.5).stroke();

    let rowY = y + 26;
    for (let i = 0; i < numRows; i++) {
      if (i % 2 === 0) doc.rect(tX, rowY, tW, rH).fill("#fafafa");

      if (earningsRows[i]) {
        doc.fillColor("#374151").font("Helvetica").fontSize(8.5)
           .text(earningsRows[i][0], c1, rowY + 7, { width: halfW - 70, lineBreak: false });
        doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(8.5)
           .text(fmtPDF(earningsRows[i][1]), c2 - 60, rowY + 7, { width: 58, align: "right", lineBreak: false });
      }
      if (deductionRows[i]) {
        doc.fillColor("#374151").font("Helvetica").fontSize(8.5)
           .text(deductionRows[i][0], c3, rowY + 7, { width: halfW - 70, lineBreak: false });
        doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(8.5)
           .text(fmtPDF(deductionRows[i][1]), c4 - 60, rowY + 7, { width: 58, align: "right", lineBreak: false });
      }

      rowY += rH;
      doc.moveTo(tX, rowY).lineTo(tX + tW, rowY)
         .strokeColor("#f1f5f9").lineWidth(0.3).stroke();
    }

    // Totals row
    doc.rect(tX, rowY, tW, 26).fill("#f1f5f9");
    doc.moveTo(tX, rowY).lineTo(tX + tW, rowY)
       .strokeColor("#e2e8f0").lineWidth(0.8).stroke();

    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9)
       .text("Gross Earnings", c1, rowY + 8, { lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9)
       .text(fmtPDF(bd.gross), c2 - 60, rowY + 8, { width: 58, align: "right", lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9)
       .text("Total Deductions", c3, rowY + 8, { lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9)
       .text(fmtPDF(0), c4 - 60, rowY + 8, { width: 58, align: "right", lineBreak: false });

    y = rowY + 26 + 12;

    /* ════════ NET PAYABLE BOX ════════ */
    const npH = 38;
    doc.roundedRect(tX, y, tW, npH, 4)
       .strokeColor("#e2e8f0").lineWidth(0.8).stroke();
    doc.rect(tX, y, tW, npH).fill("#f8fafc");

    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9.5)
       .text("TOTAL NET PAYABLE", tX + 12, y + 8, { lineBreak: false });
    doc.fillColor("#64748b").font("Helvetica").fontSize(7.5)
       .text("Gross Earnings - Total Deductions", tX + 12, y + 23, { lineBreak: false });

    doc.fillColor("#16a34a").font("Helvetica-Bold").fontSize(13)
       .text(fmtPDF(netSalary), tX + tW - 130, y + 11, {
         width:     120,
         align:     "right",
         lineBreak: false,
       });

    y += npH + 14;

    /* ════════ AMOUNT IN WORDS ════════ */
    doc.fillColor("#64748b").font("Helvetica").fontSize(8)
       .text("Amount In Words: ", tX + tW - 360, y, { continued: true, lineBreak: false });
    doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(8)
       .text("Indian Rupee " + words + " Only", { lineBreak: false });

    y += 28;

    /* ════════ DIVIDER ════════ */
    doc.moveTo(margin, y).lineTo(pW - margin, y)
       .strokeColor("#e2e8f0").lineWidth(0.8).stroke();
    y += 16;

    /* ════════ FOOTER ════════ */
    doc.fillColor("#64748b").font("Helvetica").fontSize(8)
       .text("-- This is a system-generated document. --", 0, y, { align: "center", width: pW, lineBreak: false });

    y += 30;
    doc.moveTo(margin, y).lineTo(pW - margin, y)
       .strokeColor("#e2e8f0").lineWidth(0.4).stroke();
    y += 12;
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7)
       .text("Quibo Tech  |  HRMS  |  Confidential", 0, y, { align: "center", width: pW, lineBreak: false });

    doc.end();
  });
}

/* ─── Send Email via Brevo ─────────────────────────────────── */
async function sendPayslipEmail({
  to, name, employeeId, role, month, periodStart, periodEnd,
  workingDays, presentDays, leaveDays, paidLeaveDays,
  basicSalary, earnedBasic, grossSalary, netSalary,
  status, paymentDate, paymentMode
}) {
  const apiKey    = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "quibotechnologies@gmail.com";

  if (!apiKey) {
    console.warn("BREVO_API_KEY not set — skipping payslip email");
    return;
  }

  const fmtEmail = (n) =>
    "Rs." + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const fmtEmailFull = (n) =>
    "Rs." + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return "—"; }
  };

  const monthLabel = (() => {
    try {
      const [yr, mo] = month.split("-");
      return new Date(yr, mo - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    } catch { return month; }
  })();

  const absentDays        = Math.max(0, workingDays - presentDays - leaveDays);
  const modeLabel         = (paymentMode || "bank_transfer").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
  const bd                = getSalaryBreakdown(netSalary);
  const displayEmployeeId = employeeId ? String(employeeId) : "—";

  // Use inline SVG logo for email (always works, no file dependency)
  const logoSvgInline = quiboLogoSVG(50);

  let pdfBase64 = "";
  try {
    const buf = await generatePayslipPDF({
      name, employeeId, role, month,
      workingDays, presentDays, leaveDays,
      netSalary, paymentDate
    });
    pdfBase64 = buf.toString("base64");
  } catch (err) {
    console.error("PDF generation failed:", err.message);
  }

  const earningRows = [
    ["Basic",                bd.basic],
    ["House Rent Allowance", bd.hra],
    ["Medical Allowance",    bd.medical],
    ["Conveyance Allowance", bd.conveyance],
    ...(netSalary > 10000 ? [["Special Allowance", bd.special]] : []),
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Payslip - ${monthLabel}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f4f8;padding:24px 8px}
  @media(max-width:600px){.hide-mob{display:none!important}}
</style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8">
<tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="620" cellpadding="0" cellspacing="0"
  style="max-width:620px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.12)">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1c2e4a 50%,#0f172a 100%);padding:28px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;padding-right:14px;width:58px">
          ${logoSvgInline}
        </td>
        <td style="vertical-align:middle">
          <p style="font-size:20px;font-weight:800;color:#ffffff;margin:0;letter-spacing:-0.3px">Quibo Tech</p>
          <p style="font-size:12px;color:rgba(148,163,184,.9);margin:3px 0 0;text-transform:capitalize">${role} &middot; HRMS</p>
          <p style="font-size:11px;color:rgba(148,163,184,.65);margin:2px 0 0">ID: ${displayEmployeeId}</p>
        </td>
        <td align="right" class="hide-mob">
          <div style="background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.4);border-radius:20px;padding:6px 16px">
            <p style="font-size:10px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:2px;margin:0">PAY SLIP</p>
          </div>
        </td>
      </tr>
    </table>
    <div style="height:3px;background:linear-gradient(90deg,#f97316,#fb923c,#f97316);margin-top:20px"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px">
      <tr>
        <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding-right:16px">
          <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Pay Period</p>
          <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${monthLabel}</p>
        </td>
        <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding:0 16px">
          <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Date Range</p>
          <p style="font-size:11px;font-weight:600;color:#e2e8f0;margin:0">${fmtDate(periodStart)} &ndash; ${fmtDate(periodEnd)}</p>
        </td>
        <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding:0 16px">
          <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Working / Present</p>
          <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${workingDays}W / <span style="color:#4ade80">${presentDays}P</span></p>
        </td>
        <td style="text-align:center;padding-left:16px">
          <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Leave / Absent</p>
          <p style="font-size:13px;font-weight:700;color:#fff;margin:0"><span style="color:#fbbf24">${leaveDays}L</span> / <span style="color:#f87171">${absentDays}A</span></p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:24px 32px 0">
    <p style="font-size:14px;color:#1e293b;line-height:1.7;margin:0">Dear <strong>${name}</strong>,</p>
    <p style="font-size:13px;color:#475569;line-height:1.7;margin:10px 0 0">
      Quibo Tech has processed your salary for <strong>${monthLabel}</strong>.
      Your net take-home pay is <strong style="color:#16a34a">${fmtEmail(netSalary)}</strong>,
      credited via <strong>${modeLabel}</strong>${paymentDate ? ` on <strong>${fmtDate(paymentDate)}</strong>` : ""}.
    </p>
    <p style="font-size:13px;color:#475569;line-height:1.7;margin:8px 0 0">
      Your official payslip for <strong>${monthLabel}</strong> is attached as a PDF. Please save it for your records.
    </p>
  </td></tr>

  <!-- NET PAY BANNER -->
  <tr><td style="padding:20px 32px 0">
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);border-radius:14px;padding:20px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Net Take-Home Pay</p>
            <p style="font-size:34px;font-weight:900;color:#ffffff;margin:0;letter-spacing:-1px;white-space:nowrap">${fmtEmail(netSalary)}</p>
            <p style="font-size:11px;color:rgba(255,255,255,.75);margin:5px 0 0">${modeLabel}${paymentDate ? ` &middot; Paid on ${fmtDate(paymentDate)}` : ""}</p>
          </td>
          <td align="right" class="hide-mob">
            <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:10px 18px;text-align:center">
              <p style="font-size:10px;font-weight:800;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1px;margin:0 0 3px">Status</p>
              <p style="font-size:14px;font-weight:900;color:#ffffff;margin:0;text-transform:uppercase">${status}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </td></tr>

  <!-- SALARY TABLE -->
  <tr><td style="padding:24px 32px">
    <p style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9">
      Salary Breakdown &mdash; ${monthLabel}
    </p>

    <!-- Earnings -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:8px">
      <tr style="background:#f8fafc">
        <td style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;border-bottom:1px solid #e2e8f0">EARNINGS</td>
        <td style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">AMOUNT</td>
      </tr>
      ${earningRows.map(([lbl, amt], i) => `
      <tr style="${i%2===1?"background:#fafafa":""}">
        <td style="font-size:12px;color:#475569;padding:8px 12px;border-bottom:1px solid #f1f5f9">${lbl}</td>
        <td style="font-size:12px;font-weight:700;color:#1e293b;padding:8px 12px;text-align:right;border-bottom:1px solid #f1f5f9;white-space:nowrap">${fmtEmailFull(amt)}</td>
      </tr>`).join("")}
      <tr style="background:#f1f5f9">
        <td style="font-size:12px;font-weight:800;color:#1e293b;padding:8px 12px;border-top:1px solid #e2e8f0">Gross Earnings</td>
        <td style="font-size:13px;font-weight:900;color:#16a34a;padding:8px 12px;text-align:right;border-top:1px solid #e2e8f0;white-space:nowrap">${fmtEmailFull(bd.gross)}</td>
      </tr>
    </table>

    <!-- Deductions -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:8px">
      <tr style="background:#f8fafc">
        <td style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;border-bottom:1px solid #e2e8f0">DEDUCTIONS</td>
        <td style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">AMOUNT</td>
      </tr>
      <tr>
        <td style="font-size:12px;color:#475569;padding:8px 12px;border-bottom:1px solid #f1f5f9">Income Tax</td>
        <td style="font-size:12px;font-weight:700;color:#1e293b;padding:8px 12px;text-align:right;border-bottom:1px solid #f1f5f9;white-space:nowrap">${fmtEmailFull(0)}</td>
      </tr>
      <tr style="background:#fafafa">
        <td style="font-size:12px;color:#475569;padding:8px 12px">Provident Fund</td>
        <td style="font-size:12px;font-weight:700;color:#1e293b;padding:8px 12px;text-align:right;white-space:nowrap">${fmtEmailFull(0)}</td>
      </tr>
      <tr style="background:#f1f5f9">
        <td style="font-size:12px;font-weight:800;color:#1e293b;padding:8px 12px;border-top:1px solid #e2e8f0">Total Deductions</td>
        <td style="font-size:13px;font-weight:900;color:#dc2626;padding:8px 12px;text-align:right;border-top:1px solid #e2e8f0;white-space:nowrap">${fmtEmailFull(0)}</td>
      </tr>
    </table>

    <!-- Net payable -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size:12px;font-weight:800;color:#1e293b;margin:0">TOTAL NET PAYABLE</p>
            <p style="font-size:10px;color:#64748b;margin:2px 0 0">Gross Earnings - Total Deductions</p>
          </td>
          <td align="right">
            <p style="font-size:18px;font-weight:900;color:#16a34a;margin:0;white-space:nowrap">${fmtEmailFull(netSalary)}</p>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size:11px;color:#475569;text-align:right;margin:0">
      Amount In Words: <strong style="color:#1e293b">Indian Rupee ${numberToWords(netSalary)} Only</strong>
    </p>
  </td></tr>

  <!-- PDF NOTE -->
  <tr><td style="padding:0 32px 20px">
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px">
      <p style="font-size:12px;color:#1d4ed8;margin:0;line-height:1.6">
        &#128206; Your official payslip for <strong>${monthLabel}</strong> is attached as a PDF.
        Please save it for your records or contact HR if you have any questions.
      </p>
    </div>
  </td></tr>

  <!-- FOOTER DARK -->
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="font-size:11px;color:rgba(148,163,184,.8);margin:0 0 2px">NET SALARY PAYABLE</p>
          <p style="font-size:26px;font-weight:900;color:#ffffff;margin:0;white-space:nowrap">${fmtEmail(netSalary)}</p>
        </td>
        <td align="right" class="hide-mob">
          <p style="font-size:10px;color:rgba(148,163,184,.7);margin:0 0 2px;text-transform:uppercase;letter-spacing:1px">Full Month Basic</p>
          <p style="font-size:14px;font-weight:700;color:#e2e8f0;margin:0;white-space:nowrap">${fmtEmail(basicSalary)}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- COMPANY FOOTER -->
  <tr><td style="padding:14px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="font-size:12px;font-weight:800;color:#1e293b;margin:0">Quibo Tech</p>
          <p style="font-size:10px;color:#94a3b8;margin:2px 0 0">System-generated payslip. No signature required.</p>
        </td>
        <td align="right" class="hide-mob">
          <p style="font-size:10px;color:#94a3b8;margin:0">Generated: ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
          <p style="font-size:10px;color:#cbd5e1;margin:2px 0 0">HRMS v1.0 &middot; Confidential</p>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const payload = {
    sender:      { name: "Quibo Tech HRMS", email: fromEmail },
    to:          [{ email: to, name }],
    subject:     `[Quibo Tech] Payslip for ${monthLabel} – ${fmtEmail(netSalary)} Net Pay`,
    htmlContent: html,
    textContent: `Hi ${name},\n\nQuibo Tech has processed your salary for ${monthLabel}.\n\nEmployee ID : ${displayEmployeeId}\nNet Pay     : ${fmtEmail(netSalary)}\nPayment Mode: ${modeLabel}${paymentDate ? `\nPaid On     : ${fmtDate(paymentDate)}` : ""}\n\nYour payslip PDF is attached.\n\nFor queries contact HR at ${fromEmail}.\n\nQuibo Tech`,
  };

  if (pdfBase64) {
    payload.attachment = [{
      content: pdfBase64,
      name:    `Payslip_${(name || "Employee").replace(/\s+/g,"_")}_${month}.pdf`,
    }];
  }

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "api-key": apiKey },
      body:    JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) console.error("Brevo error:", data.message);
    else          console.log(`✅ Payslip sent to ${to}`);
  } catch (err) {
    console.error("sendPayslipEmail failed:", err.message);
  }
}

/* ─── calcSalary ────────────────────────────────────────────── */
function calcSalary({ basicSalary, workingDays, presentDays, leaveDays, paidLeaveDays }) {
  const wDays  = Math.max(1, Number(workingDays)   || 26);
  const pDays  = Math.max(0, Number(presentDays)   || 0);
  const lDays  = Math.max(0, Number(leaveDays)     || 0);
  const plDays = Math.max(0, Number(paidLeaveDays) || 1);
  const basic  = Math.max(0, Number(basicSalary)   || 0);
  const perDay             = basic / wDays;
  const effectivePaidLeave = Math.min(lDays, plDays);
  const paidDays           = pDays + effectivePaidLeave;
  const earnedBasic        = Math.round(perDay * paidDays);
  return { earnedBasic, grossSalary: earnedBasic, netSalary: earnedBasic };
}

/* ─── Month helpers ─────────────────────────────────────────── */
function monthBounds(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
}
function countWorkingDays(start, end) {
  let count = 0, cur = new Date(start);
  while (cur <= end) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}

/* ─── Attendance helper ─────────────────────────────────────── */
async function getAttendanceData(userId, start, end, workingDays) {
  let leaveDays = 0;
  try {
    const leaves = await Leave.find({ userId, status: "approved", startDate: { $lte: end }, endDate: { $gte: start } });
    leaves.forEach(l => {
      const s = new Date(Math.max(new Date(l.startDate), start));
      const e = new Date(Math.min(new Date(l.endDate),   end));
      leaveDays += Math.ceil((e - s) / 86400000) + 1;
    });
  } catch (_) {}
  let presentDays = workingDays - leaveDays;
  try {
    const att = await Attendance.countDocuments({ userId, date: { $gte: start, $lte: end }, status: "present" });
    if (att > 0) presentDays = att;
  } catch (_) {}
  return { leaveDays, presentDays: Math.max(0, presentDays) };
}

/* ═══════════════════ CONTROLLERS ═══════════════════════════ */

const createPayroll = async (req, res) => {
  try {
    const {
      userId, month, basicSalary,
      paidLeaveDays = 1,
      paymentMode   = "bank_transfer",
      remarks       = "",
      employeeId,
    } = req.body;

    if (!userId || !month || basicSalary === undefined)
      return res.status(400).json({ success: false, message: "userId, month and basicSalary are required." });

    const exists = await Payroll.findOne({ userId, month });
    if (exists)
      return res.status(409).json({ success: false, message: "Payroll already exists for this user/month." });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const { start, end }             = monthBounds(month);
    const workingDays                = countWorkingDays(start, end);
    const { leaveDays, presentDays } = await getAttendanceData(userId, start, end, workingDays);
    const calc = calcSalary({
      basicSalary:   Number(basicSalary),
      workingDays,   presentDays,  leaveDays,
      paidLeaveDays: Number(paidLeaveDays),
    });

    const payroll = await Payroll.create({
      userId, month, periodStart: start, periodEnd: end,
      role:          user.role,
      workingDays,   presentDays,  leaveDays,
      paidLeaveDays: Number(paidLeaveDays),
      basicSalary:   Number(basicSalary),
      earnedBasic:   calc.earnedBasic,
      grossSalary:   calc.grossSalary,
      netSalary:     calc.netSalary,
      status:        "draft",
      paymentMode,   remarks,
      employeeId:    employeeId ? String(employeeId).trim() : "",
    });

    res.status(201).json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllPayroll = async (req, res) => {
  try {
    const { month, status, role, startDate, endDate } = req.query;
    const filter = {};
    if (month)              filter.month       = month;
    if (status)             filter.status      = status;
    if (role)               filter.role        = role;
    if (startDate && endDate) {
      filter.periodStart = { $gte: new Date(startDate) };
      filter.periodEnd   = { $lte: new Date(endDate)   };
    }
    const records = await Payroll.find(filter)
      .populate("userId", "name email role department employeeId")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getMyPayroll = async (req, res) => {
  try {
    const records = await Payroll.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ success: false, message: "Record not found." });

    const workingDays   = req.body.workingDays   !== undefined ? Number(req.body.workingDays)   : payroll.workingDays;
    const presentDays   = req.body.presentDays   !== undefined ? Number(req.body.presentDays)   : payroll.presentDays;
    const leaveDays     = req.body.leaveDays     !== undefined ? Number(req.body.leaveDays)     : payroll.leaveDays;
    const paidLeaveDays = req.body.paidLeaveDays !== undefined ? Number(req.body.paidLeaveDays) : payroll.paidLeaveDays;
    const basicSalary   = req.body.basicSalary   !== undefined ? Number(req.body.basicSalary)   : payroll.basicSalary;

    const calc = calcSalary({ basicSalary, workingDays, presentDays, leaveDays, paidLeaveDays });

    const updateData = {
      workingDays, presentDays, leaveDays, paidLeaveDays, basicSalary,
      earnedBasic:  calc.earnedBasic,
      grossSalary:  calc.grossSalary,
      netSalary:    calc.netSalary,
    };
    if (req.body.status      !== undefined) updateData.status      = req.body.status;
    if (req.body.paymentMode !== undefined) updateData.paymentMode = req.body.paymentMode;
    if (req.body.remarks     !== undefined) updateData.remarks     = req.body.remarks;
    if (req.body.employeeId  !== undefined) updateData.employeeId  = String(req.body.employeeId).trim();

    const updated = await Payroll.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true })
      .populate("userId", "name email role employeeId");

    res.status(200).json({ success: true, payroll: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const processPayroll = async (req, res) => {
  try {
    const { month } = req.body;
    const filter    = month
      ? { status: { $in: ["draft","pending"] }, month }
      : { status: { $in: ["draft","pending"] } };

    const payrolls    = await Payroll.find(filter).populate("userId", "name email role employeeId");
    let processed     = 0;
    const emailErrors = [];

    for (const p of payrolls) {
      p.status      = "processed";
      p.paymentDate = new Date();
      await p.save();
      processed++;
      if (p.userId?.email) {
        try {
          await sendPayslipEmail({
            to:           p.userId.email,
            name:         p.userId.name,
            employeeId:   p.employeeId || p.userId.employeeId || String(p.userId._id),
            role:         p.role,         month:        p.month,
            periodStart:  p.periodStart,  periodEnd:    p.periodEnd,
            workingDays:  p.workingDays,  presentDays:  p.presentDays,
            leaveDays:    p.leaveDays,    paidLeaveDays:p.paidLeaveDays,
            basicSalary:  p.basicSalary,  earnedBasic:  p.earnedBasic,
            grossSalary:  p.grossSalary,  netSalary:    p.netSalary,
            status:       p.status,       paymentDate:  p.paymentDate,
            paymentMode:  p.paymentMode,
          });
        } catch (e) { emailErrors.push({ name: p.userId.name, error: e.message }); }
      }
    }

    res.status(200).json({ success: true, message: `${processed} payroll(s) processed.`, processed, emailErrors });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const markAsPaid = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate("userId", "name email role employeeId");
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found." });

    payroll.status      = "paid";
    payroll.paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    if (req.body.paymentMode) payroll.paymentMode = req.body.paymentMode;
    await payroll.save();

    if (payroll.userId?.email) {
      await sendPayslipEmail({
        to:           payroll.userId.email,
        name:         payroll.userId.name,
        employeeId:   payroll.employeeId || payroll.userId.employeeId || String(payroll.userId._id),
        role:         payroll.role,         month:        payroll.month,
        periodStart:  payroll.periodStart,  periodEnd:    payroll.periodEnd,
        workingDays:  payroll.workingDays,  presentDays:  payroll.presentDays,
        leaveDays:    payroll.leaveDays,    paidLeaveDays:payroll.paidLeaveDays,
        basicSalary:  payroll.basicSalary,  earnedBasic:  payroll.earnedBasic,
        grossSalary:  payroll.grossSalary,  netSalary:    payroll.netSalary,
        status:       payroll.status,       paymentDate:  payroll.paymentDate,
        paymentMode:  payroll.paymentMode,
      });
    }

    res.status(200).json({ success: true, message: "Marked as paid. Email sent.", payroll });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const resendPayslip = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate("userId", "name email role employeeId");
    if (!payroll)               return res.status(404).json({ success: false, message: "Payroll not found." });
    if (!payroll.userId?.email) return res.status(400).json({ success: false, message: "Employee email not found." });

    await sendPayslipEmail({
      to:           payroll.userId.email,
      name:         payroll.userId.name,
      employeeId:   payroll.employeeId || payroll.userId.employeeId || String(payroll.userId._id),
      role:         payroll.role,         month:        payroll.month,
      periodStart:  payroll.periodStart,  periodEnd:    payroll.periodEnd,
      workingDays:  payroll.workingDays,  presentDays:  payroll.presentDays,
      leaveDays:    payroll.leaveDays,    paidLeaveDays:payroll.paidLeaveDays,
      basicSalary:  payroll.basicSalary,  earnedBasic:  payroll.earnedBasic,
      grossSalary:  payroll.grossSalary,  netSalary:    payroll.netSalary,
      status:       payroll.status,       paymentDate:  payroll.paymentDate,
      paymentMode:  payroll.paymentMode,
    });

    res.status(200).json({ success: true, message: `Payslip resent to ${payroll.userId.email}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deletePayroll = async (req, res) => {
  try {
    await Payroll.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Payroll record deleted." });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const bulkGeneratePayroll = async (req, res) => {
  try {
    const { month, paidLeaveDays = 1 } = req.body;
    if (!month) return res.status(400).json({ success: false, message: "month is required." });

    const users          = await User.find({ isActive: { $ne: false } });
    const { start, end } = monthBounds(month);
    const workingDays    = countWorkingDays(start, end);
    const results        = { created: 0, skipped: 0, errors: [] };

    for (const user of users) {
      if (!user.basicSalary) { results.skipped++; continue; }
      const exists = await Payroll.findOne({ userId: user._id, month });
      if (exists) { results.skipped++; continue; }

      const { leaveDays, presentDays } = await getAttendanceData(user._id, start, end, workingDays);
      const calc = calcSalary({
        basicSalary:   user.basicSalary,
        workingDays,   presentDays,  leaveDays,
        paidLeaveDays: Number(paidLeaveDays),
      });
      try {
        await Payroll.create({
          userId:        user._id,       month,
          periodStart:   start,          periodEnd:     end,
          role:          user.role,      workingDays,
          presentDays,   leaveDays,
          paidLeaveDays: Number(paidLeaveDays),
          basicSalary:   user.basicSalary,
          earnedBasic:   calc.earnedBasic,
          grossSalary:   calc.grossSalary,
          netSalary:     calc.netSalary,
          status:        "draft",
          employeeId:    user.employeeId || "",
        });
        results.created++;
      } catch (e) { results.errors.push({ user: user.name, error: e.message }); }
    }

    res.status(200).json({ success: true, ...results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const backfillPayroll = async (req, res) => {
  try {
    const { months } = req.body;
    if (!months?.length) return res.status(400).json({ success: false, message: "months array required." });

    const users   = await User.find({ isActive: { $ne: false } });
    const summary = [];

    for (const month of months) {
      const { start, end } = monthBounds(month);
      const workingDays    = countWorkingDays(start, end);
      let created = 0, skipped = 0;

      for (const user of users) {
        if (!user.basicSalary) { skipped++; continue; }
        const exists = await Payroll.findOne({ userId: user._id, month });
        if (exists) { skipped++; continue; }

        const { leaveDays, presentDays } = await getAttendanceData(user._id, start, end, workingDays);
        const calc = calcSalary({
          basicSalary:   user.basicSalary,
          workingDays,   presentDays,  leaveDays,
          paidLeaveDays: 1,
        });

        await Payroll.create({
          userId:        user._id,       month,
          periodStart:   start,          periodEnd:    end,
          role:          user.role,      workingDays,
          presentDays,   leaveDays,      paidLeaveDays: 1,
          basicSalary:   user.basicSalary,
          earnedBasic:   calc.earnedBasic,
          grossSalary:   calc.grossSalary,
          netSalary:     calc.netSalary,
          status:        "paid",
          paymentDate:   end,
          employeeId:    user.employeeId || "",
        });
        created++;
      }
      summary.push({ month, created, skipped });
    }

    res.status(200).json({ success: true, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  createPayroll, getAllPayroll, getMyPayroll,
  updatePayroll, deletePayroll, processPayroll,
  markAsPaid, resendPayslip,
  bulkGeneratePayroll, backfillPayroll,
};
