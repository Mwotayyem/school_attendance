function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var doc = SpreadsheetApp.getActiveSpreadsheet();
        var studentSheet = doc.getSheets()[0];
        var absenceSheet = doc.getSheetByName('الغيابات');
        var teachersSheet = doc.getSheetByName('المعلمون');
        var adminSheet = doc.getSheetByName('المدير');

        // التأكد من وجود ورقة الغيابات
        if (!absenceSheet) {
            absenceSheet = doc.insertSheet('الغيابات');
            absenceSheet.appendRow(['المعرف', 'اسم الطالب', 'الصف', 'الشعبة', 'التاريخ', 'المعلم', 'ملاحظات', 'وقت التسجيل']);
        }

        // التأكد من وجود ورقة المعلمين
        if (!teachersSheet) {
            teachersSheet = doc.insertSheet('المعلمون');
            teachersSheet.appendRow(['المعرف', 'الاسم', 'اسم المستخدم', 'كلمة المرور']);
            teachersSheet.appendRow([1, 'معلم افتراضي', 'teacher1', '1234']);
        }

        // التأكد من وجود ورقة المدير
        if (!adminSheet) {
            adminSheet = doc.insertSheet('المدير');
            adminSheet.appendRow(['اسم المستخدم', 'كلمة المرور']);
            adminSheet.appendRow(['admin', '1234']);
        } else {
            if (adminSheet.getLastRow() < 2) {
                adminSheet.clear();
                adminSheet.appendRow(['اسم المستخدم', 'كلمة المرور']);
                adminSheet.appendRow(['admin', '1234']);
            }
        }

        var requestData = JSON.parse(e.postData.contents);
        var action = requestData.action;

        // ========== جلب الطلاب ==========
        if (action === 'getStudents') {
            var lastRow = studentSheet.getLastRow();
            if (lastRow < 2) {
                return jsonResponse({ status: 'success', data: [] });
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
                // التأكد من وجود معرف فريد
                student['id'] = student['id'] ? String(student['id']) : String(i + 1);
                students.push(student);
            }
            return jsonResponse({ status: 'success', data: students });
        }

        // ========== جلب المعلمين ==========
        if (action === 'getTeachers') {
            if (teachersSheet.getLastRow() < 2) {
                return jsonResponse({ status: 'success', data: [] });
            }
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

        // ========== التحقق من المدير ==========
        if (action === 'checkAdmin') {
            var adminData = adminSheet.getRange(2, 1, 1, 2).getValues()[0];
            if (String(adminData[0]).trim() === String(requestData.username).trim() &&
                String(adminData[1]).trim() === String(requestData.password).trim()) {
                return jsonResponse({ status: 'success', message: 'تم التحقق بنجاح' });
            }
            return jsonResponse({ status: 'error', message: 'بيانات غير صحيحة' });
        }

        // ========== تسجيل غياب ==========
        if (action === 'submitAbsence') {
            var requestStudentId = String(requestData.studentId).trim();
            var requestDate = String(requestData.date).trim();

            // التحقق من عدم وجود غياب مسجل مسبقاً
            if (absenceSheet.getLastRow() >= 2) {
                var existingAbsences = absenceSheet.getDataRange().getValues();

                for (var i = 1; i < existingAbsences.length; i++) {
                    var existingStudentId = String(existingAbsences[i][0]).trim();
                    var existingDate = existingAbsences[i][4];

                    // تحويل التاريخ إلى صيغة موحدة
                    var formattedExistingDate = formatDateToYYYYMMDD(existingDate);

                    // المقارنة بعد التوحيد
                    if (existingStudentId === requestStudentId && formattedExistingDate === requestDate) {
                        return jsonResponse({ status: 'error', message: 'الغياب مسجل مسبقاً لهذا اليوم' });
                    }
                }
            }

            // إضافة الغياب
            absenceSheet.appendRow([
                requestStudentId,
                requestData.studentName,
                requestData.grade,
                requestData.section,
                requestData.date,
                requestData.teacher,
                requestData.notes || '',
                new Date()
            ]);
            return jsonResponse({ status: 'success', message: 'تم تسجيل الغياب' });
        }

        // ========== حذف غياب (تراجع) ==========
        if (action === 'deleteAbsence') {
            try {
                if (absenceSheet.getLastRow() < 2) {
                    return jsonResponse({ status: 'error', message: 'لا توجد غيابات للحذف' });
                }

                var allData = absenceSheet.getDataRange().getValues();
                var requestStudentId = String(requestData.studentId).trim();
                var requestDate = String(requestData.date).trim();

                var rowToDelete = -1;

                // البحث من الأسفل للأعلى (أحدث سجل)
                for (var i = allData.length - 1; i >= 1; i--) {
                    var cellStudentId = String(allData[i][0]).trim();
                    var cellDate = allData[i][4];

                    // تطابق المعرف
                    if (cellStudentId !== requestStudentId) {
                        continue;
                    }

                    // تحويل التاريخ إلى صيغة موحدة للمقارنة
                    var formattedCellDate = formatDateToYYYYMMDD(cellDate);

                    // المقارنة بعد التوحيد
                    if (formattedCellDate === requestDate) {
                        rowToDelete = i + 1;
                        break;
                    }
                }

                if (rowToDelete > 0) {
                    absenceSheet.deleteRow(rowToDelete);
                    return jsonResponse({
                        status: 'success',
                        message: 'تم إلغاء الغياب بنجاح'
                    });
                } else {
                    return jsonResponse({
                        status: 'error',
                        message: 'لم يتم العثور على سجل غياب لهذا الطالب في التاريخ المحدد'
                    });
                }

            } catch (error) {
                return jsonResponse({
                    status: 'error',
                    message: 'خطأ في الحذف: ' + error.toString()
                });
            }
        }

        // ========== جلب الغيابات ==========
        if (action === 'getAbsences') {
            if (absenceSheet.getLastRow() < 2) {
                return jsonResponse({ status: 'success', data: [] });
            }
            var rows = absenceSheet.getDataRange().getValues();
            var absences = [];

            for (var i = 1; i < rows.length; i++) {
                var dateStr = rows[i][4];
                var formattedDate = formatDateToYYYYMMDD(dateStr);

                absences.push({
                    studentId: String(rows[i][0]).trim(),
                    studentName: rows[i][1],
                    grade: rows[i][2],
                    section: rows[i][3],
                    date: formattedDate,
                    teacher: rows[i][5],
                    notes: rows[i][6] || ''
                });
            }
            return jsonResponse({ status: 'success', data: absences });
        }

        // ========== إضافة معلم ==========
        if (action === 'addTeacher') {
            var newId = Math.floor(Math.random() * 10000);
            teachersSheet.appendRow([newId, requestData.name, requestData.username, requestData.password]);
            return jsonResponse({ status: 'success', message: 'تم إضافة المعلم' });
        }

        // ========== حذف معلم ==========
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

        // ========== تعديل معلم ==========
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

        // ========== تغيير كلمة مرور المدير ==========
        if (action === 'changeAdminPassword') {
            adminSheet.getRange(2, 2).setValue(requestData.newPassword);
            return jsonResponse({ status: 'success', message: 'تم تغيير كلمة المرور' });
        }

        // ========== تحديث اسم مستخدم المدير ==========
        if (action === 'updateAdminUsername') {
            var adminData = adminSheet.getRange(2, 1, 1, 2).getValues()[0];
            if (String(adminData[0]) === String(requestData.oldUsername)) {
                adminSheet.getRange(2, 1).setValue(requestData.newUsername);
                return jsonResponse({ status: 'success', message: 'تم التحديث' });
            }
            return jsonResponse({ status: 'error', message: 'الاسم القديم غير صحيح' });
        }

        // ========== تغيير كلمة مرور المعلم ==========
        if (action === 'changePassword') {
            var rows = teachersSheet.getDataRange().getValues();
            for (var i = 1; i < rows.length; i++) {
                if (String(rows[i][2]) === String(requestData.username)) {
                    teachersSheet.getRange(i + 1, 4).setValue(requestData.newPassword);
                    return jsonResponse({ status: 'success', message: 'تم التغيير' });
                }
            }
            return jsonResponse({ status: 'error', message: 'المستخدم غير موجود' });
        }

        return jsonResponse({ status: 'error', message: 'إجراء غير معروف: ' + action });

    } catch (e) {
        return jsonResponse({ status: 'error', message: 'خطأ: ' + e.toString() });
    } finally {
        lock.releaseLock();
    }
}

