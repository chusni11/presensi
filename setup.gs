// setup.gs - Google Apps Script Backend

const SCRIPT_VERSION = "1.0";
const SHEET_ANGGOTA = "Anggota";
const SHEET_ABSENSI = "Absensi";
const SHEET_SETTINGS = "Settings";

// Entry point for setup
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Anggota Sheet
  let sheetAnggota = ss.getSheetByName(SHEET_ANGGOTA);
  if (!sheetAnggota) {
    sheetAnggota = ss.insertSheet(SHEET_ANGGOTA);
    sheetAnggota.appendRow(["URL FOTO", "ID (BARCODE)", "NAMA LENGKAP", "NAMA SEKOLAH", "KELAS", "TEMPAT LAHIR", "GOL. KEANGGOTAAN", "KURSUS", "GOL. DARAH", "ALAMAT", "ALAMAT EMAIL", "NO HP"]);
    sheetAnggota.setFrozenRows(1);
    
    // 3 Sampel Data Anggota
    sheetAnggota.appendRow(["https://i.pravatar.cc/150?img=11", "PRM-001", "Budi Santoso", "SMPN 1 Jakarta", "VIII A", "Jakarta", "Penggalang", "Mahir Dasar", "O", "Jl. Merdeka No 1", "budi@email.com", "081234567890"]);
    sheetAnggota.appendRow(["https://i.pravatar.cc/150?img=32", "PRM-002", "Siti Aminah", "SMPN 2 Bandung", "IX B", "Bandung", "Penggalang Garuda", "-", "A", "Jl. Cendrawasih No 5", "siti@email.com", "089876543210"]);
    sheetAnggota.appendRow(["https://i.pravatar.cc/150?img=15", "PRM-003", "Andi Wijaya", "SMAN 3 Surabaya", "X MIPA 1", "Surabaya", "Penegak Bantara", "-", "B", "Jl. Pahlawan No 10", "andi@email.com", "085544332211"]);
  }

  // 2. Setup Absensi Sheet
  let sheetAbsensi = ss.getSheetByName(SHEET_ABSENSI);
  if (!sheetAbsensi) {
    sheetAbsensi = ss.insertSheet(SHEET_ABSENSI);
    sheetAbsensi.appendRow(["TIMESTAMP", "TANGGAL", "WAKTU", "ID (BARCODE)", "NAMA LENGKAP", "GOL. KEANGGOTAAN", "STATUS"]);
    sheetAbsensi.setFrozenRows(1);
    
    // 1 Sampel Absen
    let today = new Date();
    let dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    let timeStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "HH:mm:ss");
    sheetAbsensi.appendRow([today, dateStr, timeStr, "PRM-001", "Budi Santoso", "Penggalang", "Hadir"]);
  }

  // 3. Setup Settings Sheet
  let sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheetSettings) {
    sheetSettings = ss.insertSheet(SHEET_SETTINGS);
    sheetSettings.appendRow(["KEY", "VALUE"]);
    sheetSettings.setFrozenRows(1);
    
    sheetSettings.appendRow(["IMAGE_URL", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Logo_Gerakan_Pramuka.svg/1200px-Logo_Gerakan_Pramuka.svg.png"]);
    sheetSettings.appendRow(["NAMA_PIMPINAN", "Kak Joko Supriyanto, S.Pd"]);
    sheetSettings.appendRow(["KOTA_TANDA_TANGAN", "Jakarta"]);
    sheetSettings.appendRow(["TANGGAL_TANDA_TANGAN", "Otomatis (Hari Ini)"]);
    sheetSettings.appendRow(["ADMIN_PASSWORD", "pramuka123"]); // default password
  }
}

function doGet(e) {
  let action = e.parameter.action;
  
  if (action === 'getSettings') {
    return ContentService.createTextOutput(JSON.stringify(getSettings())).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getMembers') {
    return ContentService.createTextOutput(JSON.stringify(getMembers())).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getAttendance') {
    return ContentService.createTextOutput(JSON.stringify(getAttendance())).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "success", message: "API is runnning."})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let requestData = JSON.parse(e.postData.contents);
  let action = requestData.action;
  
  if (action === 'scanBarcode' || action === 'manualInput') {
    return ContentService.createTextOutput(JSON.stringify(processAttendance(requestData))).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'addMember') {
    return ContentService.createTextOutput(JSON.stringify(addMember(requestData.data))).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'editMember') {
    return ContentService.createTextOutput(JSON.stringify(editMember(requestData.data))).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'deleteMember') {
    return ContentService.createTextOutput(JSON.stringify(deleteMember(requestData.id))).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Unknown action"})).setMimeType(ContentService.MimeType.JSON);
}

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  let settings = {};
  for(let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function getMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ANGGOTA);
  const data = sheet.getDataRange().getValues();
  let members = [];
  let headers = data[0];
  
  for(let i = 1; i < data.length; i++) {
    let member = {};
    for(let j = 0; j < headers.length; j++) {
      member[headers[j]] = data[i][j];
    }
    member._rowIndex = i + 1;
    members.push(member);
  }
  return members;
}

function getAttendance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ABSENSI);
  const data = sheet.getDataRange().getValues();
  let attendance = [];
  let headers = data[0];
  
  for(let i = 1; i < data.length; i++) {
    let rec = {};
    for(let j = 0; j < headers.length; j++) {
      rec[headers[j]] = data[i][j];
    }
    attendance.push(rec);
  }
  return attendance;
}

function processAttendance(data) {
  let id = data.id;
  let status = data.status || "Hadir";
  
  const members = getMembers();
  const member = members.find(m => m["ID (BARCODE)"] === id);
  
  if (!member) {
    return { status: "error", message: "Anggota dengan ID tersebut tidak ditemukan." };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAbsensi = ss.getSheetByName(SHEET_ABSENSI);
  const absensiData = sheetAbsensi.getDataRange().getValues();
  
  // Check if already attended today
  let today = new Date();
  let dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  let timeStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "HH:mm:ss");
  
  // Let's assume attendance 1x a day check for 'Hadir', 'Ijin', 'Sakit', 'Alpa'
  for(let i = 1; i < absensiData.length; i++) {
    let rowDate = absensiData[i][1];
    if (typeof rowDate === "object") {
        rowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    if (absensiData[i][3] === id && rowDate === dateStr) {
      return { status: "info", message: "Sudah melakukan absensi hari ini.", member: member };
    }
  }
  
  sheetAbsensi.appendRow([today, dateStr, timeStr, member["ID (BARCODE)"], member["NAMA LENGKAP"], member["GOL. KEANGGOTAAN"], status]);
  return { status: "success", message: "Absensi Berhasil (" + status + ")!", member: member };
}

function addMember(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ANGGOTA);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  let newRow = [];
  for(let i=0; i<headers.length; i++){
    newRow.push(data[headers[i]] || "");
  }
  sheet.appendRow(newRow);
  return { status: "success", message: "Anggota berhasil ditambahkan" };
}

function editMember(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ANGGOTA);
  let rowIndex = data._rowIndex;
  if(!rowIndex) return {status: "error", message: "Invalid row index"};
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let updateRow = [];
  for(let i=0; i<headers.length; i++){
    updateRow.push(data[headers[i]] || "");
  }
  
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updateRow]);
  return { status: "success", message: "Anggota berhasil diupdate" };
}

function deleteMember(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ANGGOTA);
  const data = sheet.getDataRange().getValues();
  
  for(let i = 1; i < data.length; i++) {
    if (data[i][1] === id) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "Anggota berhasil dihapus" };
    }
  }
  return { status: "error", message: "Anggota tidak ditemukan" };
}

function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}
