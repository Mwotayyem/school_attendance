import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import * as Teachers from '../data/teachers.js';

const router = Router();

// جلب كل المستخدمين (superadmin فقط)
router.get('/', requireAuth, requireSuperAdmin, async (_req, res) => {
  const all = await Teachers.getAllTeachers();
  res.json(all.map(Teachers.sanitize));
});

// إنشاء مستخدم جديد (مديرة أو معلمة)
router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (!name || !username || !password || !['admin', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'يرجى إدخال جميع البيانات والدور بشكل صحيح (admin أو teacher)' });
  }
  const existing = await Teachers.findByUsername(username);
  if (existing) return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });

  const created = await Teachers.createTeacher({ name, username, password, role, assignments: [] });
  res.status(201).json(Teachers.sanitize(created));
});

// تعديل مستخدم (اسم, يوزر, كلمة مرور, دور)
router.put('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (role && !['admin', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'الدور يجب أن يكون admin أو teacher' });
  }
  // منع تكرار اسم المستخدم مع مستخدم آخر
  if (username) {
    const existing = await Teachers.findByUsername(username);
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
    }
  }

  const patch = {};
  if (name) patch.name = name;
  if (username) patch.username = username;
  if (password) patch.password = password;
  if (role) patch.role = role;

  const updated = await Teachers.updateTeacher(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json(Teachers.sanitize(updated));
});

// حذف مستخدم
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  await Teachers.deleteTeacher(req.params.id);
  res.json({ ok: true });
});

export default router;
