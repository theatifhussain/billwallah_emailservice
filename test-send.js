// Usage: node test-send.js you@gmail.com
require("dotenv").config();
const to = process.argv[2];
if (!to) { console.log("Usage: node test-send.js you@gmail.com"); process.exit(1); }
const port = process.env.PORT || 3000;
fetch(`http://localhost:${port}/send-bill`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.API_KEY },
  body: JSON.stringify({
    invoice_no: "CF/26-27/120854", order_id: "BW-TEST-1", name: "Test Customer",
    email: to, phone: "9876543210", amount: 299, paid_at: new Date().toISOString(),
  }),
}).then(async (r) => console.log(r.status, await r.text())).catch((e) => console.error(e));
