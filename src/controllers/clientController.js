const Client      = require("../models/Client");
const Invoice     = require("../models/Invoice");
const PDFDocument = require("pdfkit");
const path        = require("path");
const fs          = require("fs");

const LOGO_PATH = path.resolve("C:/hrms2/HRMS--main/HRMS--main/src/assets/quibo-logo.png");
let LOGO_BASE64 = "";
try {
  if (fs.existsSync(LOGO_PATH)) {
    LOGO_BASE64 = fs.readFileSync(LOGO_PATH).toString("base64");
    console.log("✅ Logo loaded for invoices");
  } else {
    console.warn("⚠️  Invoice logo not found at:", LOGO_PATH);
  }
} catch (err) {
  console.warn("⚠️  Logo read failed:", err.message);
}

/* ─── Helpers ─────────────────────────────────────────────── */
function numberToWords(num) {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function inWords(n) {
    if (n === 0)      return "";
    if (n < 20)       return a[n];
    if (n < 100)      return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
    if (n < 1000)     return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
    if (n < 100000)   return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
    if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + inWords(n%100000) : "");
    return inWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + inWords(n%10000000) : "");
  }
  if (!num || num === 0) return "Zero";
  return inWords(Math.round(num));
}

function fmtPDF(n) {
  return "Rs." + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

/* ─── PDF Generator ─────────────────────────────────────────── */
async function generateInvoicePDF(invoice, client) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data",  c => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pW     = 595.28;
    const margin = 40;
    const cW     = pW - margin * 2;

    const ORANGE  = "#FF6B00";
    const DARK    = "#1a1a1a";
    const GREY    = "#64748b";
    const LIGHT   = "#f8fafc";
    const BORDER  = "#e2e8f0";
    const GREEN   = "#16a34a";
    const RED     = "#EF4444";

    const invDateStr = invoice.date
      ? new Date(invoice.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
      : "—";
    const dueDateStr = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
      : "—";

    /* White BG */
    doc.rect(0, 0, pW, 841.89).fill("#ffffff");

    /* Orange left stripe */
    doc.rect(0, 0, 5, 841.89).fill(ORANGE);

    /* Logo */
    const logoSize = 48;
    const logoX    = margin;
    const logoY    = 40;

    if (LOGO_BASE64) {
      const logoBuf = Buffer.from(LOGO_BASE64, "base64");
      doc.image(logoBuf, logoX, logoY, { width: logoSize, height: logoSize });
    } else {
      doc.save();
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 8).fill(DARK);
      doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(26)
         .text("Q", logoX, logoY + 11, { width: logoSize, align: "center", lineBreak: false });
      doc.restore();
    }

    /* Company name + address */
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(20)
       .text("Quibo Tech", logoX + logoSize + 12, logoY + 5, { lineBreak: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(7.5)
       .text("10th Floor, Millennia Business Park Campus II, Dr MGR Main Rd,",
             logoX + logoSize + 12, logoY + 29)
       .text("Kandhanchavadi, Perungudi, Chennai – 600096 India",
             logoX + logoSize + 12, logoY + 40);

    /* INVOICE label (top-right) */
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(24)
       .text("INVOICE", pW - margin - 150, logoY + 5, { width: 150, align: "right", lineBreak: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(8.5)
       .text(`Invoice No : ${invoice.invoiceNumber || "—"}`, pW - margin - 150, logoY + 36, { width: 150, align: "right", lineBreak: false })
       .text(`Date       : ${invDateStr}`,                   pW - margin - 150, logoY + 49, { width: 150, align: "right", lineBreak: false });

    /* Header divider */
    const divY = logoY + 95;
    doc.moveTo(margin, divY).lineTo(pW - margin, divY).strokeColor(BORDER).lineWidth(0.8).stroke();

    /* ═══════════════════════════════════════════
       BILL TO SECTION — fixed with bold GST/TIN
       and proper address line spacing
    ═══════════════════════════════════════════ */
    let y = divY + 18;

    doc.fillColor(GREY).font("Helvetica-Bold").fontSize(8)
       .text("BILL TO", margin, y);
    y += 13;

    /* Client name */
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13)
       .text(client.name || "—", margin, y, { lineBreak: false });
    y += 18;

    /* Company */
    if (client.company) {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text(client.company, margin, y, { lineBreak: false });
      y += 13;
    }

    /* GST/TIN — BOLD */
    if (client.gstNumber) {
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(9)
         .text(`GST/TIN: ${client.gstNumber}`, margin, y, { lineBreak: false });
      y += 13;
    }

    /* Email */
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(client.email || "", margin, y, { lineBreak: false });
    y += 13;

    /* Phone */
    if (client.phone) {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text(client.phone, margin, y, { lineBreak: false });
      y += 13;
    }

    /* Address — split on newlines or comma+space, render each part on its own line */
    if (client.address) {
      const rawAddress = client.address.trim();
      // Split on newline characters first, then on ", " patterns for inline addresses
      const addressParts = rawAddress
        .split(/\r?\n/)
        .flatMap(line => line.split(/,\s+/))
        .map(s => s.trim())
        .filter(Boolean);

      // Re-join into max ~45-char chunks so each line fits within width:240
      let currentLine = "";
      const addressLines = [];
      addressParts.forEach((part, idx) => {
        const separator = idx === 0 ? "" : ", ";
        const candidate = currentLine + separator + part;
        if (currentLine === "") {
          currentLine = part;
        } else if (candidate.length <= 45) {
          currentLine = candidate;
        } else {
          addressLines.push(currentLine);
          currentLine = part;
        }
      });
      if (currentLine) addressLines.push(currentLine);

      addressLines.forEach(line => {
        doc.fillColor(GREY).font("Helvetica").fontSize(9)
           .text(line, margin, y, { lineBreak: false, width: 240 });
        y += 13;
      });
    }

    /* Net Pay box (right) */
    const boxX = pW / 2 + 20;
    const boxY = divY + 18;
    const boxW = pW - margin - boxX;
    const boxH = 60;

    doc.roundedRect(boxX, boxY, boxW, boxH, 6).strokeColor("#d1fae5").lineWidth(1.2).stroke();
    doc.rect(boxX, boxY, 4, boxH).fill(GREEN);

    doc.fillColor(GREY).font("Helvetica").fontSize(8.5)
       .text("Total Amount Payable", boxX + 10, boxY + 10, { lineBreak: false });
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(18)
       .text(fmtPDF(invoice.amount || 0), boxX + 10, boxY + 26, { lineBreak: false });

    y = Math.max(y, boxY + boxH) + 22;

    /* ITEMS TABLE HEADER */
    const tX    = margin;
    const tW    = cW;
    const rH    = 28;
    const items = Array.isArray(invoice.items) ? invoice.items : [];

    doc.roundedRect(tX, y, tW, 36, 4).fill(RED);

    const colQty   = tX + 18;
    const colDesc  = tX + 80;
    const colTotal = tX + tW - 90;

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
       .text("Quantity", colQty, y + 12, { lineBreak: false, width: 50, align: "center" })
       .text("Description", colDesc, y + 12, { lineBreak: false, width: 250 })
       .text("Total", colTotal, y + 12, { lineBreak: false, width: 80, align: "right" });

    y += 36;
    y += 14;

    /* DATA ROWS */
    if (items.length === 0) {
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(10)
         .text("No items", colDesc, y + 9, { lineBreak: false });
      y += rH;
    } else {
      items.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(tX, y, tW, rH).fill(bgColor).strokeColor(BORDER).lineWidth(0.5).stroke();
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
           .text(String(item.quantity || 1), colQty, y + 9, { lineBreak: false, width: 50, align: "center" });
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
           .text(item.description || "", colDesc, y + 9, { lineBreak: false, width: 200 });
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
           .text(fmtPDF(item.total || 0), colTotal, y + 9, { lineBreak: false, width: 80, align: "right" });
        y += rH;
      });
    }

    y += 14;

    /* TOTAL ROW */
    doc.rect(tX, y, tW, 32).fill(LIGHT).strokeColor(BORDER).lineWidth(0.8).stroke();
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12)
       .text("Total Amount", tX + 14, y + 9, { lineBreak: false });
    const totalAmount = fmtPDF(invoice.amount || 0);
    const totalWidth  = doc.widthOfString(totalAmount, { fontSize: 12, font: "Helvetica-Bold" });
    const totalX      = tX + tW - 14 - totalWidth;
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(12)
       .text(totalAmount, totalX, y + 9, { lineBreak: false });

    y += 32 + 16;

    /* Amount in words */
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text("Amount In Words: ", tX, y, { continued: true, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text("Indian Rupee " + numberToWords(Math.round(invoice.amount || 0)) + " Only", { lineBreak: false });

    y += 18;
    doc.moveTo(margin, y).lineTo(pW - margin, y).strokeColor(BORDER).lineWidth(0.8).stroke();
    y += 14;

    doc.fillColor(GREY).font("Helvetica").fontSize(8)
       .text("-- This is a system-generated document. --", 0, y, { align: "center", width: pW, lineBreak: false });

    y += 106;

    /* BANK DETAILS */
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
       .text("Bank Details", margin, y, { lineBreak: false });
    y += 4;
    doc.moveTo(margin, y + 8).lineTo(margin + 80, y + 8).strokeColor(ORANGE).lineWidth(2).stroke();
    y += 18;

    const bankData = [
      { label: "Bank Name",      value: "HDFC BANK" },
      { label: "Account Name",   value: "QUIBO TECH" },
      { label: "Account Number", value: "50200092253663" },
      { label: "IFSC Code",      value: "HDFC0000136" },
      { label: "Branch",         value: "Ashok Nagar" },
      { label: "PAN",            value: "HAEP7920N" },
      { label: "Email",          value: "business@quibotech.com" },
      { label: "Phone",          value: "9159649688" },
      { label: "Website",        value: "www.quibotech.com" },
    ];

    const bankLabelWidth = 90;
    const bankValueX     = margin + bankLabelWidth + 8;

    bankData.forEach((detail) => {
      doc.fillColor("#475569").font("Helvetica-Bold").fontSize(9)
         .text(detail.label + ":", margin, y, { lineBreak: false, width: bankLabelWidth });
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
         .text(detail.value, bankValueX, y, { lineBreak: false, width: cW - bankLabelWidth - 8 });
      y += 13;
    });

    /* FOOTER */
    const footerLogoSize = 22;
    const footerY        = doc.page.height - 45;

    doc.moveTo(margin, footerY - 12).lineTo(pW - margin, footerY - 12)
       .strokeColor(BORDER).lineWidth(0.8).stroke();

    const footerText = "Quibo Tech  |  HRMS  |  Confidential 2026";
    const txtW       = doc.widthOfString(footerText, { fontSize: 7 });
    const startX     = (pW - (footerLogoSize + 8 + txtW)) / 2;

    if (LOGO_BASE64) {
      doc.image(Buffer.from(LOGO_BASE64, "base64"), startX, footerY, { width: footerLogoSize, height: footerLogoSize });
    } else {
      doc.roundedRect(startX, footerY, footerLogoSize, footerLogoSize, 4).fill(DARK);
      doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(12)
         .text("Q", startX, footerY + 5, { width: footerLogoSize, align: "center", lineBreak: false });
    }

    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7)
       .text(footerText, startX + footerLogoSize + 8, footerY + 7, { lineBreak: false });

    doc.end();
  });
}

