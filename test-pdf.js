const fs = require("fs");
const { generateBill } = require("./bill");
generateBill({
  invoice_no: "CF/26-27/120854", order_id: "BW-10025", name: "Rahul Kumar", email: "rahul@example.com",
  phone: "9876543210", amount: 299, service: "Mobile & DTH Recharge",
  paid_at: new Date().toISOString(),
}).then((b) => { fs.writeFileSync("sample-invoice.pdf", b); console.log("sample-invoice.pdf created"); });
