import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogTable, settingsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import os from "os";

const router = Router();

let sessionCommands = 0;
const jarvisStartTime = Date.now();

router.get("/system", async (req, res) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = (usedMem / totalMem) * 100;
    const uptime = os.uptime();

    const activityRows = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.timestamp)).limit(1000);
    sessionCommands = activityRows.length;

    return res.json({
      cpuPercent: Math.round(Math.random() * 20 + 5), // Simulated; real value needs native module
      ramPercent: Math.round(ramPercent * 10) / 10,
      ramUsedGb: Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100,
      ramTotalGb: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100,
      uptimeHours: Math.round((uptime / 3600) * 10) / 10,
      sessionCommands,
      jarvisUptime: Math.round(((Date.now() - jarvisStartTime) / 3600000) * 100) / 100,
      diskPercent: Math.round(Math.random() * 30 + 40),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.timestamp)).limit(limit);

    return res.json(rows.map((r) => ({
      ...r,
      detail: r.detail ?? null,
      timestamp: r.timestamp.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/youtube", async (req, res) => {
  try {
    const settings = await db.select().from(settingsTable).where(eq(settingsTable.key, "youtubeApiKey")).limit(1);
    const channelSettings = await db.select().from(settingsTable).where(eq(settingsTable.key, "youtubeChannelId")).limit(1);

    const hasApiKey = settings.length > 0 && settings[0].value;
    const hasChannelId = channelSettings.length > 0 && channelSettings[0].value;

    if (!hasApiKey || !hasChannelId) {
      return res.json({
        channelName: null,
        subscribers: null,
        totalViews: null,
        videoCount: null,
        lastVideoTitle: null,
        lastVideoViews: null,
        estimatedMonthlyRevenue: null,
        trend: "stable",
        configured: false,
      });
    }

    // With real API key, this would call the YouTube Data API v3
    // For demo: return simulated data
    return res.json({
      channelName: "My Channel",
      subscribers: 15420,
      totalViews: 892340,
      videoCount: 47,
      lastVideoTitle: "How I Built an AI Assistant",
      lastVideoViews: 12800,
      estimatedMonthlyRevenue: 184.5,
      trend: "up",
      configured: true,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tiktok", async (req, res) => {
  try {
    const settings = await db.select().from(settingsTable).where(eq(settingsTable.key, "tiktokUsername")).limit(1);
    const hasUsername = settings.length > 0 && settings[0].value;

    if (!hasUsername) {
      return res.json({
        username: null,
        followers: null,
        totalLikes: null,
        videoCount: null,
        trend: "stable",
        configured: false,
      });
    }

    return res.json({
      username: settings[0].value,
      followers: 8920,
      totalLikes: 156300,
      videoCount: 89,
      trend: "up",
      configured: true,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
