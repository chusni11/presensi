// Global State
let isAdmin = false;
let members = [];
let attendance = [];
let scanReader = null;
let currentSettings = {
    ADMIN_PASSWORD: 'pramuka123',
    NAMA_PIMPINAN: 'Memuat...',
    KOTA_TANDA_TANGAN: '',
    TANGGAL_TANDA_TANGAN: '',
    IMAGE_URL: ''
};

// Pagination State
let currentPage = 1;
let rowsPerPage = 20;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.remove('hidden');

    // Pulihkan status login dari session sebelumnya
    if (sessionStorage.getItem('isAdmin') === 'true') {
        isAdmin = true;
    }

    try {
        await Promise.all([
            fetchSettings(),
            fetchMembers(),
            fetchAttendance()
        ]);
        updateStats();
        populateManualSelect();
        updateVisibility();
        initScanner();
        // Re-render laporan jika view laporan sedang aktif
        if (document.getElementById('report-view').style.display !== 'none') {
            renderReportTable();
        }
    } catch (e) {
        Swal.fire('Error', 'Gagal memuat data dari Spreadsheet. Pastikan URL API sudah benar pada js/api-config.js', 'error');
        console.error(e);
    } finally {
        loadingScreen.classList.add('hidden');
        // Hentikan animasi setelah transisi selesai agar tidak bocor ke tampilan
        loadingScreen.addEventListener('transitionend', () => {
            loadingScreen.style.display = 'none';
        }, { once: true });
    }
}

function setupEventListeners() {
    // Navigation Menus
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.target;
            
            // UI Button Active State
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // View Swapping
            document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
            document.getElementById(targetId).style.display = 'block';

            // Special actions when entering views
            if(targetId === 'scan-view') {
                if(!scanReader) initScanner();
            } else {
                if(scanReader) {
                    scanReader.clear();
                    scanReader = null;
                }
            }

            if(targetId === 'report-view') renderReportTable();
            if(targetId === 'manual-view') {
                document.getElementById('searchAnggotaAbsen').value = '';
                clearManualMember();
            }
            if(targetId === 'admin-view') {
                currentPage = 1;
                renderMembersTable();
            }
        });
    });

    // Login logic
    const inputPassword = document.getElementById('adminPassword');
    document.getElementById('btnLogin').addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'flex';
        setTimeout(() => inputPassword.focus(), 100);
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        isAdmin = false;
        sessionStorage.removeItem('isAdmin');
        updateVisibility();
        Swal.fire('Logout', 'Anda telah keluar dari mode admin.', 'info');
        document.querySelector('[data-target="scan-view"]').click();
    });

    const attemptLogin = () => {
        if(inputPassword.value === currentSettings.ADMIN_PASSWORD) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            inputPassword.value = '';
            closeModal('loginModal');
            updateVisibility();
            Swal.fire({icon: 'success', title: 'Login Berhasil', timer: 1500, showConfirmButton: false});
        } else {
            Swal.fire('Error', 'Password Salah!', 'error');
        }
    };
    document.getElementById('submitLogin').addEventListener('click', attemptLogin);
    inputPassword.addEventListener('keypress', (e) => { if(e.key === 'Enter') attemptLogin(); });

    // Manual Barcode Input
    document.getElementById('btnSubmitBarcode').addEventListener('click', () => {
        const val = document.getElementById('manualBarcode').value.trim();
        if(val) processScan(val);
    });

    // Form Manual Absen
    document.getElementById('formManualAbsen').addEventListener('submit', (e) => {
        e.preventDefault();
        const memId = document.getElementById('selectAnggotaAbsen').value;
        const status = document.getElementById('selectStatus').value;
        if(memId) submitAttendance(memId, status);
    });

    // Search anggota di manual absen
    document.getElementById('searchAnggotaAbsen').addEventListener('input', (e) => {
        renderManualMemberList(e.target.value);
    });

    // Clear selected member
    document.getElementById('btnClearSelected').addEventListener('click', clearManualMember);

    // Sync button
    document.getElementById('btnSyncReport').addEventListener('click', initApp);

    // Print button
    document.getElementById('btnPrintReport').addEventListener('click', () => {
        generatePrintView();
        window.print();
    });

    // Report Filter
    document.getElementById('filterReportType').addEventListener('change', () => {
        // Reset date range saat ganti filter preset
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        renderReportTable();
    });
    document.getElementById('filterDateFrom').addEventListener('change', renderReportTable);
    document.getElementById('filterDateTo').addEventListener('change', renderReportTable);

    // Member Management
    document.getElementById('btnAddMember').addEventListener('click', () => {
        document.getElementById('formMember').reset();
        document.getElementById('memRowIndex').value = '';
        document.getElementById('memberModalTitle').innerText = 'Tambah Anggota';
        document.getElementById('memberModal').style.display = 'flex';
    });
    
    document.getElementById('formMember').addEventListener('submit', (e) => {
        e.preventDefault();
        saveMember();
    });

    document.getElementById('pageSize').addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderMembersTable();
    });

    document.getElementById('searchMember').addEventListener('input', () => {
        currentPage = 1;
        renderMembersTable();
    });

    // Pagination buttons
    document.getElementById('btnNextPage').addEventListener('click', () => { currentPage++; renderMembersTable(); });
    document.getElementById('btnPrevPage').addEventListener('click', () => { if(currentPage > 1) { currentPage--; renderMembersTable(); } });
    document.getElementById('btnFirstPage').addEventListener('click', () => { currentPage = 1; renderMembersTable(); });
    document.getElementById('btnLastPage').addEventListener('click', () => { 
        const filtered = filterMembers(members);
        currentPage = Math.ceil(filtered.length / rowsPerPage) || 1; 
        renderMembersTable(); 
    });
}

