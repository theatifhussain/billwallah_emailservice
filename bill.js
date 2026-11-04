const PDFDocument = require("pdfkit");


const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? "-" + ones[n % 10].toLowerCase() : ""); }
function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ones[h] + " Hundred" + (r ? " " : "") : "") + (r ? below100(r) : "");
}
function inWords(n) {
  if (n === 0) return "Zero";
  const parts = [];
  const cr = Math.floor(n / 10000000); n %= 10000000;
  const lk = Math.floor(n / 100000); n %= 100000;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(below1000(cr) + " Crore");
  if (lk) parts.push(below100(lk) + " Lakh");
  if (th) parts.push(below100(th) + " Thousand");
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}
function amountInWords(amount) {
  const paise = Math.round(Number(amount) * 100);
  const r = Math.floor(paise / 100), p = paise % 100;
  let s = inWords(r) + " Rupees";
  if (p) s += " And " + inWords(p) + " Paise";
  return s + " Only";
}
const inr = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


const path = require("path");
const ASSETS = path.join(__dirname, "assets");

// ---- Company details (edit here if anything changes) ----
const COMPANY = {
  name: "BillWallah",
  gstin: "13DFDPM9359P1ZP",
  placeOfSupply: "13/Nagaland",
  addr1: "BOC South Point, Near Taxi Stand",
  addr2: "Zunheboto, Nagaland 798620",
  email: "support@billwallah.com",
  signatory: "Founder & CEO",
  hsn: process.env.HSN_SAC || "-",
  jurisdiction: process.env.JURISDICTION || "Zunheboto, Nagaland",
};

const NAVY = "#113766";
const SKY = "#1aa7e8";
const INK = "#1f2933";
const MUTED = "#5b6670";
const RULE = "#d5dbe3";
const SOFT = "#f2f5fa";
const GREEN = "#2e9e4f";

/**
 * data: { invoice_no, order_id, name, email, phone, amount, service, paid_at }
 * invoice_no = the Cashfree invoice number. Falls back to order_id.
 */