// دالة مساعدة لتوحيد صيغة التاريخ
function formatDateToYYYYMMDD(dateValue) {
    if (!dateValue) return '';

    var formattedDate = String(dateValue).trim();

    // إذا كان من نوع Date
    if (dateValue instanceof Date) {
        return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }

    // إذا كان نص يحتوي على وقت، استخرج التاريخ
    if (formattedDate.indexOf(' ') > -1) {
        formattedDate = formattedDate.split(' ')[0];
    }

    // إذا كان بصيغة M/D/YYYY أو MM/DD/YYYY
    if (formattedDate.indexOf('/') > -1) {
        var parts = formattedDate.split('/');
        if (parts.length === 3) {
            var month = ('0' + parts[0]).slice(-2);
            var day = ('0' + parts[1]).slice(-2);
            var year = parts[2];
            return year + '-' + month + '-' + day;
        }
    }

    // إذا كان بصيغة YYYY-MM-DD بالفعل
    if (formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return formattedDate;
    }

    return formattedDate;
}

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// دالة للاختبار
function testFormatDate() {
    Logger.log(formatDateToYYYYMMDD('12/4/2024')); // 2024-12-04
    Logger.log(formatDateToYYYYMMDD('2024-12-04')); // 2024-12-04
    Logger.log(formatDateToYYYYMMDD(new Date())); // تاريخ اليوم
}