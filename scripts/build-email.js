// Inlines emails/welcome.html into api/_welcome.js so the function can send it.
// Run `node scripts/build-email.js` after editing the email.
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "../emails/welcome.html"), "utf8");
fs.writeFileSync(path.join(__dirname, "../api/_welcome.js"),
  "// Generated from emails/welcome.html by scripts/build-email.js. Edit the HTML, not this file.\n" +
  "module.exports = {\n  subject: \"You're on the Driftnote list \u{1F4AD}\",\n  html: " + JSON.stringify(html) + "\n};\n");
console.log("api/_welcome.js written");
