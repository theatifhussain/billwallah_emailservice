require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const { generateBill } = require("./bill");


const express = require("express");
const app = express();

// Request logger MUST come before express.json()
app.use((req, res, next) => {
  console.log(
    "INCOMING_REQUEST:",
    req.method,
    req.originalUrl,
    new Date().toISOString()
  );
  next();
});

app.use(express.json({ limit: "1mb" }));

// MAIL_PROVIDER: "brevo" (HTTPS API, works on free hosting) or "smtp" (Hostinger SMTP, needs paid hosting / VPS)
const PROVIDER = (process.env.MAIL_PROVIDER || (process.env.BREVO_API_KEY ? "brevo" : "smtp")).toLowerCase();
const FROM_EMAIL = process.env.MAIL_FROM || process.env.SMTP_USER || "support@billwallah.com";
const FROM_NAME = process.env.FROM_NAME || "BillWallah";

let _smtp;
const smtp = () => (_smtp ||= nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}));

async function deliver({ to, subject, html, text, pdf, pdfName }) {
  if (PROVIDER === "brevo") {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject, htmlContent: html, textContent: text,
        attachment: [{ name: pdfName, content: pdf.toString("base64") }],
      }),
    });
    if (!r.ok) throw new Error("Brevo " + r.status + " " + (await r.text()));
    return;
  }
  await smtp().sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html, text,
    attachments: [
      { filename: pdfName, content: pdf, contentType: "application/pdf" },
      ...(LOGO_URL ? [] : [{ filename: "logo.jpg", content: LOGO_BUF, contentType: "image/jpeg", cid: "bwlogo", contentDisposition: "inline", headers: { "Content-ID": "<bwlogo>", "X-Attachment-Id": "bwlogo" } }]),
    ],
  });
}

const fs = require("fs");
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
const LOGO_URL = process.env.LOGO_URL || (PROVIDER === "brevo" && PUBLIC_URL ? PUBLIC_URL + "/logo.jpg" : "");
const LOGO_SRC = LOGO_URL || "cid:bwlogo";
const LOGO_BUF = fs.readFileSync(require("path").join(__dirname, "assets", "logo.jpg"));

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

app.get("/logo.jpg", (_req, res) => res.type("image/jpeg").send(LOGO_BUF));
app.get("/", (_req, res) => res.send("BillWallah mail service running"));

app.post("/send-bill", async (req, res) => {
  if (!process.env.API_KEY || req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const d = req.body || {};
  if (!d.email || !d.order_id || !d.amount) {
    return res.status(400).json({ ok: false, error: "email, order_id and amount are required" });
  }
  if (!Number.isFinite(Number(d.amount))) {
    return res.status(400).json({ ok: false, error: "amount must be a number" });
  }

  try {
    const pdf = await generateBill(d);
    const invNo = d.invoice_no || d.order_id;
    const amt = Number(d.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dateStr = (d.paid_at ? new Date(d.paid_at) : new Date()).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", month: "short", day: "2-digit", year: "numeric" });
    const row = (l, v) => `<tr><td style="padding:10px 0;color:#5b6670;font-size:14px;border-bottom:1px solid #e6ebf1">${l}</td><td align="right" style="padding:10px 0;color:#1f2933;font-size:14px;font-weight:600;border-bottom:1px solid #e6ebf1">${v}</td></tr>`;
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f2f5fa;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
  <tr><td style="background:#113766;padding:22px 28px">
    <table role="presentation" width="100%"><tr>
      <td width="56"><img src="${LOGO_SRC}" width="48" height="48" alt="BillWallah" style="display:block;border-radius:8px"></td>
      <td style="color:#ffffff;font-size:22px;font-weight:700;padding-left:12px">BillWallah</td>
    </tr></table></td></tr>
  <tr><td style="height:3px;background:#1aa7e8;font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:30px 28px 10px">
    <div style="display:inline-block;background:#e8f6ec;color:#2e9e4f;font-weight:700;font-size:12px;letter-spacing:1px;padding:5px 12px;border-radius:20px">PAYMENT SUCCESSFUL</div>
    <h2 style="margin:16px 0 6px;color:#113766;font-size:24px">Thank you, ${esc(d.name || "Customer")}!</h2>
    <p style="margin:0;color:#5b6670;font-size:15px;line-height:1.6">Your payment has been received successfully. Your tax invoice is attached to this email as a PDF.</p>
  </td></tr>
  <tr><td style="padding:14px 28px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Service", "Recharge and Bill Payment")}
      ${row("Invoice No", esc(invNo))}
      ${row("Date", esc(dateStr))}
      ${row("Payment Mode", "UPI")}
      <tr><td style="padding:14px 0;color:#113766;font-size:15px;font-weight:700">Amount Paid</td><td align="right" style="padding:14px 0;color:#113766;font-size:20px;font-weight:700">&#8377; ${esc(amt)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:10px 28px 28px">
    <p style="margin:0;color:#5b6670;font-size:14px;line-height:1.6">Need help? Write to us at <a href="mailto:support@billwallah.com" style="color:#113766;font-weight:600">support@billwallah.com</a></p>
  </td></tr>
  <tr><td style="background:#f7f9fc;padding:18px 28px;border-top:1px solid #e6ebf1">
    <p style="margin:0;color:#8a95a1;font-size:12px;line-height:1.6;text-align:center"><b style="color:#5b6670">BillWallah</b><br>BOC South Point, Near Taxi Stand, Zunheboto, Nagaland 798620<br>GSTIN: 13DFDPM9359P1ZP</p>
  </td></tr>
</table></td></tr></table></body></html>`;

    await deliver({
      to: d.email,
      subject: `Payment Successful - Invoice ${invNo}`,
      html,
      text: `Hi ${d.name || "Customer"}, your payment of INR ${amt} was successful. Invoice ${invNo} is attached. - BillWallah`,
      pdf,
      pdfName: `BillWallah-Invoice-${String(invNo).replace(/[^\w.-]/g, "-")}.pdf`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to send email" });
  }
});

// Diagnose malformed JSON requests safely
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    const raw = String(err.body || "");

    console.error(
      "INVALID_JSON_FIRST_CHAR_CODES:",
      Array.from(raw).slice(0, 20).map(char => char.charCodeAt(0))
    );

    return res.status(400).json({
      ok: false,
      error: "Invalid JSON received from request"
    });
  }

  next(err);
});

app.use((req, res, next) => {
  console.log(
    "INCOMING_REQUEST:",
    req.method,
    req.originalUrl,
    new Date().toISOString()
  );
  next();
});

app.listen(process.env.PORT || 3000, () => console.log("Listening"));
