const Client      = require("../models/Client");
const Invoice     = require("../models/Invoice");
const PDFDocument = require("pdfkit");
const path        = require("path");
const fs          = require("fs");

const LOGO_PATH = path.join(__dirname, "..", "assets", "quibo-logo.png");
console.log("Looking for logo at:", LOGO_PATH);
console.log("__dirname is:", __dirname);
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
    const pH     = 841.89;
    const margin = 40;
    const cW     = pW - margin * 2;

    const ORANGE = "#FF6B00";
    const DARK   = "#1a1a1a";
    const GREY   = "#4b5563";
    const BORDER = "#1a1a1a";

    // TODO: replace with Quibo Tech's real GSTIN once available
    const COMPANY_GSTIN   = "33AAACQ1234F1Z5";
    const COMPANY_MOBILE  = "9159649688";
    const COMPANY_WEBSITE = "www.quibotech.com";

    /* White BG */
    doc.rect(0, 0, pW, pH).fill("#ffffff");

    let y = margin;

    /* ── HEADER: Logo + Company (left) | TAX INVOICE (right) ── */
    const logoSize = 34;
    if (LOGO_BASE64) {
      doc.image(Buffer.from(LOGO_BASE64, "base64"), margin, y, { width: logoSize, height: logoSize });
    } else {
      doc.save();
      doc.roundedRect(margin, y, logoSize, logoSize, 6).fill(DARK);
      doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(18)
         .text("Q", margin, y + 8, { width: logoSize, align: "center", lineBreak: false });
      doc.restore();
    }

    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(17)
       .text("Quibo Tech", margin + logoSize + 10, y + 8, { lineBreak: false });

    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(16)
       .text("TAX INVOICE", pW - margin - 200, y, { width: 200, align: "right", lineBreak: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(`Invoice #: ${invoice.invoiceNumber || "—"}`, pW - margin - 200, y + 20, { width: 200, align: "right", lineBreak: false });

    y += logoSize + 14;

    /* Company GSTIN + address + contacts */
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text(`GSTIN ${COMPANY_GSTIN}`, margin, y, { lineBreak: false });
    y += 13;
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text("10th Floor, Millennia Business Park Campus II, Dr MGR Main Rd,", margin, y, { lineBreak: false });
    y += 12;
    doc.text("Kandhanchavadi, Perungudi, Chennai, TAMIL NADU, 600096", margin, y, { lineBreak: false });
    y += 16;
    doc.text(`Mobile +91 ${COMPANY_MOBILE}`, margin, y, { lineBreak: false });
    y += 12;
    doc.text("Email business@quibotech.com", margin, y, { lineBreak: false });
    y += 12;
    doc.text(`Website ${COMPANY_WEBSITE}`, margin, y, { lineBreak: false });

    y += 24;

    /* ── BILL TO (left) | Invoice Date / Due Date / Place of Supply (right) ── */
    const billToTop  = y;
    const rightColX  = margin + 300;

    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
       .text("Bill To:", margin, y, { lineBreak: false });
    y += 15;
    doc.font("Helvetica-Bold").fontSize(10)
       .text(client.name || "—", margin, y, { lineBreak: false });
    y += 14;

    if (client.gstNumber) {
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(9)
         .text(`GSTIN: ${client.gstNumber}`, margin, y, { lineBreak: false, width: 260 });
      y += 13;
    }

    if (client.company) {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text(client.company, margin, y, { lineBreak: false, width: 260 });
      y += 13;
    }

    if (client.address) {
      const addrParts = String(client.address)
        .split(/\r?\n/)
        .flatMap(l => l.split(/,\s+/))
        .map(s => s.trim())
        .filter(Boolean);
      let cur = "";
      const wrapped = [];
      addrParts.forEach((part, idx) => {
        const sep  = idx === 0 ? "" : ", ";
        const cand = cur + sep + part;
        if (cur === "") cur = part;
        else if (cand.length <= 48) cur = cand;
        else { wrapped.push(cur); cur = part; }
      });
      if (cur) wrapped.push(cur);
      wrapped.forEach(line => {
        doc.fillColor(GREY).font("Helvetica").fontSize(9)
           .text(line, margin, y, { lineBreak: false, width: 260 });
        y += 12;
      });
    }

    if (client.phone) {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text(`Ph: ${client.phone}`, margin, y, { lineBreak: false });
      y += 12;
    }
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(client.email || "", margin, y, { lineBreak: false });
    y += 12;

    const billToBottom = y;

    // TODO: Place of Supply isn't stored on the client/invoice — derived from the
    // last comma-separated segment of the client's address as a stand-in for the state.
    const placeOfSupply = client.address
      ? (String(client.address).split(",").pop() || "").trim()
      : "—";

    let   ry      = billToTop;
    const labelX  = rightColX;
    const valueW  = pW - margin - labelX;

    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text("Invoice Date:", labelX, ry, { width: 110, lineBreak: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(fmtDate(invoice.date), labelX + 110, ry, { width: valueW - 110, align: "right", lineBreak: false });
    ry += 16;

    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text("Due Date:", labelX, ry, { width: 110, lineBreak: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(fmtDate(invoice.dueDate), labelX + 110, ry, { width: valueW - 110, align: "right", lineBreak: false });
    ry += 16;

    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text("Place of Supply:", labelX, ry, { width: 110, lineBreak: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(placeOfSupply || "—", labelX + 110, ry, { width: valueW - 110, align: "right", lineBreak: false });

    y = Math.max(billToBottom, ry + 16) + 16;

    /* ── ITEMS TABLE ── */
    const items    = Array.isArray(invoice.items) ? invoice.items : [];
    const colNum   = margin;
    const colItem  = margin + 26;
    const colRate  = margin + cW - 260;
    const colQty   = margin + cW - 140;
    const colAmt   = margin + cW - 90;

    doc.moveTo(margin, y).lineTo(pW - margin, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 8;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text("#",           colNum,  y, { lineBreak: false })
       .text("Item",        colItem, y, { lineBreak: false })
       .text("Rate / Item", colRate, y, { width: 90, align: "right", lineBreak: false })
       .text("Qty",         colQty,  y, { width: 50, align: "right", lineBreak: false })
       .text("Amount",      colAmt,  y, { width: 55, align: "right", lineBreak: false });
    y += 14;
    doc.moveTo(margin, y).lineTo(pW - margin, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 10;

    if (items.length === 0) {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text("No items", colItem, y, { lineBreak: false });
      y += 20;
    } else {
      items.forEach((item, idx) => {
        const rate = Number(item.unitPrice || 0);
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
           .text(String(idx + 1), colNum, y, { lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(9)
           .text(item.description || "", colItem, y, { width: colRate - colItem - 10, lineBreak: false });
        doc.font("Helvetica").fontSize(9)
           .text(fmtPDF(rate),            colRate, y, { width: 90, align: "right", lineBreak: false })
           .text(String(item.quantity || 1), colQty, y, { width: 50, align: "right", lineBreak: false })
           .text(fmtPDF(item.total || 0), colAmt,  y, { width: 55, align: "right", lineBreak: false });
        y += 20;
      });
    }

    y += 4;
    doc.moveTo(margin, y).lineTo(pW - margin, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 16;

    /* ── BANK DETAILS (left) + TOTALS BOX (right) ── */
    const bankTop = y;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5)
       .text("Bank Details:", margin, y, { lineBreak: false });
    y += 15;

    const bankRows = [
      ["Bank:",      "HDFC BANK"],
      ["Account #:", "50200092253663"],
      ["IFSC:",      "HDFC0000136"],
      ["Branch:",    "Ashok Nagar"],
    ];
    bankRows.forEach(([label, val]) => {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text(label, margin, y, { width: 70, lineBreak: false });
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
         .text(val, margin + 70, y, { lineBreak: false });
      y += 13;
    });

    const bankBottom = y;

    /* Totals box on right */
    const boxW = 220;
    const boxX = pW - margin - boxW;
    let   by   = bankTop;

    const taxableAmount = Number(invoice.subtotal || 0);
    const totalTax      = Number(invoice.taxAmount || 0);
    const halfTax        = parseFloat((totalTax / 2).toFixed(2));
    const taxRate         = Number(invoice.tax || 0);
    const halfRate         = (taxRate / 2).toFixed(1);

    // NOTE: schema stores a single combined tax %; split evenly into CGST/SGST for display.
    const totalsRows = [
      ["Taxable Amount",   fmtPDF(taxableAmount)],
      [`CGST ${halfRate}%`, fmtPDF(halfTax)],
      [`SGST ${halfRate}%`, fmtPDF(halfTax)],
    ];

    totalsRows.forEach(([label, val]) => {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text(label, boxX, by, { width: 120, lineBreak: false });
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
         .text(val, boxX + 120, by, { width: boxW - 120, align: "right", lineBreak: false });
      by += 15;
    });

    by += 4;
    doc.moveTo(boxX, by).lineTo(boxX + boxW, by).strokeColor(BORDER).lineWidth(1).stroke();
    by += 8;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
       .text("Total", boxX, by, { width: 120, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
       .text(fmtPDF(invoice.amount || 0), boxX + 120, by, { width: boxW - 120, align: "right", lineBreak: false });
    by += 22;

    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text("Amount Payable:", boxX, by, { width: 120, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text(fmtPDF(invoice.amount || 0), boxX + 120, by, { width: boxW - 120, align: "right", lineBreak: false });
    by += 14;

    // NOTE: no paidAmount field on the Invoice schema yet — only shown when status is "paid".
    if (invoice.status === "paid") {
      doc.fillColor(GREY).font("Helvetica").fontSize(9)
         .text("Amount Paid:", boxX, by, { width: 120, lineBreak: false });
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
         .text(fmtPDF(invoice.amount || 0), boxX + 120, by, { width: boxW - 120, align: "right", lineBreak: false });
      by += 14;
    }

    y = Math.max(bankBottom, by) + 16;

    /* ── Amount in words ── */
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text("Total amount (in words): ", margin, y, { continued: true, lineBreak: false, width: cW });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text("INR " + numberToWords(Math.round(invoice.amount || 0)) + " Only.", { lineBreak: false, width: cW });
    y += 26;

    /* ── Notes ── */
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5).text("Notes:", margin, y, { lineBreak: false });
    y += 14;
    doc.fillColor(GREY).font("Helvetica").fontSize(9)
       .text(invoice.notes || "Thank you for the Business!", margin, y, { width: cW });
    y += 22;

    /* ── Terms and Conditions ── */
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5).text("Terms and Conditions:", margin, y, { lineBreak: false });
    y += 14;

    const terms = [
      "All invoices are payable within 15 days from the date of invoice.",
      "Late payments penalty of 2.5% interest per day on the outstanding balance.",
      "Any additional services requested by the client shall be subject to additional fees.",
      "The client retains all rights to materials provided by them for use in the project.",
      "Both parties agree to keep all information exchanged during the project confidential.",
      "This includes business strategies, trade secrets, and any proprietary information.",
      "Company reserves the right to update these terms and conditions at any time.",
      "This agreement shall be governed by and construed in accordance with the laws.",
      "By accepting this invoice, the client agrees to abide by these terms and conditions.",
    ];
    doc.fillColor(GREY).font("Helvetica").fontSize(8);
    terms.forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, margin, y, { width: cW });
      y += 12;
    });

    y += 30;

    /* ── Receiver's signature ── */
    doc.moveTo(margin, y).lineTo(margin + 160, y).strokeColor(BORDER).lineWidth(0.8).stroke();
    y += 6;
    doc.fillColor(GREY).font("Helvetica").fontSize(8.5).text("Receiver's Signature", margin, y, { lineBreak: false });

    /* ── FOOTER ── */
    const footerY = pH - 30;
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7.5)
       .text("Page 1/1", margin, footerY, { lineBreak: false });
    doc.text("This is a digitally signed document", 0, footerY, { align: "center", width: pW, lineBreak: false });

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
