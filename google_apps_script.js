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
            // التحقق من عدم وجود غياب مسجل مسبقاً لنفس الطالب في نفس اليوم
            var existingAbsences = absenceSheet.getDataRange().getValues();
            var requestStudentId = String(requestData.studentId);
            var requestDate = String(requestData.date); // مثل: 2025-12-01

            for (var i = 1; i < existingAbsences.length; i++) {
                var existingStudentId = String(existingAbsences[i][0]);
                var existingDate = existingAbsences[i][4];

                // تحويل التاريخ إلى صيغة موحدة
                var formattedExistingDate = String(existingDate).trim();

                if (existingDate instanceof Date) {
                    formattedExistingDate = Utilities.formatDate(existingDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                }
                // إذا كان بصيغة M/D/YYYY
                else if (formattedExistingDate.indexOf('/') > -1) {
                    var parts = formattedExistingDate.split('/');
                    if (parts.length === 3) {
                        var month = ('0' + parts[0]).slice(-2);
                        var day = ('0' + parts[1]).slice(-2);
                        var year = parts[2];
                        formattedExistingDate = year + '-' + month + '-' + day;
                    }
                }

                // المقارنة بعد التوحيد
                if (existingStudentId === requestStudentId &&
                    formattedExistingDate === requestDate) {
                    return jsonResponse({ status: 'error', message: 'الغياب مسجل مسبقاً لهذا اليوم' });
                }
            }

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
                var requestStudentId = String(requestData.studentId);
                var requestDate = String(requestData.date); // مثل: 2025-12-01

                var rowToDelete = -1;

                // البحث من الأسفل للأعلى (أحدث سجل)
                for (var i = allData.length - 1; i >= 1; i--) {
                    var cellStudentId = String(allData[i][0]); // العمود الأول (المعرف)
                    var cellDate = String(allData[i][4]); // العمود الخامس (التاريخ)

                    // تطابق المعرف
                    var idMatch = (cellStudentId === requestStudentId);

                    // تطابق التاريخ - نتحقق من عدة احتمالات
                    var dateMatch = false;

                    // الاحتمال 1: مطابقة مباشرة "2025-12-01"
                    if (cellDate === requestDate) {
                        dateMatch = true;
                    }

                    // الاحتمال 2: التاريخ مخزن بصيغة أخرى، نحول requestDate
                    // من 2025-12-01 إلى 12/1/2025
                    if (!dateMatch && requestDate.indexOf('-') > -1) {
                        var parts = requestDate.split('-');
                        var year = parts[0];
                        var month = parseInt(parts[1], 10); // إزالة الصفر البادئ
                        var day = parseInt(parts[2], 10);

                        var alternateFormat1 = month + '/' + day + '/' + year;
                        var alternateFormat2 = ('0' + month).slice(-2) + '/' + ('0' + day).slice(-2) + '/' + year;

                        if (cellDate === alternateFormat1 || cellDate === alternateFormat2) {
                            dateMatch = true;
                        }
                    }

                    // الاحتمال 3: عكسي - التاريخ في الخلية بصيغة M/D/YYYY
                    if (!dateMatch && cellDate.indexOf('/') > -1) {
                        var dateParts = cellDate.split('/');
                        if (dateParts.length === 3) {
                            var m = ('0' + dateParts[0]).slice(-2);
                            var d = ('0' + dateParts[1]).slice(-2);
                            var y = dateParts[2];
                            var convertedDate = y + '-' + m + '-' + d;

                            if (convertedDate === requestDate) {
                                dateMatch = true;
                            }
                        }
                    }

                    // إذا تطابق المعرف والتاريخ
                    if (idMatch && dateMatch) {
                        rowToDelete = i + 1; // +1 لأن الصفوف تبدأ من 1
                        break;
                    }
                }

                if (rowToDelete > 0) {
                    absenceSheet.deleteRow(rowToDelete);
                    return jsonResponse({
                        status: 'success',
                        message: 'تم إلغاء الغياب - حذف الصف رقم ' + rowToDelete
                    });
                } else {
                    // للتشخيص: نطبع جميع التواريخ الموجودة لهذا الطالب
                    var studentDates = [];
                    for (var j = 1; j < allData.length; j++) {
                        if (String(allData[j][0]) === requestStudentId) {
                            studentDates.push(String(allData[j][4]));
                        }
                    }

                    return jsonResponse({
                        status: 'error',
                        message: 'لم يتم العثور - المعرف: ' + requestStudentId +
                            ' | التاريخ المطلوب: ' + requestDate +
                            ' | التواريخ الموجودة: [' + studentDates.join(', ') + ']'
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

                // تحويل التاريخ بجميع الصيغ
                var formattedDate = String(dateStr).trim();

                if (dateStr instanceof Date) {
                    formattedDate = Utilities.formatDate(dateStr, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                }
                // إذا كان نص يحتوي على وقت، استخرج التاريخ
                else if (formattedDate.indexOf(' ') > -1) {
                    formattedDate = formattedDate.split(' ')[0];
                }
                // إذا كان بصيغة M/D/YYYY
                else if (formattedDate.indexOf('/') > -1) {
                    var parts = formattedDate.split('/');
                    if (parts.length === 3) {
                        var month = parts[0].padStart(2, '0');
                        var day = parts[1].padStart(2, '0');
                        var year = parts[2];
                        formattedDate = year + '-' + month + '-' + day;
                    }
                }

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

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}