function generateBill(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Tax Invoice - BillWallah", Author: COMPANY.name } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("R", path.join(ASSETS, "fonts", "LiberationSans-Regular.ttf"));
    doc.registerFont("B", path.join(ASSETS, "fonts", "LiberationSans-Bold.ttf"));

    doc.page.margins.bottom = -5000; // we draw in scaled px space, so stop auto page-breaks
    doc.scale(595.276 / 920);        // layout below uses a 920px-wide canvas

    const amount = Number(data.amount);
    const d = data.paid_at ? new Date(data.paid_at) : new Date();
    const dateStr = d.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", month: "short", day: "2-digit", year: "numeric" });
    const invNo = data.invoice_no || data.order_id || "-";
    const service = data.service || "Mobile & DTH Recharge";

    // cy = vertical centre of the text line (px)
    const T = (s, x, cy, o = {}) => {
      const size = o.size || 12.5;
      doc.font(o.bold ? "B" : "R").fontSize(size).fillColor(o.color || INK);
      const w = o.w || 400;
      const tx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
      doc.text(String(s), tx, cy - size * 0.54, { width: w, align: o.align || "left", lineBreak: false });
    };
    const B = (s, x, cy, o = {}) => T(s, x, cy, { ...o, bold: true });
    const hline = (y, x1 = 56, x2 = 893, c = RULE, w = 0.8) => doc.lineWidth(w).moveTo(x1, y).lineTo(x2, y).strokeColor(c).stroke();

    // Top accent bar
    doc.rect(0, 0, 920, 12).fill(NAVY);
    doc.rect(0, 12, 920, 3).fill(SKY);

    // Title
    B("TAX INVOICE", 460, 58, { size: 26, align: "center", color: NAVY, w: 400 });
    T("Original for Recipient", 460, 82, { size: 12.5, align: "center", color: MUTED, w: 400 });

    // Company block (logo + name + address)
    doc.image(path.join(ASSETS, "logo.jpg"), 56, 112, { width: 88 });
    B(COMPANY.name, 160, 128, { size: 24, color: NAVY });
    T(COMPANY.addr1, 160, 154, { size: 12.5, color: MUTED });
    T(COMPANY.addr2, 160, 172, { size: 12.5, color: MUTED });
    T(COMPANY.email, 160, 190, { size: 12.5, color: MUTED });
    B("GSTIN:", 56, 228, { size: 12.5, color: NAVY, w: 60 });
    T(COMPANY.gstin, 106, 228, { size: 12.5 });
    B("Place of Supply:", 56, 247, { size: 12.5, color: NAVY, w: 120 });
    T(COMPANY.placeOfSupply, 160, 247, { size: 12.5 });

    // Billed to
    let y = 128;
    B("BILLED TO", 440, y, { size: 12, color: NAVY });
    B((data.name || "Customer").toUpperCase(), 440, (y += 24), { size: 13 });
    if (data.phone) T("Mobile: " + data.phone, 440, (y += 20));
    if (data.email) T(data.email, 440, (y += 20), { w: 250 });

    // Invoice meta
    const meta = (l, v, cy) => { B(l, 710, cy, { size: 12, color: NAVY, w: 110 }); T(v, 710, cy + 17, { size: 12.5, w: 190 }); };
    meta("INVOICE NO", invNo, 128);
    meta("DATE", dateStr, 176);
    meta("PAYMENT MODE", "UPI", 224);

    // PAID badge (top right, beside the title)
    doc.save().rotate(-8, { origin: [790, 62] });
    doc.lineWidth(3).roundedRect(775, 40, 100, 42, 6).strokeColor(GREEN).stroke();
    doc.font("B").fontSize(30).fillColor(GREEN).text("PAID", 775, 46, { width: 100, align: "center", lineBreak: false });
    doc.restore();

    // Table header band
    doc.rect(56, 282, 837, 36).fill(NAVY);
    const H = (s, x, o = {}) => B(s, x, 300, { size: 12.5, color: "#ffffff", ...o });
    H("DESCRIPTION", 70);
    H("HSN/SAC", 395, { align: "center", w: 100 });
    H("GST %", 495, { align: "center", w: 80 });
    H("QTY", 580, { align: "center", w: 70 });
    H("RATE (INR)", 740, { align: "right", w: 140 });
    H("AMOUNT (INR)", 880, { align: "right", w: 150 });

    // Group row
    doc.rect(56, 318, 837, 34).fill(SOFT);
    B("RECHARGE AND BILL PAYMENT", 70, 336, { size: 12.5, color: NAVY });

    // Item row
    T(service, 70, 380, { size: 13, w: 320 });
    T(COMPANY.hsn, 395, 380, { align: "center", w: 100, size: 13 });
    T("0.00", 495, 380, { align: "center", w: 80, size: 13 });
    T("1", 580, 380, { align: "center", w: 70, size: 13 });
    T(inr(amount), 740, 380, { align: "right", w: 140, size: 13 });
    T(inr(amount), 880, 380, { align: "right", w: 150, size: 13 });
    hline(408);

    // Totals
    const R1 = (l, v, cy, bold) => {
      T(l, 700, cy, { align: "right", w: 220, size: 13, bold, color: bold ? INK : MUTED });
      T(v, 880, cy, { align: "right", w: 160, size: 13, bold });
    };
    R1("Taxable Sub Total", "INR " + inr(amount), 436, true);
    R1("CGST @ 0%", "INR 0.00", 462);
    R1("SGST @ 0%", "INR 0.00", 484);
    R1("IGST @ 0%", "INR 0.00", 506);
    doc.rect(500, 528, 393, 38).fill(NAVY);
    T("Total Amount Received", 520, 547, { color: "#fff", size: 14 });
    B("INR " + inr(amount), 880, 547, { color: "#fff", size: 15, align: "right", w: 200 });

    // Amount in words
    doc.roundedRect(56, 592, 837, 40, 4).fill(SOFT);
    T("Amount in words:", 72, 612, { size: 13, color: MUTED });
    B(amountInWords(amount), 200, 612, { size: 13.5, w: 680 });

    // Signatory
    T("For " + COMPANY.name, 874, 664, { align: "right", w: 300, size: 13, color: MUTED });
    doc.image(path.join(ASSETS, "stamp.png"), 786, 674, { width: 88 });
    doc.image(path.join(ASSETS, "signature.png"), 780, 738, { width: 94 });
    hline(788, 700, 874, "#9aa5b1", 0.8);
    B(COMPANY.signatory, 874, 804, { align: "right", w: 300, size: 13 });
    T("Authorized Signatory", 874, 822, { align: "right", w: 300, size: 12, color: MUTED });

    // Notes
    hline(850);
    const N = (s, cy) => T(s, 56, cy, { size: 11.5, w: 840, color: MUTED });
    B("NOTE:", 56, 872, { size: 11.5, color: INK });
    T(`Any disputes or discrepancies arising in relation to this invoice shall be raised to ${COMPANY.name} through email ${COMPANY.email},`, 100, 872, { size: 11.5, w: 800, color: MUTED });
    N("within 10 (ten) working days from the date of issuance of this invoice, failing which this invoice will be deemed to be final and accepted.", 892);
    N(`Any dispute arising out of this invoice shall be subject to the exclusive jurisdiction of the courts of ${COMPANY.jurisdiction}.`, 912);
    N("Whether the tax is payable on reverse charge basis - No", 932);
    N("This is a computer-generated invoice.", 952);

    // Footer
    doc.rect(0, 1195, 920, 106).fill(NAVY);
    doc.rect(0, 1192, 920, 3).fill(SKY);
    B("THANK YOU FOR YOUR BUSINESS", 460, 1222, { size: 15, align: "center", w: 600, color: "#ffffff" });
    T(`${COMPANY.name}  |  ${COMPANY.addr1}, ${COMPANY.addr2}`, 460, 1248, { size: 11.5, align: "center", w: 880, color: "#dbe6f5" });
    T(`Email: ${COMPANY.email}  |  GSTIN: ${COMPANY.gstin}`, 460, 1268, { size: 11.5, align: "center", w: 880, color: "#dbe6f5" });

    doc.end();
  });
}

module.exports = { generateBill, amountInWords };
