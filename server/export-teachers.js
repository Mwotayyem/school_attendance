import dotenv from 'dotenv';
dotenv.config();

import { db, COL } from './src/firestore.js';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const snap = await db.collection(COL.teachers).get();

const rows = [];
snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.role === 'admin') return; // تخطي الأدمن
    rows.push({
        'الاسم الكامل': d.name || '',
        'اسم المستخدم (username)': d.username || '',
        'كلمة المرور': '1234',
        'الصفوف المسندة': (d.assignments || []).map(a => `${a.grade} ${a.section}`).join(' | ') || 'لم تُسند بعد',
    });
});

// ترتيب أبجدي حسب الاسم
rows.sort((a, b) => a['الاسم الكامل'].localeCompare(b['الاسم الكامل'], 'ar'));

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(rows, { header: ['الاسم الكامل', 'اسم المستخدم (username)', 'كلمة المرور', 'الصفوف المسندة'] });

// عرض الأعمدة
ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 15 }, { wch: 30 }];

xlsx.utils.book_append_sheet(wb, ws, 'بيانات المعلمات');

const outPath = path.join(__dirname, '..', 'بيانات_دخول_المعلمات.xlsx');
xlsx.writeFile(wb, outPath);

console.log(`✅ تم إنشاء الملف بنجاح: ${outPath}`);
console.log(`📊 إجمالي المعلمات: ${rows.length}`);

process.exit(0);
