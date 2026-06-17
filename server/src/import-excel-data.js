import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables before importing firestore
dotenv.config();

import { db, COL } from './firestore.js';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const studentPath = path.join(__dirname, '../../كل طالبات المدرسة.xlsx');
const teacherPath = path.join(__dirname, '../../كل المعلمات.xlsx');

const arToEnMap = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ء': 'a',
  ' ': '.'
};

function transliterate(arStr) {
  if (!arStr) return '';
  let eng = '';
  // Take only first two names for simplicity
  const parts = arStr.trim().split(/\s+/).slice(0, 2);
  const shortened = parts.join(' ');
  
  for (let char of shortened) {
    if (arToEnMap[char]) {
      eng += arToEnMap[char];
    } else if (char === ' ') {
      eng += '.';
    }
  }
  return eng.replace(/\.+/g, '.').toLowerCase();
}

async function runImport() {
  console.log('--- بدء عملية الاستيراد ---');

  // 1. مسح البيانات القديمة
  console.log('1. مسح بيانات الطلاب والمعلمات القديمة...');
  const studentsSnap = await db.collection(COL.students).get();
  let batch = db.batch();
  studentsSnap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`تم مسح ${studentsSnap.size} طالب قديم.`);

  const teachersSnap = await db.collection(COL.teachers).get();
  batch = db.batch();
  teachersSnap.docs.forEach(doc => {
    if (doc.id !== 'admin_user') { // لا نمسح الأدمن
      batch.delete(doc.ref);
    }
  });
  await batch.commit();
  console.log(`تم مسح المعلمات القدامى.`);

  // 2. استيراد الطلاب
  console.log('\n2. قراءة وإدخال ملف الطلاب...');
  const wbStudents = xlsx.readFile(studentPath);
  const sheetStudents = wbStudents.Sheets[wbStudents.SheetNames[0]];
  const studentsData = xlsx.utils.sheet_to_json(sheetStudents);

  const now = new Date().toISOString();
  batch = db.batch();
  let studentCount = 0;
  let batchCount = 0;

  for (const row of studentsData) {
    const sName = row['الاسم الكامل'];
    if (!sName) continue;

    // تنظيف الشعبة إذا كانت تحتوي على اسم المسار (مثال: مسار أكاديمي ج -> ج)
    let section = row['الشعبة'] || '';
    const sectionMatch = section.match(/([أ-ي])$/);
    if (sectionMatch) {
      section = sectionMatch[1];
    } else {
      // إذا لم يكن هناك حرف في النهاية
      section = section.trim();
    }

    const ref = db.collection(COL.students).doc();
    batch.set(ref, {
      name: String(sName).trim(),
      grade: String(row['الصف'] || '').trim(),
      section: String(section).trim(),
      track: String(row['المرحلة / القسم / المسار'] || '').trim(),
      nationalId: String(row['الرقم الوطني / الشخصي'] || '').trim(),
      dob: row['تاريخ الميلاد'] ? String(row['تاريخ الميلاد']).split('T')[0] : '',
      phone: String(row['رقم الهاتف'] || '').trim(),
      parentPhone: String(row['هاتف ولي الأمر'] || '').trim(),
      gender: String(row['الجنس'] || '').trim(),
      nationality: String(row['الجنسية'] || '').trim(),
      createdAt: now,
      updatedAt: now
    });

    studentCount++;
    batchCount++;
    if (batchCount === 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  console.log(`تم إدخال ${studentCount} طالب بنجاح.`);

  // 3. استيراد المعلمات
  console.log('\n3. قراءة وإدخال ملف المعلمات...');
  const wbTeachers = xlsx.readFile(teacherPath);
  const sheetTeachers = wbTeachers.Sheets[wbTeachers.SheetNames[0]];
  const teachersData = xlsx.utils.sheet_to_json(sheetTeachers, { header: 1 });

  batch = db.batch();
  let teacherCount = 0;
  const defaultPasswordHash = await bcrypt.hash('1234', 10);

  // تخطي أول 3 صفوف فارغة/عناوين
  for (let i = 3; i < teachersData.length; i++) {
    const row = teachersData[i];
    if (!row || row.length < 2) continue;
    const tName = row[1];
    if (!tName || typeof tName !== 'string' || tName.trim() === '') continue;

    const username = transliterate(tName);
    
    const ref = db.collection(COL.teachers).doc();
    batch.set(ref, {
      name: tName.trim(),
      username: username,
      password: defaultPasswordHash,
      role: 'teacher',
      assignments: [],
      createdAt: now
    });
    teacherCount++;
  }
  await batch.commit();
  console.log(`تم إنشاء حساب لـ ${teacherCount} معلمة بنجاح بكلمة مرور 1234.`);
  console.log('الرجاء الدخول بلوحة المديرة لرؤية أسماء المستخدمين وإسناد الصفوف لكل معلمة.');

  console.log('\n--- اكتملت العملية بنجاح! ---');
  process.exit(0);
}

runImport().catch(e => {
  console.error('خطأ أثناء الاستيراد:', e);
  process.exit(1);
});
