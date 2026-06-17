import dotenv from 'dotenv';
dotenv.config();

import { db, COL } from './src/firestore.js';
import bcrypt from 'bcryptjs';

async function createAccounts() {
  const now = new Date().toISOString();

  // 1. إنشاء حساب مدير النظام (superadmin)
  const existSA = await db.collection(COL.teachers).where('username', '==', 'admin').get();
  if (!existSA.empty) {
    // تحديث الحساب الموجود ليصبح superadmin
    const doc = existSA.docs[0];
    await doc.ref.update({
      role: 'superadmin',
      name: 'مدير النظام',
      password: await bcrypt.hash('123', 10),
      updatedAt: now
    });
    console.log('✅ تم تحديث حساب admin إلى superadmin (كلمة المرور: 123)');
  } else {
    await db.collection(COL.teachers).add({
      name: 'مدير النظام',
      username: 'admin',
      password: await bcrypt.hash('123', 10),
      role: 'superadmin',
      assignments: [],
      createdAt: now,
      updatedAt: now
    });
    console.log('✅ تم إنشاء حساب مدير النظام (username: admin, password: 123)');
  }

  // 2. إنشاء حساب مديرة المدرسة (إيناس)
  const existAdmin = await db.collection(COL.teachers).where('username', '==', 'enas').get();
  if (!existAdmin.empty) {
    console.log('ℹ️  حساب المديرة إيناس موجود بالفعل (username: enas)');
  } else {
    await db.collection(COL.teachers).add({
      name: 'إيناس',
      username: 'enas',
      password: await bcrypt.hash('1234', 10),
      role: 'admin',
      assignments: [],
      createdAt: now,
      updatedAt: now
    });
    console.log('✅ تم إنشاء حساب المديرة إيناس (username: enas, password: 1234)');
  }

  console.log('\n📋 ملخص الحسابات:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('مدير النظام:  username=admin    password=123');
  console.log('مديرة المدرسة: username=enas     password=1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

createAccounts().catch(e => { console.error(e); process.exit(1); });
