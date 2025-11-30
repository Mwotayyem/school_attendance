function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var doc = SpreadsheetApp.getActiveSpreadsheet();
        var studentSheet = doc.getSheets()[0]; // ورقة الطلاب
        var absenceSheet = doc.getSheetByName('الغيابات');
        var teachersSheet = doc.getSheetByName('المعلمون');

        // إنشاء ورقة الغيابات إذا لم تكن موجودة
        if (!absenceSheet) {
            absenceSheet = doc.insertSheet('الغيابات');
            absenceSheet.appendRow(['المعرف', 'اسم الطالب', 'الصف', 'الشعبة', 'التاريخ', 'المعلم', 'ملاحظات', 'وقت التسجيل']);
        }

        // إنشاء ورقة المعلمين إذا لم تكن موجودة
        if (!teachersSheet) {
            teachersSheet = doc.insertSheet('المعلمون');
            teachersSheet.appendRow(['المعرف', 'الاسم', 'اسم المستخدم', 'كلمة المرور']);
            // إضافة معلم افتراضي
            teachersSheet.appendRow([1, 'معلم افتراضي', 'teacher1', '1234']);
        }

        var requestData = JSON.parse(e.postData.contents);
        var action = requestData.action;

        // --- جلب الطلاب ---
        if (action === 'getStudents') {
            var rows = studentSheet.getRange(2, 1, studentSheet.getLastRow() - 1, studentSheet.getLastColumn()).getValues();
            var headers = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn()).getValues()[0];
            var students = [];

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var student = {};
                for (var j = 0; j < headers.length; j++) {
                    student[headers[j]] = row[j];
                }
                student['id'] = i + 1;
                students.push(student);
            }
            return jsonResponse({ status: 'success', data: students });
        }

        // --- جلب المعلمين (للمدير) ---
        if (action === 'getTeachers') {
            var rows = teachersSheet.getDataRange().getValues();
            var teachers = [];
            // تخطي العنوان
            for (var i = 1; i < rows.length; i++) {
                teachers.push({
                    id: rows[i][0],
                    name: rows[i][1],
                    username: rows[i][2],
                    password: rows[i][3] // المدير يرى كلمات المرور
                });
            }
            return jsonResponse({ status: 'success', data: teachers });
        }

        // --- إضافة معلم ---
        if (action === 'addTeacher') {
            var newId = Math.floor(Math.random() * 10000);
            teachersSheet.appendRow([newId, requestData.name, requestData.username, requestData.password]);
            return jsonResponse({ status: 'success', message: 'تم إضافة المعلم بنجاح' });
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

        // --- تغيير كلمة المرور ---
        if (action === 'changePassword') {
            var rows = teachersSheet.getDataRange().getValues();
            for (var i = 1; i < rows.length; i++) {
                if (rows[i][2] == requestData.username) { // البحث باسم المستخدم
                    teachersSheet.getRange(i + 1, 4).setValue(requestData.newPassword);
                    return jsonResponse({ status: 'success', message: 'تم تغيير كلمة المرور' });
                }
            }
            return jsonResponse({ status: 'error', message: 'المستخدم غير موجود' });
        }

        // --- تعديل بيانات معلم ---
        if (action === 'updateTeacher') {
            var rows = teachersSheet.getDataRange().getValues();
            for (var i = 1; i < rows.length; i++) {
                if (rows[i][0] == requestData.id) {
                    teachersSheet.getRange(i + 1, 2).setValue(requestData.name); // الاسم
                    teachersSheet.getRange(i + 1, 3).setValue(requestData.username); // اسم المستخدم
                    if (requestData.password) { // تحديث كلمة المرور فقط إذا تم إدخالها
                        teachersSheet.getRange(i + 1, 4).setValue(requestData.password);
                    }
                    return jsonResponse({ status: 'success', message: 'تم تحديث بيانات المعلم' });
                }
            }
            return jsonResponse({ status: 'error', message: 'المعلم غير موجود' });
        }

        // --- تسجيل غياب ---
        if (action === 'submitAbsence') {
            absenceSheet.appendRow([
                requestData.studentId,
                requestData.studentName,
                requestData.grade,
                requestData.section,
                requestData.date,
                requestData.teacher,
                requestData.notes,
                new Date()
            ]);
            return jsonResponse({ status: 'success', message: 'تم تسجيل الغياب' });
        }

        // --- حذف غياب (تراجع) ---
        if (action === 'deleteAbsence') {
            var rows = absenceSheet.getDataRange().getValues();
            // البحث عن الغياب وحذفه (مطابقة الطالب والتاريخ)
            for (var i = rows.length - 1; i >= 1; i--) { // البحث من الأسفل للأحدث
                if (rows[i][0] == requestData.studentId && rows[i][4] == requestData.date) {
                    absenceSheet.deleteRow(i + 1);
                    return jsonResponse({ status: 'success', message: 'تم إلغاء الغياب' });
                }
            }
            return jsonResponse({ status: 'error', message: 'سجل الغياب غير موجود' });
        }

        // --- جلب الغيابات (للتقرير) ---
        if (action === 'getAbsences') {
            var rows = absenceSheet.getDataRange().getValues();
            var absences = [];
            for (var i = 1; i < rows.length; i++) {
                absences.push({
                    studentId: rows[i][0],
                    studentName: rows[i][1],
                    grade: rows[i][2],
                    section: rows[i][3],
                    date: formatDate(rows[i][4]), // تنسيق التاريخ
                    teacher: rows[i][5],
                    notes: rows[i][6]
                });
            }
            return jsonResponse({ status: 'success', data: absences });
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

function formatDate(date) {
    if (!date) return '';
    var d = new Date(date);
    var year = d.getFullYear();
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
}
