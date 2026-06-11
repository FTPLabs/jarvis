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
   * Fallback: hostname + platform + arch (стабильный, без PID)
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
      if (!raw || raw.length < 4) throw new Error("Empty HWID source");
      return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32).toUpperCase();
    } catch {
      // Стабильный fallback: не используем PID (он меняется при каждом запуске)
      const stable = os.hostname() + process.platform + os.arch() + os.totalmem().toString();
      return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32).toUpperCase();
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

  /**
   * ВНИМАНИЕ: Проверка лицензии выполняется только по формату ключа.
   * Для production необходима криптографически подписанная верификация.
   *
   * Исправлено: убрана уязвимость licenseKey.includes("PERM") —
   * теперь тип определяется ИСКЛЮЧИТЕЛЬНО по permPattern.test().
   */
  router.post("/activate", async (req, res) => {
    try {
      const { licenseKey, email } = req.body;
      const hwid = getHWID();
      if (!licenseKey || typeof licenseKey !== "string") {
        return res.status(400).json({ error: "License key is required" });
      }

      const trimmedKey = licenseKey.trim().toUpperCase();

      // Паттерны: JARVIS-XXXX-XXXX-XXXX (trial) и JARVIS-PERM-XXXX-XXXX (permanent)
      // ВАЖНО: permPattern проверяется ПЕРВЫМ, чтобы JARVIS-PERM-ABCD-EFGH
      // не попал одновременно под trial-паттерн.
      const permPattern = /^JARVIS-PERM-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      const trialPattern = /^JARVIS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      const demoKey = trimmedKey === "JARVIS-DEMO-TEST-2024";

      const isPermanent = permPattern.test(trimmedKey);
      const isTrial = !isPermanent && trialPattern.test(trimmedKey) && !demoKey;
      const isDemo = demoKey;

      if (!isPermanent && !isTrial && !isDemo) {
        return res.status(400).json({ error: "Invalid license key format" });
      }

      const licenseType = isPermanent ? "permanent" : "trial";
      const expiresAt = isPermanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const existing = await db.select().from(licenseTable).where(eq(licenseTable.hwid, hwid)).limit(1);
      if (existing.length > 0) {
        await db.update(licenseTable)
          .set({ licenseKey: trimmedKey, licenseType, email: email ?? null, activatedAt: new Date(), expiresAt })
          .where(eq(licenseTable.hwid, hwid));
      } else {
        await db.insert(licenseTable).values({ hwid, licenseKey: trimmedKey, licenseType, email: email ?? null, activatedAt: new Date(), expiresAt });
      }

      let daysRemaining: number | null = null;
      if (expiresAt) {
        daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      }

      return res.json({ hwid, activated: true, licenseType, expiresAt: expiresAt?.toISOString() ?? null, daysRemaining, email: email ?? null });
    } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
  });

  export default router;
  