function updateVisibility() {
    if(isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
        document.getElementById('btnLogin').style.display = 'none';
        document.getElementById('btnLogout').style.display = '';
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.getElementById('btnLogin').style.display = '';
        document.getElementById('btnLogout').style.display = 'none';
    }
}

function updateStats() {
    document.getElementById('totalMembers').innerText = members.length;
    
    // Calculate Hadir Hari Ini
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    let countHadir = 0;

    // Golongan config: name, icon, color
    const golonganList = [
        { name: 'Siaga',     icon: 'fa-child',             color: '#22c55e' },
        { name: 'Penggalang',icon: 'fa-hiking',             color: '#ef4444' },
        { name: 'Penegak',   icon: 'fa-user-shield',        color: '#eab308' },
        { name: 'Pandega',   icon: 'fa-user-graduate',      color: '#f97316' },
        { name: 'Pembina',   icon: 'fa-chalkboard-teacher', color: '#a855f7' },
    ];

    // Count total members per golongan
    const totalPerGol = {};
    golonganList.forEach(g => totalPerGol[g.name] = 0);
    members.forEach(m => {
        const gol = m["GOL. KEANGGOTAAN"];
        if (totalPerGol.hasOwnProperty(gol)) totalPerGol[gol]++;
    });

    // Build member lookup map: ID -> golongan
    const memberGolMap = {};
    members.forEach(m => {
        memberGolMap[m["ID (BARCODE)"]] = m["GOL. KEANGGOTAAN"];
    });

    // Count hadir today per golongan (lookup golongan dari members jika tidak ada di attendance)
    const hadirPerGol = {};
    golonganList.forEach(g => hadirPerGol[g.name] = 0);
    attendance.forEach(rec => {
        const str = String(rec["TANGGAL"]).substring(0, 10);
        if (str === dateStr) {
            countHadir++;
            const gol = rec["GOL. KEANGGOTAAN"] || memberGolMap[rec["ID (BARCODE)"]] || '';
            if (hadirPerGol.hasOwnProperty(gol)) hadirPerGol[gol]++;
        }
    });

    document.getElementById('totalHadir').innerText = countHadir;

    // Render golongan breakdown — selalu tampil semua golongan
    const container = document.getElementById('golonganStats');
    container.innerHTML = '';
    golonganList.forEach(g => {
        const hadir = hadirPerGol[g.name];
        const total = totalPerGol[g.name];
        const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;
        const card = document.createElement('div');
        card.style.cssText = `
            flex: 1; min-width: 85px; background: rgba(15,23,42,0.5);
            border: 1px solid ${g.color}50; border-radius: 10px;
            padding: 8px 6px; text-align: center;
        `;
        card.innerHTML = `
            <i class="fas ${g.icon}" style="color:${g.color}; font-size:1.1rem; margin-bottom:4px; display:block;"></i>
            <div style="font-size:1.1rem; font-weight:700; color:${g.color}; line-height:1.2;">
                ${hadir}<span style="font-size:0.75rem; opacity:0.6; font-weight:400;">/${total}</span>
            </div>
            <div style="font-size:0.65rem; opacity:0.65; margin: 3px 0 5px;">${g.name}</div>
            <div style="background: rgba(255,255,255,0.1); border-radius:4px; height:4px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${g.color}; border-radius:4px; transition:width 0.6s ease;"></div>
            </div>
            <div style="font-size:0.6rem; opacity:0.5; margin-top:3px;">${pct}%</div>
        `;
        container.appendChild(card);
    });
}

