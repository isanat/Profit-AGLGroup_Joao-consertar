import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /notifications
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === "true";
    let notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt));
    if (unreadOnly) notifications = notifications.filter(n => !n.isRead);
    res.json(notifications.map(formatNotification));
  } catch (err) {
    req.log.error({ err }, "List notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /notifications/:id/read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [notif] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)))
      .returning();
    if (!notif) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatNotification(notif));
  } catch (err) {
    req.log.error({ err }, "Mark notification read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /notifications/read-all
router.post("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false)));
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    req.log.error({ err }, "Mark all read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatNotification(n: typeof notificationsTable.$inferSelect) {
  return { id: n.id, userId: n.userId, title: n.title, message: n.message, type: n.type, isRead: n.isRead, createdAt: n.createdAt };
}

export default router;
