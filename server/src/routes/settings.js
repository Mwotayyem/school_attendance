import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import * as Settings from '../data/settings.js';

const router = Router();

// قراءة الإعدادات (لأي مستخدم مسجّل — تُستخدم في عرض الفصول)
router.get('/', requireAuth, async (_req, res) => {
  res.json(await Settings.getSettings());
});

// حفظ الإعدادات (للمديرة فقط)
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const saved = await Settings.saveSettings(req.body || {});
  res.json(saved);
});

export default router;
