// POST /api/subscribe  { email }
// 1) adds the email to the Brevo waitlist list
// 2) sends the branded welcome email (only to brand-new contacts)
// 3) also forwards the signup to the Kit form, so both lists stay in sync
const welcome = require("./_welcome.js");

const KIT_FORM_ID = process.env.KIT_FORM_ID || "10221688";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

async function brevo(path, body) {
  return fetch("https://api.brevo.com/v3" + path, {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false }); }
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body.company) return res.status(200).json({ ok: true }); // honeypot
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ ok: false, error: "bad_email" });

  const results = { brevo: "skipped", welcome: "skipped", kit: "skipped" };

  // Kit (kept as a backup list)
  const kit = (async () => {
    try {
      const fd = new URLSearchParams({ email_address: email });
      const r = await fetch(`https://app.kit.com/forms/${KIT_FORM_ID}/subscriptions`, {
        method: "POST", body: fd, headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      });
      results.kit = r.ok ? "ok" : "error " + r.status;
    } catch { results.kit = "error"; }
  })();

  if (process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID) {
    try {
      const r = await brevo("/contacts", {
        email, listIds: [Number(process.env.BREVO_LIST_ID)], updateEnabled: true,
      });
      const isNew = r.status === 201;
      results.brevo = r.ok ? (isNew ? "created" : "existing") : "error " + r.status;
      if (r.ok && !isNew && r.status !== 204) results.brevo = "error " + r.status;

      if (isNew && process.env.SENDER_EMAIL) {
        const s = await brevo("/smtp/email", {
          sender: { name: process.env.SENDER_NAME || "Driftnote", email: process.env.SENDER_EMAIL },
          replyTo: { email: process.env.REPLY_TO || process.env.SENDER_EMAIL, name: process.env.SENDER_NAME || "Driftnote" },
          to: [{ email }],
          subject: welcome.subject,
          htmlContent: welcome.html,
          tags: ["welcome"],
        });
        results.welcome = s.ok ? "sent" : "error " + s.status;
      }
    } catch (e) { results.brevo = "error"; }
  }

  await kit;
  const saved = results.brevo === "created" || results.brevo === "existing" || results.kit === "ok";
  if (!saved) console.error("subscribe failed", results);
  return res.status(saved ? 200 : 502).json({ ok: saved, ...(process.env.DEBUG_SUBSCRIBE ? results : {}) });
};
