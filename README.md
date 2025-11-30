# 🎓 School Attendance System

A simple, serverless school attendance tracking system for managing student absences.

## ✨ Features

- ✅ **No Server Required** - Works completely offline using LocalStorage
- 🎨 **Beautiful Arabic UI** - Modern, responsive design
- 👥 **Two User Roles** - Teacher and Admin
- 📊 **Real-time Statistics** - Track absences instantly
- 📥 **Data Export** - Export to CSV/Excel
- 🔍 **Advanced Filtering** - Filter by grade, section, and date
- 💾 **Persistent Storage** - Data saved in browser

## 🚀 Quick Start

1. Open `attendance_app.html` in any modern browser
2. Login with demo credentials:
   - **Teacher:** username: `teacher`, password: `1234`
   - **Admin:** username: `admin`, password: `1234`

## 📖 Documentation

- **Full Guide:** See `دليل_الاستخدام.md` (Arabic)
- **Quick Reference:** See `بطاقة_مرجعية_سريعة.md` (Arabic)

## 🏫 School Information

- **Total Students:** 250
- **Grades:** 10th, 11th, 12th
- **Sections:** A, B, C, D

## 🔧 How It Works

### For Teachers:
1. Login as teacher
2. Enter student name
3. Select grade and section
4. Add optional notes
5. Submit absence record

### For Admin:
1. Login as admin
2. View all absences from all teachers
3. Filter by grade, section, or date
4. Export data to CSV
5. Delete records if needed

## 💡 Deployment Options (No Server)

### Option 1: Shared Network Folder (Recommended)
- Place file in a shared network folder
- All teachers access the same file
- Data is automatically shared

### Option 2: USB Drive
- Copy file to USB
- Teachers use USB to record absences
- Admin collects USB at end of day

### Option 3: Cloud Storage (Requires Internet)
- Upload to Google Drive or OneDrive
- Share link with teachers
- Everyone accesses same file

### Option 4: Individual Copies
- Copy file to each computer
- Data is NOT shared between computers

## ⚠️ Important Notes

- **Data Storage:** All data is stored in browser's LocalStorage
- **Backup:** Export data daily to prevent data loss
- **Browser Cache:** Don't clear browser data or you'll lose records
- **Compatibility:** Works on Chrome, Firefox, Edge, Safari

## 🛠️ Technical Details

- **Technology:** Pure HTML, CSS, JavaScript
- **Storage:** Browser LocalStorage API
- **Font:** Cairo (Google Fonts)
- **No Dependencies:** No frameworks or libraries required

## 📊 System Capabilities

- Record unlimited absences
- Track multiple grades and sections
- Add teacher notes
- View historical data
- Export to CSV format
- Filter and search records

## 🔐 Adding New Users

To add new teachers, edit the login function in the HTML file:

```javascript
if ((username === 'teacher' && password === '1234' && userType === 'teacher') ||
    (username === 'teacher2' && password === '5678' && userType === 'teacher') ||
    (username === 'admin' && password === '1234' && userType === 'admin')) {
```

## 📝 License

Free to use for educational institutions.

## 🤝 Support

For questions or issues, refer to the full user guide in Arabic.

---

**Developed by Antigravity AI** 🚀  
**Date:** 2025-11-29