// =======================
// API CALLS (Dummy fetch if Script URL is not set, else real fetch)
// =======================

async function callAPI(action, data = null) {
    if(SCRIPT_URL.includes('YOUR_SCRIPT_ID_HERE')) {
        console.warn("API URL not configured. Returning dummy data.");
        throw new Error("API URL not configured.");
    }
    
    const options = {
        method: data ? 'POST' : 'GET',
        mode: 'cors'
    };
    
    let url = SCRIPT_URL;
    if(data) {
        options.body = JSON.stringify({ action: action, ...data });
    } else {
        url += `?action=${action}`;
    }

    try {
        const response = await fetch(url, options);
        return await response.json();
    } catch(err) {
        throw err;
    }
}

async function fetchSettings() {
    try {
        const res = await callAPI('getSettings');
        currentSettings = { ...currentSettings, ...res };
        
        // Update UI with settings
        if(currentSettings.IMAGE_URL) {
            document.getElementById('mainLogo').src = currentSettings.IMAGE_URL;
            document.getElementById('mainLogo').style.display = 'inline-block';
        }
    } catch(e) {}
}

async function fetchMembers() {
    try {
        const data = await callAPI('getMembers');
        members = data;
        // Debug: cek struktur data pertama jika ada
        if (members.length > 0) {
            console.log('[Debug] Contoh data anggota pertama:', JSON.stringify(members[0]));
            console.log('[Debug] Keys yang tersedia:', Object.keys(members[0]));
        }
    } catch(e) {}
}

async function fetchAttendance() {
    try {
        attendance = await callAPI('getAttendance');
    } catch(e) {}
}

