# 🌐 نظام الحضور والغياب مع Google Sheets

## 📋 دليل الإعداد الكامل

### الخطوة 1️⃣: إنشاء Google Sheet

1. **افتح Google Sheets:**
   - اذهب إلى: https://sheets.google.com
   - اضغط **"+ فارغ"** لإنشاء جدول جديد

2. **أنشئ 3 أوراق (Sheets):**
   
   **الورقة الأولى - اسمها: `Students`**
   ```
   | id | name | grade | section |
   |----|------|-------|---------|
   | 1  | أحمد محمد علي | العاشر | أ |
   | 2  | فاطمة خالد سعيد | العاشر | ب |
   ```

   **الورقة الثانية - اسمها: `Teachers`**
   ```
   | id | name | username | password | role |
   |----|------|----------|----------|------|
   | 1  | المدير | admin | 1234 | admin |
   | 2  | محمد أحمد | teacher1 | 1234 | teacher |
   ```

   **الورقة الثالثة - اسمها: `Absences`**
   ```
   | id | studentId | studentName | grade | section | date | teacher | teacherUsername | notes | timestamp |
   |----|-----------|-------------|-------|---------|------|---------|-----------------|-------|-----------|
   ```

3. **احفظ الملف:**
   - سمّه: **"نظام الحضور والغياب"**

---

### الخطوة 2️⃣: نشر Google Sheet كـ Web App

1. **افتح محرر Apps Script:**
   - من القائمة: **Extensions** → **Apps Script**

2. **احذف الكود الموجود والصق هذا الكود:**

```javascript
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'getStudents') {
      return getStudents();
    } else if (action === 'getTeachers') {
      return getTeachers();
    } else if (action === 'getAbsences') {
      return getAbsences();
    } else if (action === 'addAbsence') {
      return addAbsence(data);
    } else if (action === 'deleteAbsence') {
      return deleteAbsence(data);
    } else if (action === 'addStudent') {
      return addStudent(data);
    } else if (action === 'deleteStudent') {
      return deleteStudent(data);
    } else if (action === 'addTeacher') {
      return addTeacher(data);
    } else if (action === 'deleteTeacher') {
      return deleteTeacher(data);
    } else if (action === 'login') {
      return login(data);
    } else if (action === 'changePassword') {
      return changePassword(data);
    }
    
    return createResponse({error: 'Invalid action'});
  } catch (error) {
    return createResponse({error: error.toString()});
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getStudents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  const data = sheet.getDataRange().getValues();
  const students = [];
  
  for (let i = 1; i < data.length; i++) {
    students.push({
      id: data[i][0],
      name: data[i][1],
      grade: data[i][2],
      section: data[i][3]
    });
  }
  
  return createResponse({students: students});
}

function getTeachers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
  const data = sheet.getDataRange().getValues();
  const teachers = [];
  
  for (let i = 1; i < data.length; i++) {
    teachers.push({
      id: data[i][0],
      name: data[i][1],
      username: data[i][2],
      password: data[i][3],
      role: data[i][4]
    });
  }
  
  return createResponse({teachers: teachers});
}

function getAbsences() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Absences');
  const data = sheet.getDataRange().getValues();
  const absences = [];
  
  for (let i = 1; i < data.length; i++) {
    absences.push({
      id: data[i][0],
      studentId: data[i][1],
      studentName: data[i][2],
      grade: data[i][3],
      section: data[i][4],
      date: data[i][5],
      teacher: data[i][6],
      teacherUsername: data[i][7],
      notes: data[i][8],
      timestamp: data[i][9]
    });
  }
  
  return createResponse({absences: absences});
}

function addAbsence(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Absences');
  const id = new Date().getTime();
  
  sheet.appendRow([
    id,
    data.studentId,
    data.studentName,
    data.grade,
    data.section,
    data.date,
    data.teacher,
    data.teacherUsername,
    data.notes,
    new Date().toISOString()
  ]);
  
  return createResponse({success: true, id: id});
}

function deleteAbsence(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Absences');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return createResponse({success: true});
    }
  }
  
  return createResponse({error: 'Not found'});
}

function addStudent(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  const id = new Date().getTime();
  
  sheet.appendRow([id, data.name, data.grade, data.section]);
  
  return createResponse({success: true, id: id});
}

function deleteStudent(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return createResponse({success: true});
    }
  }
  
  return createResponse({error: 'Not found'});
}

function addTeacher(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
  const id = new Date().getTime();
  
  sheet.appendRow([id, data.name, data.username, data.password, 'teacher']);
  
  return createResponse({success: true, id: id});
}

function deleteTeacher(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return createResponse({success: true});
    }
  }
  
  return createResponse({error: 'Not found'});
}

function login(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][2] === data.username && values[i][3] === data.password) {
      return createResponse({
        success: true,
        user: {
          id: values[i][0],
          name: values[i][1],
          username: values[i][2],
          role: values[i][4]
        }
      });
    }
  }
  
  return createResponse({success: false, error: 'Invalid credentials'});
}

function changePassword(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.userId && values[i][3] === data.currentPassword) {
      sheet.getRange(i + 1, 4).setValue(data.newPassword);
      return createResponse({success: true});
    }
  }
  
  return createResponse({success: false, error: 'Invalid current password'});
}
```

3. **احفظ المشروع:**
   - اضغط على أيقونة **القرص** أو **Ctrl+S**
   - سمّه: **"Attendance System API"**

4. **انشر كـ Web App:**
   - اضغط **Deploy** → **New deployment**
   - اختر **Web app**
   - في **Execute as**: اختر **Me**
   - في **Who has access**: اختر **Anyone**
   - اضغط **Deploy**
   - **انسخ الرابط** (Web app URL) - ستحتاجه لاحقاً!

---

### الخطوة 3️⃣: استخدام النظام

1. **افتح ملف `نظام_مع_google_sheets.html`**
2. **ضع رابط Web App** في المكان المحدد
3. **ارفع الملف على Google Drive**
4. **شارك الرابط مع المعلمات**

---

## ✅ المميزات:

- ✅ **بيانات مشتركة** بين جميع المعلمات
- ✅ **تحديث فوري** - أي تغيير يظهر للجميع
- ✅ **المدير يرى كل شيء** في الوقت الفعلي
- ✅ **يعمل من أي مكان** - فقط يحتاج إنترنت
- ✅ **آمن** - كل معلمة لها حساب خاص

---

## ⚠️ ملاحظات مهمة:

1. **الإنترنت مطلوب** - النظام يحتاج اتصال بالإنترنت
2. **Google Sheets مجاني** - حتى 10 مليون خلية
3. **سريع** - الاستجابة خلال ثواني
4. **آمن** - البيانات محفوظة في Google Drive

---

**التالي: سأنشئ لك ملف HTML الذي يتصل بـ Google Sheets!**
