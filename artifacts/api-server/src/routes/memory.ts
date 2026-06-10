import { Router } from "express";
import { db } from "@workspace/db";
import { memoryEntriesTable, tasksTable } from "@workspace/db";
import { eq, desc, and, SQL } from "drizzle-orm";

const router = Router();

// Memory entries
router.get("/entries", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const lim = Math.min(Number(limit) || 20, 100);
    const conditions: SQL[] = [];
    if (category && typeof category === "string") {
      conditions.push(eq(memoryEntriesTable.category, category));
    }
    const query = db.select().from(memoryEntriesTable).orderBy(desc(memoryEntriesTable.createdAt)).limit(lim);
    const rows = conditions.length > 0
      ? await db.select().from(memoryEntriesTable).where(conditions[0]).orderBy(desc(memoryEntriesTable.createdAt)).limit(lim)
      : await query;
    const result = rows.map((r) => ({
      ...r,
      tags: JSON.parse(r.tags || "[]"),
      createdAt: r.createdAt.toISOString(),
    }));

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/entries", async (req, res) => {
  try {
    const { content, category, tags, importance } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    const [row] = await db.insert(memoryEntriesTable).values({
      content,
      category: category || "note",
      tags: JSON.stringify(tags || []),
      importance: importance ?? 3,
    }).returning();

    return res.status(201).json({
      ...row,
      tags: JSON.parse(row.tags || "[]"),
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/entries/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(memoryEntriesTable).where(eq(memoryEntriesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Tasks
router.get("/tasks", async (req, res) => {
  try {
    const rows = await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
    return res.json(rows.map((r) => ({
      ...r,
      description: r.description ?? null,
      dueDate: r.dueDate ?? null,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const [row] = await db.insert(tasksTable).values({
      title,
      description: description ?? null,
      priority: priority || "medium",
      status: "pending",
      dueDate: dueDate ?? null,
    }).returning();

    return res.status(201).json({
      ...row,
      description: row.description ?? null,
      dueDate: row.dueDate ?? null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, status, priority, description } = req.body;

    const updates: Partial<typeof tasksTable.$inferInsert> = {};
    if (title !== undefined) updates.title = title;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (description !== undefined) updates.description = description;
    if (status === "done") updates.completedAt = new Date();

    const [row] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();

    if (!row) return res.status(404).json({ error: "Task not found" });

    return res.json({
      ...row,
      description: row.description ?? null,
      dueDate: row.dueDate ?? null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