/* ─── Email via Brevo ─────────────────────────────────────────── */
async function sendInvoiceEmail(invoice, client, pdfBuffer) {
  const apiKey    = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "quibotechnologies@gmail.com";
  if (!apiKey) { console.warn("BREVO_API_KEY not set"); return; }

  const fmtE = (n) => "Rs." + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtD = (d) => { try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; } };

  const logoImgTag = LOGO_BASE64
    ? `<img src="data:image/png;base64,${LOGO_BASE64}" width="44" height="44" style="border-radius:8px" alt="Quibo Tech"/>`
    : `<div style="width:44px;height:44px;background:#1a1a1a;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#f97316">Q</div>`;

  const itemsHtml = (invoice.items || []).map((item, i) => `
    <tr style="${i % 2 === 1 ? "background:#f8fafc" : "background:#ffffff"}">
      <td style="padding:12px 14px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700">${item.quantity}</td>
      <td style="padding:12px 14px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;font-weight:700">${item.description}</td>
      <td style="padding:12px 14px;font-size:13px;font-weight:800;color:#16a34a;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap">${fmtE(item.total)}</td>
    </tr>`).join("");

  const bankDetailsHtml = `
    <tr><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700;width:140px">Bank Name:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">HDFC BANK</td></tr>
    <tr style="background:#f8fafc"><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">Account Name:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">QUIBO TECH</td></tr>
    <tr><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">Account Number:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">50200092253663</td></tr>
    <tr style="background:#f8fafc"><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">IFSC Code:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">HDFC0000136</td></tr>
    <tr><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">Branch:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">Ashok Nagar</td></tr>
    <tr style="background:#f8fafc"><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">PAN:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">HAEP7920N</td></tr>
    <tr><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">Email:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">business@quibotech.com</td></tr>
    <tr style="background:#f8fafc"><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">Phone:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">9159649688</td></tr>
    <tr><td style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">Website:</td><td style="padding:10px 14px;font-size:12px;color:#1e293b;font-weight:800">www.quibotech.com</td></tr>
  `;

  const gstLine = client.gstNumber
    ? `<p style="font-size:12px;color:#64748b;margin:0 0 2px"><strong>GST/TIN: ${client.gstNumber}</strong></p>`
    : "";

  // Build address lines for email the same way as PDF
  let addressHtml = "";
  if (client.address) {
    const rawAddress = client.address.trim();
    const addressParts = rawAddress
      .split(/\r?\n/)
      .flatMap(line => line.split(/,\s+/))
      .map(s => s.trim())
      .filter(Boolean);

    let currentLine = "";
    const addressLines = [];
    addressParts.forEach((part, idx) => {
      const separator = idx === 0 ? "" : ", ";
      const candidate = currentLine + separator + part;
      if (currentLine === "") {
        currentLine = part;
      } else if (candidate.length <= 45) {
        currentLine = candidate;
      } else {
        addressLines.push(currentLine);
        currentLine = part;
      }
    });
    if (currentLine) addressLines.push(currentLine);

    addressHtml = addressLines
      .map(line => `<p style="font-size:12px;color:#64748b;margin:0 0 2px">${line}</p>`)
      .join("");
  }

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Invoice ${invoice.invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8"><tr><td align="center" style="padding:24px 8px">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.1)">
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1c2e4a 50%,#0f172a 100%);padding:28px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;padding-right:14px;width:56px">${logoImgTag}</td>
        <td style="vertical-align:middle">
          <p style="font-size:20px;font-weight:800;color:#fff;margin:0">Quibo Tech</p>
          <p style="font-size:11px;color:rgba(148,163,184,.8);margin:3px 0 0">10th Floor, Millennia Business Park, Chennai – 600096</p>
        </td>
        <td align="right">
          <div style="background:rgba(255,107,0,.15);border:1px solid rgba(255,107,0,.4);border-radius:20px;padding:6px 16px;display:inline-block">
            <p style="font-size:10px;font-weight:900;color:#ff6b00;text-transform:uppercase;letter-spacing:2px;margin:0">INVOICE</p>
          </div>
        </td>
      </tr>
    </table>
    <div style="height:3px;background:linear-gradient(90deg,#ff6b00,#fb923c,#ff6b00);margin-top:20px"></div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px">
      <tr>
        <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding-right:16px">
          <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Invoice No</p>
          <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${invoice.invoiceNumber || "—"}</p>
        </td>
        <td style="text-align:center;padding:0 16px">
          <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Invoice Date</p>
          <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${fmtD(invoice.date)}</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;width:55%">
          <p style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px">Bill To</p>
          <p style="font-size:16px;font-weight:800;color:#1e293b;margin:0 0 4px">${client.name}</p>
          ${client.company ? `<p style="font-size:12px;color:#64748b;margin:0 0 2px">${client.company}</p>` : ""}
          ${gstLine}
          <p style="font-size:12px;color:#64748b;margin:0 0 2px">${client.email}</p>
          ${client.phone ? `<p style="font-size:12px;color:#64748b;margin:0 0 2px">${client.phone}</p>` : ""}
          ${addressHtml}
        </td>
        <td style="vertical-align:top;text-align:right">
          <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px 20px;display:inline-block;text-align:left">
            <p style="font-size:10px;color:#64748b;margin:0 0 6px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">TOTAL AMOUNT</p>
            <p style="font-size:28px;font-weight:900;color:#16a34a;margin:0;white-space:nowrap">${fmtE(invoice.amount)}</p>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 32px">
    <p style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #ff6b00">Invoice Details</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr style="background:#EF4444">
        <th style="font-size:11px;font-weight:900;color:#ffffff;text-transform:uppercase;padding:12px 14px;text-align:center;letter-spacing:0.5px">Quantity</th>
        <th style="font-size:11px;font-weight:900;color:#ffffff;text-transform:uppercase;padding:12px 14px;text-align:left;letter-spacing:0.5px">Description</th>
        <th style="font-size:11px;font-weight:900;color:#ffffff;text-transform:uppercase;padding:12px 14px;text-align:right;letter-spacing:0.5px">Total</th>
      </tr>
      ${itemsHtml}
    </table>
    <div style="height:14px"></div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;background:#f8fafc">
      <tr>
        <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#1e293b">Total Amount</td>
        <td style="padding:10px 14px;font-size:13px;font-weight:900;color:#16a34a;text-align:right;white-space:nowrap;min-width:200px">${fmtE(invoice.amount)}</td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
      <tr><td>
        <p style="font-size:11px;color:#475569;margin:0 0 4px">Amount In Words</p>
        <p style="font-size:12px;color:#1e293b;margin:0"><strong>Indian Rupee ${numberToWords(Math.round(invoice.amount || 0))} Only</strong></p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 32px 0">
    <p style="font-size:9px;color:#94a3b8;text-align:center;margin:0">-- This is a system-generated document. --</p>
    <div style="height:106px"></div>
  </td></tr>
  <tr><td style="padding:0 32px 24px">
    <p style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #ff6b00">Bank Details</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      ${bankDetailsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 20px">
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px">
      <p style="font-size:12px;color:#1d4ed8;margin:0">📎 Your invoice PDF is attached. Please save it for your records or contact us at <a href="mailto:business@quibotech.com" style="color:#2563eb;font-weight:700">business@quibotech.com</a> for queries.</p>
    </div>
  </td></tr>
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 32px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="font-size:12px;font-weight:800;color:#fff;margin:0">Quibo Tech</p><p style="font-size:10px;color:rgba(148,163,184,.7);margin:3px 0 0">System-generated invoice. No signature required.</p></td>
      <td align="right"><p style="font-size:10px;color:rgba(148,163,184,.7);margin:0">HRMS v1.0 · Confidential</p></td>
    </tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const payload = {
    sender:      { name: "Quibo Tech HRMS", email: fromEmail },
    to:          [{ email: client.email, name: client.name }],
    subject:     `Invoice ${invoice.invoiceNumber} from Quibo Tech – ${fmtE(invoice.amount)}`,
    htmlContent: html,
    attachment: pdfBuffer ? [{
      content: pdfBuffer.toString("base64"),
      name:    `Invoice_${invoice.invoiceNumber}.pdf`,
    }] : [],
  };

  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "api-key": apiKey },
    body:    JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || "Brevo send failed");
  console.log(`✅ Invoice email sent to ${client.email}`);
}