async function submitAttendance(id, status = 'Hadir') {
    Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading()});
    try {
        const result = await callAPI('scanBarcode', { id: id, status: status });
        Swal.close();
        if(result.status === 'success' || result.status === 'info') {
            await fetchAttendance(); // refresh logic
            updateStats();
            showResultModal(result.member, result.status === 'info' ? 'Sudah Absen' : 'Berhasil Absen');
            if(result.status === 'info') Swal.fire('Info', result.message, 'info');
        } else {
            Swal.fire('Gagal', result.message, 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
    }
}

async function saveMember() {
    const memId = document.getElementById('memId').value;
    const memIndex = document.getElementById('memRowIndex').value;
    
    const data = {
        "ID (BARCODE)": memId,
        "NAMA LENGKAP": document.getElementById('memNama').value,
        "URL FOTO": document.getElementById('memFoto').value,
        "NAMA SEKOLAH": document.getElementById('memSekolah').value,
        "KELAS": document.getElementById('memKelas').value,
        "TEMPAT LAHIR": document.getElementById('memLahir').value,
        "GOL. KEANGGOTAAN": document.getElementById('memGol').value,
        "KURSUS": document.getElementById('memKursus').value,
        "GOL. DARAH": document.getElementById('memDarah').value,
        "NO HP": document.getElementById('memHp').value,
        "ALAMAT": document.getElementById('memAlamat').value,
        "ALAMAT EMAIL": document.getElementById('memEmail').value,
    };

    if(memIndex) data._rowIndex = memIndex;

    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading()});
    try {
        const action = memIndex ? 'editMember' : 'addMember';
        const res = await callAPI(action, { data: data });
        if(res.status === 'success') {
            closeModal('memberModal');
            await fetchMembers();
            renderMembersTable();
            populateManualSelect();
            updateStats();
            Swal.fire('Berhasil', res.message, 'success');
        } else {
            Swal.fire('Gagal', res.message, 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
    }
}

async function removeMember(id) {
    if(!confirm("Anda yakin ingin menghapus anggota ini?")) return;
    
    Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading()});
    try {
        const res = await callAPI('deleteMember', { id: id });
        if(res.status === 'success') {
            await fetchMembers();
            renderMembersTable();
            populateManualSelect();
            updateStats();
            Swal.fire('Terhapus', res.message, 'success');
        } else {
            Swal.fire('Gagal', res.message, 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
    }
}

// =======================
// UI RENDERING
// =======================

function populateManualSelect() {
    renderManualMemberList('');
}

function renderManualMemberList(query) {
    const container = document.getElementById('listAnggotaAbsen');
    if (!container) return;
    const q = query.toLowerCase().trim();
    const filtered = q
        ? members.filter(m =>
            (m["NAMA LENGKAP"] || '').toLowerCase().includes(q) ||
            (m["ID (BARCODE)"] || '').toLowerCase().includes(q))
        : members;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:16px; text-align:center; opacity:0.5; font-size:0.85rem;">Anggota tidak ditemukan</div>`;
        return;
    }

    const selectedId = document.getElementById('selectAnggotaAbsen').value;
    container.innerHTML = '';
    filtered.forEach(m => {
        const id = m["ID (BARCODE)"];
        const nama = m["NAMA LENGKAP"] || '-';
        const gol = m["GOL. KEANGGOTAAN"] || '-';
        const foto = m["URL FOTO"] || 'https://via.placeholder.com/40';
        const isSelected = id === selectedId;

        const item = document.createElement('div');
        item.className = 'manual-member-item';
        item.dataset.id = id;
        item.style.cssText = `
            display:flex; align-items:center; gap:10px; padding:10px 14px;
            cursor:pointer; border-bottom:1px solid var(--glass-border);
            transition:background 0.2s;
            background: ${isSelected ? 'rgba(59,130,246,0.2)' : 'transparent'};
        `;
        item.innerHTML = `
            <img src="${foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:${isSelected?'700':'500'}; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${highlightText(nama, q)}</div>
                <div style="font-size:0.72rem; opacity:0.6;">${highlightText(id, q)} &bull; ${gol}</div>
            </div>
            ${isSelected ? '<i class="fas fa-check-circle" style="color:var(--primary-color);"></i>' : ''}
        `;
        item.addEventListener('click', () => selectManualMember(m));
        item.addEventListener('mouseenter', () => { if (id !== selectedId) item.style.background = 'rgba(255,255,255,0.05)'; });
        item.addEventListener('mouseleave', () => { if (id !== selectedId) item.style.background = 'transparent'; });
        container.appendChild(item);
    });
}

function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).replace(regex, '<mark style="background:rgba(59,130,246,0.4);color:inherit;border-radius:2px;padding:0 2px;">$1</mark>');
}

function selectManualMember(m) {
    document.getElementById('selectAnggotaAbsen').value = m["ID (BARCODE)"];
    document.getElementById('previewFoto').src = m["URL FOTO"] || 'https://via.placeholder.com/44';
    document.getElementById('previewNama').innerText = m["NAMA LENGKAP"] || '-';
    document.getElementById('previewInfo').innerText = `${m["ID (BARCODE)"]} · ${m["GOL. KEANGGOTAAN"] || '-'}`;
    document.getElementById('selectedMemberPreview').style.display = 'block';
    document.getElementById('btnSubmitManual').disabled = false;
    // Re-render list to show checkmark
    renderManualMemberList(document.getElementById('searchAnggotaAbsen').value);
}

function clearManualMember() {
    document.getElementById('selectAnggotaAbsen').value = '';
    document.getElementById('selectedMemberPreview').style.display = 'none';
    document.getElementById('btnSubmitManual').disabled = true;
    renderManualMemberList(document.getElementById('searchAnggotaAbsen').value);
}

