import 'dotenv/config';
import * as Teachers from './data/teachers.js';
import * as Students from './data/students.js';

// الطلاب الثابتون (مع التخصص)
const FIXED_STUDENTS = [
  { name: 'أحمد محمد علي', grade: 'العاشر', section: 'أ', track: 'علمي' },
  { name: 'فاطمة خالد سعيد', grade: 'العاشر', section: 'أ', track: 'علمي' },
  { name: 'محمد عبدالله حسن', grade: 'العاشر', section: 'أ', track: 'علمي' },
  { name: 'سارة أحمد محمود', grade: 'العاشر', section: 'ب', track: 'أدبي' },
  { name: 'علي حسن عبدالله', grade: 'العاشر', section: 'ب', track: 'أدبي' },
  { name: 'نور محمد خالد', grade: 'العاشر', section: 'ب', track: 'أدبي' },
  { name: 'يوسف عمر سالم', grade: 'العاشر', section: 'ج', track: 'علمي' },
  { name: 'مريم سعيد أحمد', grade: 'العاشر', section: 'ج', track: 'علمي' },
  { name: 'خالد فهد محمد', grade: 'العاشر', section: 'ج', track: 'علمي' },
  { name: 'هند علي حسن', grade: 'العاشر', section: 'د', track: 'أدبي' },
  { name: 'عمر محمود سعيد', grade: 'العاشر', section: 'د', track: 'أدبي' },
  { name: 'ليلى خالد عبدالله', grade: 'العاشر', section: 'د', track: 'أدبي' },
  { name: 'سلمان أحمد علي', grade: 'الأول ثانوي', section: 'أ', track: 'علمي' },
  { name: 'رنا محمد حسن', grade: 'الأول ثانوي', section: 'أ', track: 'علمي' },
  { name: 'طارق سعيد خالد', grade: 'الأول ثانوي', section: 'أ', track: 'علمي' },
  { name: 'دانة علي محمود', grade: 'الأول ثانوي', section: 'ب', track: 'أدبي' },
  { name: 'فهد عبدالله أحمد', grade: 'الأول ثانوي', section: 'ب', track: 'أدبي' },
  { name: 'شهد محمد سالم', grade: 'الأول ثانوي', section: 'ب', track: 'أدبي' },
  { name: 'ناصر خالد علي', grade: 'الأول ثانوي', section: 'ج', track: 'علمي' },
  { name: 'جود حسن محمد', grade: 'الأول ثانوي', section: 'ج', track: 'علمي' },
  { name: 'بدر سالم أحمد', grade: 'الأول ثانوي', section: 'ج', track: 'علمي' },
  { name: 'لمى عبدالله خالد', grade: 'الأول ثانوي', section: 'د', track: 'أدبي' },
  { name: 'زياد محمد علي', grade: 'الأول ثانوي', section: 'د', track: 'أدبي' },
  { name: 'ريم حسن سعيد', grade: 'الأول ثانوي', section: 'د', track: 'أدبي' },
  { name: 'عبدالله أحمد محمد', grade: 'الثاني ثانوي', section: 'أ', track: 'علمي' },
  { name: 'منى خالد علي', grade: 'الثاني ثانوي', section: 'أ', track: 'علمي' },
  { name: 'حمد سعيد حسن', grade: 'الثاني ثانوي', section: 'أ', track: 'علمي' },
  { name: 'نورة محمد عبدالله', grade: 'الثاني ثانوي', section: 'ب', track: 'أدبي' },
  { name: 'سعود علي أحمد', grade: 'الثاني ثانوي', section: 'ب', track: 'أدبي' },
  { name: 'غادة حسن خالد', grade: 'الثاني ثانوي', section: 'ب', track: 'أدبي' },
  { name: 'ماجد محمود سالم', grade: 'الثاني ثانوي', section: 'ج', track: 'علمي' },
  { name: 'هيا أحمد علي', grade: 'الثاني ثانوي', section: 'ج', track: 'علمي' },
  { name: 'راشد خالد محمد', grade: 'الثاني ثانوي', section: 'ج', track: 'علمي' },
  { name: 'أمل سعيد حسن', grade: 'الثاني ثانوي', section: 'د', track: 'أدبي' },
  { name: 'تركي عبدالله أحمد', grade: 'الثاني ثانوي', section: 'د', track: 'أدبي' },
  { name: 'لطيفة محمد خالد', grade: 'الثاني ثانوي', section: 'د', track: 'أدبي' },
];

async function seed() {
  // 1) حساب المديرة الافتراضي (admin / 1234)
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || '1234';
  const existingAdmin = await Teachers.findByUsername(adminUsername);
  if (!existingAdmin) {
    await Teachers.createTeacher({ name: 'المديرة', username: adminUsername, password: adminPassword, role: 'admin' });
    console.log(`✅ تم إنشاء حساب المديرة: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log('ℹ️ حساب المديرة موجود مسبقاً، لم يتغيّر.');
  }

  // 2) معلمة تجريبية مكلّفة بصفّين (teacher / 1234)
  const existingTeacher = await Teachers.findByUsername('teacher');
  if (!existingTeacher) {
    await Teachers.createTeacher({
      name: 'أ. سارة', username: 'teacher', password: '1234', role: 'teacher',
      assignments: [{ grade: 'العاشر', section: 'أ' }, { grade: 'العاشر', section: 'ب' }],
    });
    console.log('✅ تم إنشاء معلمة تجريبية: teacher / 1234 (مكلّفة: العاشر أ، العاشر ب)');
  } else {
    console.log('ℹ️ المعلمة التجريبية موجودة مسبقاً.');
  }

  // 3) الطلاب الثابتون إن كانت المجموعة فارغة
  const studentCount = await Students.countStudents();
  if (studentCount === 0) {
    await Students.insertStudents(FIXED_STUDENTS);
    console.log(`✅ تم إدخال ${FIXED_STUDENTS.length} طالباً.`);
  } else {
    console.log(`ℹ️ يوجد ${studentCount} طالباً مسبقاً، لم تُضف بيانات جديدة.`);
  }

  console.log('🎉 اكتملت التهيئة.');
}

seed().catch((err) => {
  console.error('❌ فشلت التهيئة:', err);
  process.exit(1);
});