/* ══════════════════ CRUD CONTROLLERS ═══════════════════════ */

const createClient = async (req, res) => {
  try {
    const phone = req.body.phone ? String(req.body.phone).replace(/\D/g, "").slice(0, 10) : "";
    if (phone && phone.length !== 10) {
      return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits" });
    }
    const client = await Client.create({ ...req.body, phone });
    res.status(201).json({ success: true, client });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .select("-documents.data")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, clients });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateClient = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.phone !== undefined) {
      const phone = String(updates.phone).replace(/\D/g, "").slice(0, 10);
      if (phone && phone.length !== 10) {
        return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits" });
      }
      updates.phone = phone;
    }
    const client = await Client.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .select("-documents.data");
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    res.status(200).json({ success: true, client });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    res.status(200).json({ success: true, message: "Client deleted." });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

/* ── Document Controllers ── */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No PDF file uploaded" });

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });

    const doc = {
      name:         req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      size:         req.file.size,
      mimeType:     req.file.mimetype,
      data:         req.file.buffer,
      uploadedAt:   new Date(),
    };

    client.documents.push(doc);
    await client.save();

    const saved = client.documents[client.documents.length - 1];
    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document: {
        _id:          saved._id,
        name:         saved.name,
        originalName: saved.originalName,
        size:         saved.size,
        uploadedAt:   saved.uploadedAt,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getDocuments = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select("documents._id documents.name documents.originalName documents.size documents.uploadedAt documents.mimeType");
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    res.status(200).json({ success: true, documents: client.documents });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const viewDocument = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });

    const doc = client.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    res.setHeader("Content-Type",        doc.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName || doc.name}"`);
    res.setHeader("Content-Length",      doc.data.length);
    res.send(doc.data);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteDocument = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });

    const doc = client.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    doc.deleteOne();
    await client.save();
    res.status(200).json({ success: true, message: "Document deleted" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createInvoice = async (req, res) => {
  try {
    const {
      clientId, invoiceNumber, items = [], tax = 0, includeTax = false,
      date, dueDate, notes, sendEmail = false, discount = 0, paymentMode = ""
    } = req.body;

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });

    let subtotal  = items.reduce((s, i) => s + Number(i.total || 0), 0);
    let taxAmount = 0;
    let amount    = subtotal;

    if (tax > 0) {
      if (includeTax) {
        amount    = subtotal;
        taxAmount = parseFloat(((tax / (100 + tax)) * subtotal).toFixed(2));
        subtotal  = parseFloat((amount - taxAmount).toFixed(2));
      } else {
        subtotal  = amount;
        taxAmount = parseFloat(((tax / 100) * subtotal).toFixed(2));
        amount    = parseFloat((subtotal + taxAmount).toFixed(2));
      }
    }

    const discountNum = Number(discount) || 0;
    amount = parseFloat((amount - discountNum).toFixed(2));

    const invoice = await Invoice.create({
      clientId,
      invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-8)}`,
      items: items.map(i => ({
        description: i.description,
        quantity:    Number(i.quantity)  || 1,
        unitPrice:   Number(i.unitPrice) || 0,
        total:       Number(i.total)     || 0,
      })),
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: Number(tax),
      taxAmount,
      discount: discountNum,
      amount,
      includeTax,
      date:    date    ? new Date(date)    : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      paymentMode: paymentMode || "",
      notes: notes || "",
    });

    await Client.findByIdAndUpdate(clientId, { $inc: { outstandingBalance: amount } });

    let emailSent = false;
    if (sendEmail) {
      try {
        const pdfBuf = await generateInvoicePDF(invoice, client);
        await sendInvoiceEmail(invoice, client, pdfBuf);
        await Invoice.findByIdAndUpdate(invoice._id, { emailSent: true, emailSentAt: new Date() });
        emailSent = true;
      } catch (e) { console.error("Email error:", e.message); }
    }

    res.status(201).json({
      success: true, invoice, emailSent,
      message: emailSent ? "Invoice created and email sent." : "Invoice created successfully.",
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("clientId", "name company email phone address gstNumber")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, invoices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getInvoicesByClientId = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select("-documents.data");
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    const invoices = await Invoice.find({ clientId: req.params.id })
      .populate("clientId", "name company email phone address gstNumber")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, client, invoices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("clientId", "name company email phone address gstNumber");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.status(200).json({ success: true, invoice });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("clientId", "name company email phone address gstNumber");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.status(200).json({ success: true, invoice });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    await Client.findByIdAndUpdate(invoice.clientId, { $inc: { outstandingBalance: -invoice.amount } });
    await Invoice.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Invoice deleted." });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const viewInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("clientId", "name company email phone address gstNumber");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    const pdfBuf   = await generateInvoicePDF(invoice, invoice.clientId);
    const safeName = (invoice.clientId?.name || "Invoice").replace(/\s+/g, "_");
    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice_${safeName}_${invoice.invoiceNumber}.pdf"`);
    res.setHeader("Content-Length",      pdfBuf.length);
    res.send(pdfBuf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("clientId", "name company email phone address gstNumber");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    const pdfBuf   = await generateInvoicePDF(invoice, invoice.clientId);
    const safeName = (invoice.clientId?.name || "Invoice").replace(/\s+/g, "_");
    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Invoice_${safeName}_${invoice.invoiceNumber}.pdf"`);
    res.setHeader("Content-Length",      pdfBuf.length);
    res.send(pdfBuf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const resendInvoiceEmail = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("clientId", "name company email phone address gstNumber");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    const pdfBuf = await generateInvoicePDF(invoice, invoice.clientId);
    await sendInvoiceEmail(invoice, invoice.clientId, pdfBuf);
    await Invoice.findByIdAndUpdate(invoice._id, { emailSent: true, emailSentAt: new Date() });
    res.status(200).json({ success: true, message: "Invoice email resent successfully." });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  createClient, getAllClients, updateClient, deleteClient,
  uploadDocument, getDocuments, viewDocument, deleteDocument,
  createInvoice, getAllInvoices, getInvoicesByClientId, getInvoiceById,
  updateInvoice, deleteInvoice,
  viewInvoicePDF, downloadInvoicePDF, resendInvoiceEmail,
};