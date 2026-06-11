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
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const ramPercent = (usedMem / totalMem) * 100;
      const uptime = os.uptime();

      const sessionStart = new Date(jarvisStartTime);
      const activityRows = await db.select().from(activityLogTable)
        .orderBy(desc(activityLogTable.timestamp)).limit(1000);
      sessionCommands = activityRows.filter(r => r.timestamp >= sessionStart).length;

      return res.json({
        cpuPercent: null,
        ramPercent: Math.round(ramPercent * 10) / 10,
        ramUsedGb: Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100,
        ramTotalGb: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100,
        uptimeHours: Math.round((uptime / 3600) * 10) / 10,
        sessionCommands,
        jarvisUptime: Math.round(((Date.now() - jarvisStartTime) / 3600000) * 100) / 100,
        diskPercent: null,
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

  async function getSettingValue(key: string): Promise<string | null> {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    return rows.length > 0 && rows[0].value ? rows[0].value : null;
  }

  router.get("/youtube", async (req, res) => {
    try {
      const apiKey = await getSettingValue("youtubeApiKey");
      const channelId = await getSettingValue("youtubeChannelId");

      if (!apiKey || !channelId) {
        return res.json({
          channelName: null, subscribers: null, totalViews: null,
          videoCount: null, lastVideoTitle: null, lastVideoViews: null,
          estimatedMonthlyRevenue: null, trend: "stable", configured: false,
        });
      }

      // Реальный вызов YouTube Data API v3
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;
      const channelRes = await fetch(channelUrl, { signal: AbortSignal.timeout(8000) });

      if (!channelRes.ok) {
        req.log.warn({ status: channelRes.status }, "YouTube API error");
        return res.status(502).json({ error: "YouTube API request failed", configured: true });
      }

      const channelData = await channelRes.json() as {
        items?: Array<{
          snippet: { title: string };
          statistics: { subscriberCount: string; viewCount: string; videoCount: string };
        }>;
      };

      const item = channelData.items?.[0];
      if (!item) {
        return res.status(404).json({ error: "Channel not found", configured: true });
      }

      const subscribers = Number(item.statistics.subscriberCount);
      const totalViews = Number(item.statistics.viewCount);
      const videoCount = Number(item.statistics.videoCount);

      // Последнее видео
      let lastVideoTitle: string | null = null;
      let lastVideoViews: number | null = null;
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=1&type=video&key=${encodeURIComponent(apiKey)}`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { items?: Array<{ id: { videoId: string }; snippet: { title: string } }> };
          const videoId = searchData.items?.[0]?.id?.videoId;
          lastVideoTitle = searchData.items?.[0]?.snippet?.title ?? null;
          if (videoId) {
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${encodeURIComponent(apiKey)}`;
            const statsRes = await fetch(statsUrl, { signal: AbortSignal.timeout(5000) });
            if (statsRes.ok) {
              const statsData = await statsRes.json() as { items?: Array<{ statistics: { viewCount: string } }> };
              lastVideoViews = Number(statsData.items?.[0]?.statistics?.viewCount ?? 0);
            }
          }
        }
      } catch { /* последнее видео — не критично */ }

      // Оценочный доход: ~$1-4 за 1000 просмотров (медиана $2)
      const estimatedMonthlyRevenue = lastVideoViews ? Math.round(lastVideoViews * 0.002 * 100) / 100 : null;

      return res.json({
        channelName: item.snippet.title,
        subscribers,
        totalViews,
        videoCount,
        lastVideoTitle,
        lastVideoViews,
        estimatedMonthlyRevenue,
        trend: "stable",
        configured: true,
      });
    } catch (err) {
      req.log.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/tiktok", async (req, res) => {
    try {
      const username = await getSettingValue("tiktokUsername");

      if (!username) {
        return res.json({
          username: null, followers: null, totalLikes: null,
          videoCount: null, trend: "stable", configured: false,
        });
      }

      // TikTok не предоставляет публичный API для третьих сторон.
      // Возвращаем честный статус: настроено, но данные недоступны без официального доступа.
      return res.json({
        username,
        followers: null,
        totalLikes: null,
        videoCount: null,
        trend: "stable",
        configured: true,
        note: "TikTok API требует официального доступа разработчика. Данные недоступны.",
      });
    } catch (err) {
      req.log.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  export default router;
  