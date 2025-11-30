function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var doc = SpreadsheetApp.getActiveSpreadsheet();
        var studentSheet = doc.getSheets()[0]; // ورقة الطلاب (الأولى دائماً)
        var absenceSheet = doc.getSheetByName('الغيابات');
        var teachersSheet = doc.getSheetByName('المعلمون');
        var adminSheet = doc.getSheetByName('المدير');

        // 1. التأكد من وجود ورقة الغيابات
        if (!absenceSheet) {
            absenceSheet = doc.insertSheet('الغيابات');
            absenceSheet.appendRow(['المعرف', 'اسم الطالب', 'الصف', 'الشعبة', 'التاريخ', 'المعلم', 'ملاحظات', 'وقت التسجيل']);
        }

        // 2. التأكد من وجود ورقة المعلمين وإضافة معلم افتراضي
        if (!teachersSheet) {
            teachersSheet = doc.insertSheet('المعلمون');
            teachersSheet.appendRow(['المعرف', 'الاسم', 'اسم المستخدم', 'كلمة المرور']);
            teachersSheet.appendRow([1, 'معلم افتراضي', 'teacher1', '1234']);
        }

        // 3. التأكد من وجود ورقة المدير وإضافة مدير افتراضي
        if (!adminSheet) {
            adminSheet = doc.insertSheet('المدير');
            adminSheet.appendRow(['اسم المستخدم', 'كلمة المرور']);
            adminSheet.appendRow(['admin', '1234']);
        } else {
            // إذا كانت الورقة موجودة لكن فارغة، أعد تعبئتها
            if (adminSheet.getLastRow() < 2) {
                adminSheet.clear();
                adminSheet.appendRow(['اسم المستخدم', 'كلمة المرور']);
                adminSheet.appendRow(['admin', '1234']);
            }
        }

        var requestData = JSON.parse(e.postData.contents);
        var action = requestData.action;

        // --- جلب الطلاب ---
        if (action === 'getStudents') {
            var lastRow = studentSheet.getLastRow();
            if (lastRow < 2) {
                return jsonResponse({ status: 'success', data: [] }); // لا يوجد طلاب
            }
            var rows = studentSheet.getRange(2, 1, lastRow - 1, studentSheet.getLastColumn()).getValues();
            var headers = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn()).getValues()[0];
            var students = [];

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var student = {};
                for (var j = 0; j < headers.length; j++) {
                    student[headers[j]] = row[j];
                }
                // إضافة المعرف إذا لم يكن موجوداً
                student['id'] = student['id'] || (i + 1);
                students.push(student);
            }
            return jsonResponse({ status: 'success', data: students });
        }

        // --- جلب المعلمين ---
        if (action === 'getTeachers') {
            if (teachersSheet.getLastRow() < 2) return jsonResponse({ status: 'success', data: [] });
            var rows = teachersSheet.getDataRange().getValues();
            var teachers = [];
            for (var i = 1; i < rows.length; i++) {
                teachers.push({
                    id: rows[i][0],
                    name: rows[i][1],
                    username: rows[i][2],
                    password: rows[i][3]
                });
            }
            return jsonResponse({ status: 'success', data: teachers });
        }

        // --- التحقق من المدير (تسجيل الدخول) ---
        if (action === 'checkAdmin') {
            var adminData = adminSheet.getRange(2, 1, 1, 2).getValues()[0];
            // استخدام String() لضمان مقارنة النصوص والأرقام بشكل صحيح
            if (String(adminData[0]).trim() == String(requestData.username).trim() &&
                String(adminData[1]).trim() == String(requestData.password).trim()) {
                return jsonResponse({ status: 'success', message: 'تم التحقق بنجاح' });
            }
            return jsonResponse({ status: 'error', message: 'بيانات غير صحيحة' });
        }

        // --- تسجيل غياب ---
        if (action === 'submitAbsence') {
            absenceSheet.appendRow([
                requestData.studentId,
                requestData.studentName,
                requestData.grade,
                requestData.section,
                requestData.date, // تأكد أن التاريخ يصل كنص "YYYY-MM-DD"
                requestData.teacher,
                requestData.notes,
                new Date()
            ]);
            return jsonResponse({ status: 'success', message: 'تم تسجيل الغياب' });
        }

        // --- حذف غياب (تراجع) ---
        if (action === 'deleteAbsence') {
            var rows = absenceSheet.getDataRange().getValues();
            var deleted = false;
            // البحث من الأسفل للأعلى (لحذف أحدث غياب لهذا الطالب في هذا اليوم)
            for (var i = rows.length - 1; i >= 1; i--) {
                var rowStudentId = String(rows[i][0]);
                var rowDate = rows[i][4];

                // تحويل تاريخ الصف إلى نص للمقارنة
                var dateString = rowDate;
                if (rowDate instanceof Date) {
                    dateString = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                }

                if (rowStudentId == String(requestData.studentId) && String(dateString) == String(requestData.date)) {
                    absenceSheet.deleteRow(i + 1);
                    deleted = true;
                    break; // حذف سجل واحد فقط والتوقف
                }
            }

            if (deleted) {
                return jsonResponse({ status: 'success', message: 'تم إلغاء الغياب' });
            } else {
                return jsonResponse({ status: 'error', message: 'لم يتم العثور على سجل الغياب' });
            }
        }

        // --- جلب الغيابات ---
        if (action === 'getAbsences') {
            if (absenceSheet.getLastRow() < 2) return jsonResponse({ status: 'success', data: [] });
            var rows = absenceSheet.getDataRange().getValues();
            var absences = [];
            for (var i = 1; i < rows.length; i++) {
                var dateStr = rows[i][4];
                if (dateStr instanceof Date) {
                    dateStr = Utilities.formatDate(dateStr, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                }
                absences.push({
                    studentId: rows[i][0],
                    studentName: rows[i][1],
                    grade: rows[i][2],
                    section: rows[i][3],
                    date: dateStr,
                    teacher: rows[i][5],
                    notes: rows[i][6]
                });
            }
            return jsonResponse({ status: 'success', data: absences });
        }

        // --- إضافة معلم ---
        if (action === 'addTeacher') {
            var newId = Math.floor(Math.random() * 10000);
            teachersSheet.appendRow([newId, requestData.name, requestData.username, requestData.password]);
            return jsonResponse({ status: 'success', message: 'تم إضافة المعلم' });
        }

        // --- حذف معلم ---
        if (action === 'deleteTeacher') {
            var rows = teachersSheet.getDataRange().getValues();
            for (var i = 1; i < rows.length; i++) {
                if (rows[i][0] == requestData.id) {
                    teachersSheet.deleteRow(i + 1);
                    return jsonResponse({ status: 'success', message: 'تم حذف المعلم' });
                }
            }
            return jsonResponse({ status: 'error', message: 'المعلم غير موجود' });
        }

        // --- تعديل معلم ---
        if (action === 'updateTeacher') {
            var rows = teachersSheet.getDataRange().getValues();
            for (var i = 1; i < rows.length; i++) {
                if (rows[i][0] == requestData.id) {
                    teachersSheet.getRange(i + 1, 2).setValue(requestData.name);
                    teachersSheet.getRange(i + 1, 3).setValue(requestData.username);
                    return jsonResponse({ status: 'success', message: 'تم التحديث' });
                }
            }
            return jsonResponse({ status: 'error', message: 'المعلم غير موجود' });
        }

        // --- تغيير كلمة مرور المدير ---
        if (action === 'changeAdminPassword') {
            adminSheet.getRange(2, 2).setValue(requestData.newPassword);
            return jsonResponse({ status: 'success', message: 'تم تغيير كلمة المرور' });
        }

        // --- تحديث اسم مستخدم المدير ---
        if (action === 'updateAdminUsername') {
            var adminData = adminSheet.getRange(2, 1, 1, 2).getValues()[0];
            if (String(adminData[0]) == String(requestData.oldUsername)) {
                adminSheet.getRange(2, 1).setValue(requestData.newUsername);
                return jsonResponse({ status: 'success', message: 'تم التحديث' });
            }
            return jsonResponse({ status: 'error', message: 'الاسم القديم غير صحيح' });
        }

        // --- تغيير كلمة مرور المعلم ---
        if (action === 'changePassword') {
            var rows = teachersSheet.getDataRange().getValues();
            for (var i = 1; i < rows.length; i++) {
                if (String(rows[i][2]) == String(requestData.username)) {
                    teachersSheet.getRange(i + 1, 4).setValue(requestData.newPassword);
                    return jsonResponse({ status: 'success', message: 'تم التغيير' });
                }
            }
            return jsonResponse({ status: 'error', message: 'المستخدم غير موجود' });
        }

    } catch (e) {
        return jsonResponse({ status: 'error', message: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
