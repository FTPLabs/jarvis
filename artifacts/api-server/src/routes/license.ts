import { Router } from "express";
import { db } from "@workspace/db";
import { licenseTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function getHWID(): string {
  const os = process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown-host";
  const user = process.env.USER || process.env.USERNAME || "unknown-user";
  return crypto.createHash("sha256").update(`${os}-${user}`).digest("hex").slice(0, 32).toUpperCase();
}

router.get("/status", async (req, res) => {
  try {
    const hwid = getHWID();
    const rows = await db.select().from(licenseTable).where(eq(licenseTable.hwid, hwid)).limit(1);
    const record = rows[0];

    if (!record || !record.licenseKey) {
      return res.json({
        hwid,
        activated: false,
        licenseType: null,
        expiresAt: null,
        daysRemaining: null,
        email: null,
      });
    }

    let daysRemaining: number | null = null;
    if (record.expiresAt) {
      const ms = record.expiresAt.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    return res.json({
      hwid,
      activated: true,
      licenseType: record.licenseType,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      daysRemaining,
      email: record.email ?? null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/activate", async (req, res) => {
  try {
    const { licenseKey, email } = req.body;
    const hwid = getHWID();

    if (!licenseKey) {
      return res.status(400).json({ error: "License key is required" });
    }

    // Validate key format: JARVIS-XXXX-XXXX-XXXX or JARVIS-PERM-XXXX-XXXX
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
      await db.update(licenseTable).set({
        licenseKey,
        licenseType,
        email: email ?? null,
        activatedAt: new Date(),
        expiresAt,
      }).where(eq(licenseTable.hwid, hwid));
    } else {
      await db.insert(licenseTable).values({
        hwid,
        licenseKey,
        licenseType,
        email: email ?? null,
        activatedAt: new Date(),
        expiresAt,
      });
    }

    let daysRemaining: number | null = null;
    if (expiresAt) {
      daysRemaining = 30;
    }

    return res.json({
      hwid,
      activated: true,
      licenseType,
      expiresAt: expiresAt?.toISOString() ?? null,
      daysRemaining,
      email: email ?? null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
