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
    let dateStr = Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM-dd");
    let timeStr = Utilities.formatDate(today, "Asia/Jakarta", "HH:mm");
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
      let val = data[i][j];
      // Konversi Date object ke string agar tidak rusak saat JSON serialize
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
      }
      // Paksa kolom ID (BARCODE) selalu string agar leading zero tidak hilang
      if (headers[j] === "ID (BARCODE)") {
        val = String(val);
      }
      member[headers[j]] = val;
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
      let val = data[i][j];
      let key = headers[j];

      // Normalisasi kolom TANGGAL → string "yyyy-MM-dd"
      if (key === "TANGGAL") {
        if (val instanceof Date) {
          val = Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
        } else {
          val = String(val).substring(0, 10);
        }
      }

      // Normalisasi kolom WAKTU → string "HH:mm"
      if (key === "WAKTU") {
        if (val instanceof Date) {
          val = Utilities.formatDate(val, "Asia/Jakarta", "HH:mm");
        } else {
          val = String(val).substring(0, 5);
        }
      }

      // Normalisasi kolom TIMESTAMP → string ISO
      if (key === "TIMESTAMP") {
        if (val instanceof Date) {
          val = Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
        } else {
          val = String(val);
        }
      }

      // Paksa kolom ID (BARCODE) selalu string agar leading zero tidak hilang
      if (key === "ID (BARCODE)") {
        val = String(val);
      }

      rec[key] = val;
    }
    attendance.push(rec);
  }
  return attendance;
}

function processAttendance(data) {
  // Normalisasi ID: paksa string agar leading zero tidak hilang
  let id = String(data.id).trim();
  let status = data.status || "Hadir";
  
  const members = getMembers();
  // Cari anggota: cocokkan string exact dulu, fallback ke perbandingan numerik
  // (menangani kasus ID di spreadsheet terlanjur tersimpan tanpa leading zero)
  let member = members.find(m => String(m["ID (BARCODE)"]) === id);
  if (!member) {
    // Fallback: bandingkan sebagai number (misal "0123" vs 123)
    const idNum = parseFloat(id);
    if (!isNaN(idNum)) {
      member = members.find(m => parseFloat(m["ID (BARCODE)"]) === idNum);
    }
  }
  
  if (!member) {
    return { status: "error", message: "Anggota dengan ID tersebut tidak ditemukan." };
  }

  // Gunakan ID canonical dari data anggota (yang punya leading zero)
  const canonicalId = String(member["ID (BARCODE)"]);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAbsensi = ss.getSheetByName(SHEET_ABSENSI);
  const absensiData = sheetAbsensi.getDataRange().getValues();
  
  // Check if already attended today
  let today = new Date();
  let dateStr = Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM-dd");
  let timeStr = Utilities.formatDate(today, "Asia/Jakarta", "HH:mm");
  
  // Let's assume attendance 1x a day check for 'Hadir', 'Ijin', 'Sakit', 'Alpa'
  for(let i = 1; i < absensiData.length; i++) {
    let rowDate = absensiData[i][1];
    if (typeof rowDate === "object") {
        rowDate = Utilities.formatDate(rowDate, "Asia/Jakarta", "yyyy-MM-dd");
    } else {
        rowDate = String(rowDate).substring(0, 10);
    }
    // Cocokkan ID: string exact ATAU numerik (toleransi data lama tanpa leading zero)
    const rowId = String(absensiData[i][3]);
    const idMatch = rowId === canonicalId ||
                    (!isNaN(parseFloat(rowId)) && !isNaN(parseFloat(canonicalId)) &&
                     parseFloat(rowId) === parseFloat(canonicalId));
    if (idMatch && rowDate === dateStr) {
      return { status: "already", message: "Sudah melakukan absensi hari ini.", member: member };
    }
  }
  
  // Simpan ID sebagai plain text agar leading zero tidak hilang
  const newRow = [today, dateStr, timeStr, canonicalId, member["NAMA LENGKAP"], member["GOL. KEANGGOTAAN"], status];
  const newRowIndex = sheetAbsensi.getLastRow() + 1;
  sheetAbsensi.appendRow(newRow);
  // Paksa kolom ID (kolom ke-4, index 3) sebagai plain text setelah ditulis
  sheetAbsensi.getRange(newRowIndex, 4).setNumberFormat('@').setValue(canonicalId);
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
    if (String(data[i][1]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "Anggota berhasil dihapus" };
    }
  }
  return { status: "error", message: "Anggota tidak ditemukan" };
}

function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Jalankan fungsi ini SEKALI dari Apps Script Editor untuk:
 * 1. Memformat kolom ID di sheet Absensi & Anggota sebagai plain text
 * 2. Memperbaiki data lama yang leading zero-nya hilang dengan mencocokkan ke data Anggota
 */
function fixLeadingZeroIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Fix sheet Anggota: kolom B (ID BARCODE) ---
  const sheetAnggota = ss.getSheetByName(SHEET_ANGGOTA);
  const lastRowA = sheetAnggota.getLastRow();
  if (lastRowA > 1) {
    sheetAnggota.getRange(2, 2, lastRowA - 1, 1).setNumberFormat('@');
  }

  // --- Fix sheet Absensi: kolom D (ID BARCODE) ---
  const sheetAbsensi = ss.getSheetByName(SHEET_ABSENSI);
  const absensiData = sheetAbsensi.getDataRange().getValues();
  const lastRowB = sheetAbsensi.getLastRow();
  if (lastRowB > 1) {
    sheetAbsensi.getRange(2, 4, lastRowB - 1, 1).setNumberFormat('@');
  }

  // Build lookup: numeric value -> canonical ID string dari sheet Anggota
  const anggotaData = sheetAnggota.getDataRange().getValues();
  const numericToCanonical = {};
  for (let i = 1; i < anggotaData.length; i++) {
    const rawId = anggotaData[i][1]; // kolom B
    const strId = String(rawId);
    const numId = parseFloat(strId);
    if (!isNaN(numId)) {
      numericToCanonical[numId] = strId;
    }
  }

  // Perbaiki baris absensi yang ID-nya kehilangan leading zero
  let fixedCount = 0;
  for (let i = 1; i < absensiData.length; i++) {
    const rawId = absensiData[i][3]; // kolom D
    const strId = String(rawId);
    const numId = parseFloat(strId);
    if (!isNaN(numId) && numericToCanonical[numId] && numericToCanonical[numId] !== strId) {
      // ID ini kehilangan leading zero — perbaiki
      sheetAbsensi.getRange(i + 1, 4).setNumberFormat('@').setValue(numericToCanonical[numId]);
      fixedCount++;
    }
  }

  SpreadsheetApp.getUi().alert('Selesai! ' + fixedCount + ' baris ID absensi diperbaiki.');
}
