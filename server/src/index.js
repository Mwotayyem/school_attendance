import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { pingFirestore } from './firestore.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import teacherRoutes from './routes/teachers.js';
import absenceRoutes from './routes/absences.js';
import reportRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// فحص صحة الخادم (يستخدمه Cloud Run)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// المسارات
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/reports', reportRoutes);

// تقديم الواجهة الثابتة (مجلد public في جذر المشروع)
const publicDir = path.resolve(__dirname, '../../public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// معالج الأخطاء العام
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

const PORT = process.env.PORT || 8080;

// نتحقق من الوصول إلى Firestore عند البدء (تحذير فقط، لا يمنع التشغيل)
pingFirestore()
  .then(() => console.log('✅ تم الاتصال بـ Firestore'))
  .catch((e) => console.warn('⚠️ تعذّر التحقق من Firestore:', e.message));

app.listen(PORT, () => console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`));
