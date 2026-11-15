import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await p.setContent(
  `<html><body style="margin:0;background:#102e35;color:#edf9f5;font-family:system-ui;box-sizing:border-box;padding:64px;height:630px"><div style="font-size:25px;font-weight:700;color:#8ce0c5">✚ pharmaflow</div><p style="letter-spacing:4px;font-size:16px;margin-top:65px;color:#8ce0c5">PHARMACY INVENTORY & POS</p><h1 style="font-size:72px;line-height:1.05;letter-spacing:-3px;margin:22px 0">A clearer day<br>at the pharmacy.</h1><p style="font-size:23px;color:#c1d8dc">React · TypeScript · Vite · NestJS · PostgreSQL</p><div style="margin-top:48px;font-size:19px;color:#8ce0c5">A portfolio project by Md. Fakhrul Alam ↗</div></body></html>`,
);
await p.screenshot({ path: "apps/web/public/social-preview.png" });
await b.close();
