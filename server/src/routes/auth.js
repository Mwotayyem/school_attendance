import { Router } from 'express';
import * as Teachers from '../data/teachers.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// تسجيل الدخول
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور' });
  }

  const user = await Teachers.findByUsername(username);
  if (!user || !(await Teachers.comparePassword(password, user.password))) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const safe = Teachers.sanitize(user);
  const token = signToken(safe);
  res.json({ token, user: safe });
});

// تغيير كلمة المرور للمستخدم الحالي
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' });
  }

  const user = await Teachers.findById(req.user.id);
  if (!user || !(await Teachers.comparePassword(currentPassword, user.password))) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }

  await Teachers.updateTeacher(req.user.id, { password: newPassword });
  res.json({ ok: true });
});

export default router;
