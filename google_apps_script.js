function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheets()[0]; // نفترض أن الورقة الأولى هي ورقة الطلاب
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;

    if (action === 'getStudents') {
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      var students = [];
      
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var student = {};
        for (var j = 0; j < headers.length; j++) {
          student[headers[j]] = row[j];
        }
        // إضافة معرف فريد إذا لم يكن موجوداً
        student['id'] = i + 1;
        students.push(student);
      }
      
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'success', data: students }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'submitAbsence') {
      var absenceSheet = doc.getSheetByName('الغيابات');
      if (!absenceSheet) {
        absenceSheet = doc.insertSheet('الغيابات');
        absenceSheet.appendRow(['المعرف', 'اسم الطالب', 'الصف', 'الشعبة', 'التاريخ', 'المعلم', 'ملاحظات', 'وقت التسجيل']);
      }
      
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
      
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'success', message: 'تم تسجيل الغياب بنجاح' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
