// ترحيل البيانات من MongoDB المحلي إلى Firestore.
// التشغيل:  node src/migrate-mongo-to-firestore.js
//
// المتطلبات:
//   - MONGODB_URI يشير إلى قاعدة MongoDB المصدر (المحلية)
//   - مصادقة Firestore جاهزة (gcloud ADC أو GOOGLE_APPLICATION_CREDENTIALS)
//   - GOOGLE_CLOUD_PROJECT = معرّف مشروعك على Google Cloud
//
// آمن لإعادة التشغيل: يحذف مجموعات Firestore الثلاث أولاً ثم يكتب من جديد.

import 'dotenv/config';
import mongoose from 'mongoose';
import { db, COL } from './firestore.js';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI || MONGODB_URI.includes('mongodb+srv') === false && !MONGODB_URI.startsWith('mongodb://')) {
  // نقبل أي رابط mongodb صالح
}

async function fetchAll(name) {
  const coll = mongoose.connection.collection(name);
  return coll.find({}).toArray();
}

async function wipeFirestoreCollection(name) {
  const snap = await db.collection(name).get();
  let batch = db.batch(); let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
}

async function migrate() {
  console.log('🔌 الاتصال بـ MongoDB المصدر...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const [teachers, students, absences] = await Promise.all([
    fetchAll('teachers'), fetchAll('students'), fetchAll('absences'),
  ]);
  console.log(`📦 المصدر: ${teachers.length} معلمة/مديرة، ${students.length} طالب، ${absences.length} غياب`);

  console.log('🧹 تفريغ مجموعات Firestore الحالية...');
  await Promise.all([
    wipeFirestoreCollection(COL.teachers),
    wipeFirestoreCollection(COL.students),
    wipeFirestoreCollection(COL.absences),
  ]);

  // خرائط: معرّف MongoDB القديم -> معرّف Firestore الجديد
  const teacherIdMap = new Map();
  const studentIdMap = new Map();

  // 1) المعلمات/المديرة (نُبقي كلمة المرور المشفّرة كما هي)
  console.log('👩‍🏫 ترحيل المعلمات...');
  let batch = db.batch();
  for (const t of teachers) {
    const ref = db.collection(COL.teachers).doc();
    teacherIdMap.set(String(t._id), ref.id);
    batch.set(ref, {
      name: t.name, username: t.username, password: t.password,
      role: t.role || 'teacher', assignments: t.assignments || [],
      createdAt: (t.createdAt || new Date()).toISOString?.() || String(t.createdAt || ''),
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();

  // 2) الطلاب
  console.log('🧑‍🎓 ترحيل الطلاب...');
  batch = db.batch(); let n = 0;
  for (const s of students) {
    const ref = db.collection(COL.students).doc();
    studentIdMap.set(String(s._id), ref.id);
    batch.set(ref, {
      name: s.name, grade: s.grade, section: s.section, track: s.track || '',
      createdAt: (s.createdAt || new Date()).toISOString?.() || String(s.createdAt || ''),
      updatedAt: new Date().toISOString(),
    });
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();

  // 3) الغيابات — نُعيد كتابة المراجع، ونستخدم معرّف studentId_date لمنع التكرار
  console.log('📋 ترحيل الغيابات...');
  batch = db.batch(); n = 0; let skipped = 0;
  for (const a of absences) {
    const newStudentId = studentIdMap.get(String(a.studentId));
    const newTeacherId = a.teacherId ? teacherIdMap.get(String(a.teacherId)) : null;
    if (!newStudentId) { skipped++; continue; } // طالب محذوف
    const docId = `${newStudentId}_${a.date}`;
    const ref = db.collection(COL.absences).doc(docId);
    batch.set(ref, {
      studentId: newStudentId,
      studentName: a.studentName, grade: a.grade, section: a.section, track: a.track || '',
      date: a.date,
      teacherId: newTeacherId, teacher: a.teacher, teacherUsername: a.teacherUsername || '',
      notes: a.notes || '',
      createdAt: (a.createdAt || new Date()).toISOString?.() || String(a.createdAt || ''),
    });
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();

  console.log(`✅ اكتمل الترحيل. (غيابات متجاوزة بسبب طلاب محذوفين: ${skipped})`);
  await mongoose.disconnect();
}

migrate().then(() => process.exit(0)).catch((e) => { console.error('❌ فشل الترحيل:', e); process.exit(1); });
