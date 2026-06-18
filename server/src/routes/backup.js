import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { db, COL } from '../firestore.js';

const router = Router();

// المجموعات المشمولة في النسخة الاحتياطية
const COLLECTIONS = [COL.students, COL.teachers, COL.absences];

// تنزيل نسخة احتياطية كاملة (JSON) — للمديرة
router.get('/export', requireAuth, requireAdmin, async (_req, res) => {
  const data = { version: 1, exportedAt: new Date().toISOString(), collections: {} };
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    // نحفظ معرّف كل وثيقة مع بياناتها لاستعادتها بنفس المعرّف
    data.collections[name] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(data);
});

// استعادة نسخة احتياطية (يستبدل البيانات الحالية) — للمديرة
router.post('/restore', requireAuth, requireAdmin, async (req, res) => {
  const backup = req.body;
  if (!backup || !backup.collections || typeof backup.collections !== 'object') {
    return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
  }

  const summary = {};
  for (const name of COLLECTIONS) {
    const docs = backup.collections[name];
    if (!Array.isArray(docs)) continue;

    // 1) احذف الموجود حالياً (على دفعات)
    const existing = await db.collection(name).get();
    let batch = db.batch();
    let n = 0;
    for (const d of existing.docs) {
      batch.delete(d.ref);
      if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n > 0) await batch.commit();

    // 2) أعد إدخال وثائق النسخة (بنفس المعرّفات)
    batch = db.batch();
    n = 0; let count = 0;
    for (const item of docs) {
      if (!item || !item.id || !item.data) continue;
      batch.set(db.collection(name).doc(String(item.id)), item.data);
      count++;
      if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n > 0) await batch.commit();
    summary[name] = count;
  }

  res.json({ ok: true, restored: summary });
});

export default router;
