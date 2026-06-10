import { Router } from "express";
  import { db } from "@workspace/db";
  import { licenseTable } from "@workspace/db";
  import { eq } from "drizzle-orm";
  import crypto from "crypto";
  import { execSync } from "child_process";
  import os from "os";
  import fs from "fs";

  const router = Router();

  /**
   * HWID: алгоритм идентичен Python-ядру (desktop/core/main.py).
   * Windows: wmic uuid + hostname → SHA256[:32]
   * macOS:   IOPlatformUUID + hostname → SHA256[:32]
   * Linux:   /etc/machine-id → SHA256[:32]
   */
  function getHWID(): string {
    try {
      let raw = "";
      if (process.platform === "win32") {
        const lines = execSync("wmic csproduct get uuid", { timeout: 3000 })
          .toString().split("\n").map((l) => l.trim()).filter(Boolean);
        const uuid = lines[lines.length - 1] || "";
        raw = uuid + os.hostname();
      } else if (process.platform === "darwin") {
        const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice", { timeout: 3000 }).toString();
        const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        raw = (m ? m[1] : "") + os.hostname();
      } else {
        raw = fs.readFileSync("/etc/machine-id", "utf-8").trim();
      }
      return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32).toUpperCase();
    } catch {
      return crypto.createHash("sha256").update(os.hostname() + String(process.pid)).digest("hex").slice(0, 32).toUpperCase();
    }
  }

  router.get("/status", async (req, res) => {
    try {
      const hwid = getHWID();
      const rows = await db.select().from(licenseTable).where(eq(licenseTable.hwid, hwid)).limit(1);
      const record = rows[0];
      if (!record || !record.licenseKey) {
        return res.json({ hwid, activated: false, licenseType: null, expiresAt: null, daysRemaining: null, email: null });
      }
      let daysRemaining: number | null = null;
      if (record.expiresAt) {
        const ms = record.expiresAt.getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      }
      return res.json({ hwid, activated: true, licenseType: record.licenseType, expiresAt: record.expiresAt?.toISOString() ?? null, daysRemaining, email: record.email ?? null });
    } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
  });

  // ПРЕДУПРЕЖДЕНИЕ: Проверка лицензии только по формату строки (regex).
    // Для продакшна нужен криптографически подписанный ключ или серверная верификация.
    router.post("/activate", async (req, res) => {
    try {
      const { licenseKey, email } = req.body;
      const hwid = getHWID();
      if (!licenseKey) return res.status(400).json({ error: "License key is required" });
      const trialPattern = /^JARVIS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      const permPattern = /^JARVIS-PERM-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      const demoKey = licenseKey === "JARVIS-DEMO-TEST-2024";
      if (!trialPattern.test(licenseKey) && !permPattern.test(licenseKey) && !demoKey) {
        return res.status(400).json({ error: "Invalid license key format" });
      }
      const isPermanent = permPattern.test(licenseKey) || licenseKey.includes("PERM");
      const licenseType = isPermanent ? "permanent" : "trial";
      const expiresAt = isPermanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const existing = await db.select().from(licenseTable).where(eq(licenseTable.hwid, hwid)).limit(1);
      if (existing.length > 0) {
        await db.update(licenseTable).set({ licenseKey, licenseType, email: email ?? null, activatedAt: new Date(), expiresAt }).where(eq(licenseTable.hwid, hwid));
      } else {
        await db.insert(licenseTable).values({ hwid, licenseKey, licenseType, email: email ?? null, activatedAt: new Date(), expiresAt });
      }
      let daysRemaining: number | null = null;
      if (expiresAt) { daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))); }
      return res.json({ hwid, activated: true, licenseType, expiresAt: expiresAt?.toISOString() ?? null, daysRemaining, email: email ?? null });
    } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
  });

  router.post("/deactivate", async (req, res) => {
    try {
      const hwid = getHWID();
      await db.delete(licenseTable).where(eq(licenseTable.hwid, hwid));
      return res.json({ success: true });
    } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
  });

  export default router;
  