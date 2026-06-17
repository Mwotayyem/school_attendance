import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const studentPath = path.join(__dirname, '../كل طالبات المدرسة.xlsx');
const teacherPath = path.join(__dirname, '../كل المعلمات.xlsx');

try {
  const wbStudents = xlsx.readFile(studentPath);
  const sheetStudents = wbStudents.Sheets[wbStudents.SheetNames[0]];
  const students = xlsx.utils.sheet_to_json(sheetStudents);
  console.log('--- STUDENTS ---');
  console.log(students.slice(0, 2));
} catch (e) {
  console.error('Error reading students:', e.message);
}

try {
  const wbTeachers = xlsx.readFile(teacherPath);
  const sheetTeachers = wbTeachers.Sheets[wbTeachers.SheetNames[0]];
  const teachers = xlsx.utils.sheet_to_json(sheetTeachers, { header: 1 });
  console.log('\n--- TEACHERS ---');
  console.log(teachers.slice(0, 10));
} catch (e) {
  console.error('Error reading teachers:', e.message);
}
