import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// إنشاء رمز دخول (token) للمستخدم
export function signToken(user) {
  return jwt.sign(
    { id: user.id || user._id?.toString(), role: user.role, name: user.name, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// التحقق من رمز الدخول في الطلبات المحمية
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'غير مصرّح: لا يوجد رمز دخول' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'رمز الدخول غير صالح أو منتهي' });
  }
}

// السماح للمدير فقط
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'هذه العملية للمدير فقط' });
  }
  next();
}