function renderReportTable() {
    const tbody = document.querySelector('#tableReport tbody');
    tbody.innerHTML = '';
    
    const filter = document.getElementById('filterReportType').value;
    const dateFrom = document.getElementById('filterDateFrom').value; // yyyy-mm-dd
    const dateTo = document.getElementById('filterDateTo').value;     // yyyy-mm-dd
    const today = new Date();
    const tDay = today.getDate();
    const tMonth = today.getMonth();
    const tYear = today.getFullYear();
    
    // Filter the attendance data
    let filteredData = attendance.filter(rec => {
        let recDateStr = String(rec["TANGGAL"]).substring(0, 10); // format yyyy-mm-dd

        // Jika ada filter tanggal custom, prioritaskan
        if (dateFrom || dateTo) {
            if (dateFrom && recDateStr < dateFrom) return false;
            if (dateTo && recDateStr > dateTo) return false;
            return true;
        }

        if (filter === 'all') return true;

        let rDateParts = recDateStr.split('-');
        if (rDateParts.length !== 3) return true;

        let rYear = parseInt(rDateParts[0]);
        let rMonth = parseInt(rDateParts[1]) - 1;
        let rDay = parseInt(rDateParts[2]);
        let dDate = new Date(rYear, rMonth, rDay);

        if (filter === 'daily') {
            return (rDay === tDay && rMonth === tMonth && rYear === tYear);
        } else if (filter === 'monthly') {
            return (rMonth === tMonth && rYear === tYear);
        } else if (filter === 'weekly') {
            let diffT = today.getTime() - dDate.getTime();
            let diffDays = diffT / (1000 * 3600 * 24);
            return diffDays >= 0 && diffDays <= 7;
        }
        return true;
    });

    if(filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada data</td></tr>';
        return;
    }

    filteredData.forEach(rec => {
        let timeStr = rec["WAKTU"];
        // Data dari GS sudah HH:mm, fallback jika masih ISO string
        if (timeStr && String(timeStr).length > 5) {
            try {
                const t = new Date(timeStr);
                if (!isNaN(t.getTime())) {
                    timeStr = String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0');
                } else {
                    timeStr = String(timeStr).substring(11, 16);
                }
            } catch(e) {
                timeStr = String(timeStr).substring(11, 16);
            }
        }
        
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${String(rec["TANGGAL"]).substring(0,10)}</td>
            <td>${timeStr}</td>
            <td>${rec["ID (BARCODE)"]}</td>
            <td>${rec["NAMA LENGKAP"]}</td>
            <td>${rec["GOL. KEANGGOTAAN"]}</td>
            <td><span class="badge" style="background: ${rec["STATUS"] === 'Hadir' ? 'var(--success-color)' : 'var(--danger-color)'}; padding: 3px 8px; border-radius: 4px; color: #fff;">${rec["STATUS"]}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterMembers(data) {
    const q = document.getElementById('searchMember').value.toLowerCase();
    if(!q) return data;
    return data.filter(m => 
        (m["NAMA LENGKAP"] && m["NAMA LENGKAP"].toLowerCase().includes(q)) || 
        (m["ID (BARCODE)"] && String(m["ID (BARCODE)"]).toLowerCase().includes(q))
    );
}

function renderMembersTable() {
    const tbody = document.querySelector('#tableMembers tbody');
    tbody.innerHTML = '';
    
    let filtered = filterMembers(members);
    
    const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    document.getElementById('pageInfo').innerText = `Hal ${currentPage} / ${totalPages}`;
    document.getElementById('btnPrevPage').disabled = currentPage === 1;
    document.getElementById('btnFirstPage').disabled = currentPage === 1;
    document.getElementById('btnNextPage').disabled = currentPage === totalPages;
    document.getElementById('btnLastPage').disabled = currentPage === totalPages;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = Math.min(startIdx + rowsPerPage, filtered.length);
    const paginated = filtered.slice(startIdx, endIdx);

    if(paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada data</td></tr>';
        return;
    }

    paginated.forEach((m, idx) => {
        let imgUrl = m["URL FOTO"] || 'https://via.placeholder.com/50';
        let nama = m["NAMA LENGKAP"] || m["NAMA"] || '(Nama tidak tersedia)';
        let idBarcode = m["ID (BARCODE)"] || '-';
        let golongan = m["GOL. KEANGGOTAAN"] || '-';
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${startIdx + idx + 1}</td>
            <td><img src="${imgUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
            <td>${idBarcode}</td>
            <td>${nama}</td>
            <td>${golongan}</td>
            <td>
                <button class="btn-icon text-primary" onclick="editMemberModal('${idBarcode}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon text-danger" onclick="removeMember('${idBarcode}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editMemberModal = function(id) {
    const m = members.find(x => x["ID (BARCODE)"] === id);
    if(!m) return;
    
    document.getElementById('memRowIndex').value = m._rowIndex;
    document.getElementById('memId').value = m["ID (BARCODE)"] || '';
    document.getElementById('memId').readOnly = true; // Prevent changing ID since it's used as key
    document.getElementById('memNama').value = m["NAMA LENGKAP"] || '';
    document.getElementById('memFoto').value = m["URL FOTO"] || '';
    document.getElementById('memSekolah').value = m["NAMA SEKOLAH"] || '';
    document.getElementById('memKelas').value = m["KELAS"] || '';
    document.getElementById('memLahir').value = m["TEMPAT LAHIR"] || '';
    document.getElementById('memGol').value = m["GOL. KEANGGOTAAN"] || 'Siaga';
    document.getElementById('memKursus').value = m["KURSUS"] || '';
    document.getElementById('memDarah').value = m["GOL. DARAH"] || '';
    document.getElementById('memHp').value = m["NO HP"] || '';
    document.getElementById('memAlamat').value = m["ALAMAT"] || '';
    document.getElementById('memEmail').value = m["ALAMAT EMAIL"] || '';

    document.getElementById('memberModalTitle').innerText = 'Edit Anggota';
    document.getElementById('memberModal').style.display = 'flex';
};

// =======================
// UTILS & MISC
// =======================

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
};

function initScanner() {
    if(scanReader) {
        scanReader.clear();
        scanReader = null;
    }
    
    scanReader = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    scanReader.start({ facingMode: "environment" }, config, (decodedText) => {
        scanReader.pause(true); // pause scanning momentarily
        processScan(decodedText);
    }, (error) => {
        // ignore errors (mostly framing errors)
    }).catch(err => {
        console.warn("Camera init failed:", err);
        document.getElementById('reader').innerHTML = '<p style="padding:20px;">Kamera tidak dapat diakses. Silakan gunakan input manual.</p>';
    });
}

function processScan(barcodeStr) {
    document.getElementById('manualBarcode').value = '';
    submitAttendance(barcodeStr, 'Hadir');
}

function showResultModal(member, msg) {
    document.getElementById('resFoto').src = member["URL FOTO"] || 'https://via.placeholder.com/150';
    document.getElementById('resNama').innerText = member["NAMA LENGKAP"];
    document.getElementById('resGolongan').innerText = member["GOL. KEANGGOTAAN"];
    
    let isSuccess = msg.includes('Berhasil');
    document.getElementById('resStatus').innerHTML = `
        <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-info-circle'}" style="font-size: 2rem; display:block; margin-bottom: 10px; color:${isSuccess?'var(--success-color)':'#3b82f6'};"></i>
        <span style="color:${isSuccess?'var(--success-color)':'#3b82f6'};">${msg}</span>
    `;
    
    document.getElementById('resultModal').style.display = 'flex';
    
    // If scanner open, resume it when closing modal
    const origClose = window.closeModal;
    window.closeModal = function(id) {
        origClose(id);
        if(id === 'resultModal' && scanReader && scanReader.getState() === Html5QrcodeScannerState.PAUSED) {
            scanReader.resume();
        }
    };
}

function generatePrintView() {
    renderReportTable(); // ensure report view is generated based on filter
    
    // Copy data from report table to print table
    const srcTbody = document.querySelector('#tableReport tbody');
    const destTbody = document.getElementById('printTableBody');
    destTbody.innerHTML = '';
    
    const rows = srcTbody.querySelectorAll('tr');
    rows.forEach((row, i) => {
        if(row.cells.length === 1) { // Error / no data row
            let tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="7" class="text-center">Tidak ada data</td>`;
            destTbody.appendChild(tr);
            return;
        }

        let tr = document.createElement('tr');
        tr.innerHTML = `<td class="text-center">${i+1}</td>`;
        for(let j=0; j<row.cells.length; j++){
            if(j === 5) { // modify status styling to text for print
                tr.innerHTML += `<td class="text-center">${row.cells[j].innerText}</td>`;
            } else {
                tr.innerHTML += `<td>${row.cells[j].innerText}</td>`;
            }
        }
        destTbody.appendChild(tr);
    });

    // Set Header
    const filterSel = document.getElementById('filterReportType');
    const filterVal = filterSel.value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const now = new Date();

    function formatTgl(d) {
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    let periodeText;

    // Jika filter custom tanggal aktif, gunakan tanggal yang dipilih user
    if (dateFrom || dateTo) {
        const tglAwal = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
        const tglAkhir = dateTo   ? new Date(dateTo   + 'T00:00:00') : null;
        if (tglAwal && tglAkhir) {
            if (tglAwal.toDateString() === tglAkhir.toDateString()) {
                periodeText = formatTgl(tglAwal);
            } else {
                periodeText = `${formatTgl(tglAwal)} s/d ${formatTgl(tglAkhir)}`;
            }
        } else if (tglAwal) {
            periodeText = `Dari ${formatTgl(tglAwal)}`;
        } else {
            periodeText = `Sampai ${formatTgl(tglAkhir)}`;
        }
    } else {
        // Gunakan rentang dari data yang tampil di tabel
        const tabelRows = document.querySelectorAll('#tableReport tbody tr');
        let tanggalList = [];
        tabelRows.forEach(row => {
            if (row.cells.length > 1) {
                const tgl = row.cells[0].innerText.trim();
                if (tgl) tanggalList.push(new Date(tgl));
            }
        });
        tanggalList = tanggalList.filter(d => !isNaN(d)).sort((a, b) => a - b);

        if (tanggalList.length > 0) {
            const awal = tanggalList[0];
            const akhir = tanggalList[tanggalList.length - 1];
            if (filterVal === 'monthly') {
                periodeText = `Bulanan - ${months[awal.getMonth()]} ${awal.getFullYear()}`;
            } else if (filterVal === 'daily') {
                periodeText = `Harian - ${formatTgl(awal)}`;
            } else if (awal.toDateString() === akhir.toDateString()) {
                periodeText = `${filterSel.options[filterSel.selectedIndex].text} - ${formatTgl(awal)}`;
            } else {
                periodeText = `${filterSel.options[filterSel.selectedIndex].text} - ${formatTgl(awal)} s/d ${formatTgl(akhir)}`;
            }
        } else if (filterVal === 'monthly') {
            periodeText = `Bulanan - ${months[now.getMonth()]} ${now.getFullYear()}`;
        } else if (filterVal === 'daily') {
            periodeText = `Harian - ${formatTgl(now)}`;
        } else {
            periodeText = filterSel.options[filterSel.selectedIndex].text;
        }
    }

    document.getElementById('printDateRange').innerText = 'Periode: ' + periodeText;
    
    // Set Footer Settings
    document.getElementById('printCity').innerText = currentSettings.KOTA_TANDA_TANGAN || 'Jakarta';

    // Set logo print
    const printLogo = document.getElementById('printLogo');
    if (currentSettings.IMAGE_URL) {
        printLogo.src = currentSettings.IMAGE_URL;
        printLogo.style.display = 'block';
    } else {
        printLogo.style.display = 'none';
    }
    
    let tglTanda = currentSettings.TANGGAL_TANDA_TANGAN;
    if(tglTanda && tglTanda.toLowerCase().includes('otomatis')) {
        tglTanda = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    document.getElementById('printCurrentDate').innerText = tglTanda || 'Tanggal';
    document.getElementById('printLeader').innerText = currentSettings.NAMA_PIMPINAN || 'Kak Pimpinan';
}
