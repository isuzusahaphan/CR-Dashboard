const API_URL = "https://script.google.com/macros/s/AKfycbyz-B3bW7G5OgqCHJWXmIvDnxzks_Itp7yErwZ8t77DhiQdsFzklhxz9V6hS_s_ijoO3A/exec";

Chart.register(ChartDataLabels);
let crChartInstance = null;
let typeChartInstance = null;
let kannikaChartInstance = null;
let ruangsiriChartInstance = null;
let currentDashboardData = null; 

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();
    document.getElementById('record_date').value = today.toLocaleDateString('en-CA');
    
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    let yyyy = String(today.getFullYear());
    if(document.getElementById('dash_month').querySelector(`option[value="${mm}"]`)) document.getElementById('dash_month').value = mm;
    if(document.getElementById('dash_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('dash_year').value = yyyy;
    if(document.getElementById('admin_month').querySelector(`option[value="${mm}"]`)) document.getElementById('admin_month').value = mm;
    if(document.getElementById('admin_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('admin_year').value = yyyy;

    const savedCR = localStorage.getItem('cr_hub_name');
    if (savedCR) document.getElementById('cr_name').value = savedCR;

    loadDashboard();
});

function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');

    if (tabId === 'tab-promo') loadPromotions();
    if (tabId === 'tab-reports') loadReports();
    if (tabId === 'tab-dashboard') loadDashboard();
}

function openAdminTab() {
    const pin = prompt("🔒 กรุณาใส่รหัสผ่าน Administrator (รหัสเริ่มต้น: 1234):");
    if (pin === "1234") {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-admin').classList.add('active');
    } else if (pin !== null && pin !== "") alert("❌ รหัสผ่านไม่ถูกต้อง การเข้าถึงถูกปฏิเสธ");
}

function uploadCSV() {
    const fileInput = document.getElementById('csv_file');
    const file = fileInput.files[0];
    const adminMonth = document.getElementById('admin_month').value;
    const adminYear = document.getElementById('admin_year').value;

    if (!file) return alert("⚠️ กรุณาแนบไฟล์นามสกุล .csv ก่อนทำรายการ");

    const btn = document.getElementById('upload-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังประมวลผลข้อมูล...';
    btn.disabled = true;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: function(header) { return header.trim().replace(/^\uFEFF/, ''); },
        complete: function(results) {
            const payload = { action: "upload_csv", month: adminMonth, year: adminYear, csvData: results.data };
            fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
            .then(r => r.json())
            .then(res => {
                btn.innerHTML = '<i class="fas fa-database"></i> ปรับปรุงฐานข้อมูล'; btn.disabled = false;
                if(res.result === 'success') { 
                    alert("✅ ปรับปรุงฐานข้อมูลสำเร็จ! ข้อมูลถูกบันทึกในเดือนที่ระบุเรียบร้อยแล้ว"); 
                    fileInput.value = ""; 
                    document.getElementById('dash_month').value = adminMonth;
                    document.getElementById('dash_year').value = adminYear;
                    switchTab({currentTarget: document.querySelector('.tab-btn')}, 'tab-dashboard');
                } 
                else alert("❌ ข้อผิดพลาดเซิร์ฟเวอร์: " + res.message);
            }).catch(e => {
                btn.innerHTML = '<i class="fas fa-database"></i> ปรับปรุงฐานข้อมูล'; btn.disabled = false;
                alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย");
            });
        }
    });
}

function calculateTotal() {
    const tripetch = parseInt(document.getElementById('type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('type_referral').value) || 0;
    document.getElementById('type_total').value = tripetch + inbound + referral;
}

function saveRecord() {
    const crName = document.getElementById('cr_name').value;
    const recordDate = document.getElementById('record_date').value;
    if (!recordDate) return alert("⚠️ กรุณาระบุวันที่ก่อนทำรายการ");
    
    const tot = parseInt(document.getElementById('type_total').value) || 0;
    if (tot === 0 && !confirm("ยอดรวมรถเข้ารับบริการเป็น 0 คัน ยืนยันที่จะส่งข้อมูลเข้าสู่ระบบหรือไม่?")) return;

    localStorage.setItem('cr_hub_name', crName);
    const payload = { action: "save_record", date: recordDate, cr_name: crName, 
        tripetch: parseInt(document.getElementById('type_tripetch').value) || 0, 
        inbound: parseInt(document.getElementById('type_inbound').value) || 0, 
        referral: parseInt(document.getElementById('type_referral').value) || 0, total: tot };

    const btn = document.getElementById('save-btn'); const overlay = document.getElementById('loading-overlay');
    btn.disabled = true; overlay.style.display = "flex";

    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(r => r.json()).then(data => {
        overlay.style.display = "none"; btn.disabled = false;
        if(data.result === 'success') { alert("✅ บันทึกข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว"); document.getElementById('type_tripetch').value = 0; document.getElementById('type_inbound').value = 0; document.getElementById('type_referral').value = 0; calculateTotal(); }
    }).catch(e => { overlay.style.display = "none"; btn.disabled = false; alert("✅ ส่งข้อมูลสำเร็จ!"); });
}

function loadPromotions() {
    const container = document.getElementById('promo-container'); container.innerHTML = '<div class="spinner-small"></div>';
    fetch(API_URL + "?action=get_promos").then(r => r.json()).then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            let html = ''; const today = new Date(); today.setHours(0,0,0,0);
            data.data.forEach(item => {
                let isValid = true;
                if (item.startDate) { let sDate = new Date(item.startDate); sDate.setHours(0,0,0,0); if (today < sDate) isValid = false; }
                if (item.endDate) { let eDate = new Date(item.endDate); eDate.setHours(0,0,0,0); if (today > eDate) isValid = false; }
                if(isValid) {
                    let expireText = item.endDate ? `<p style="font-size:13px; color:#d32f2f; margin-bottom:15px;"><i class="fas fa-clock"></i> สิ้นสุดแคมเปญ: ${item.endDate}</p>` : '';
                    html += `<div class="promo-card"><span style="font-size:12px; background:#e3f2fd; padding:4px 10px; border-radius:15px; color:#1565c0; font-weight:bold;">${item.category}</span><h4 style="margin-top: 15px;">${item.title}</h4><p>${item.desc}</p>${expireText}<a href="${item.link}" target="_blank" class="btn-view"><i class="fas fa-external-link-alt"></i> เปิดดูเอกสาร</a></div>`;
                }
            });
            container.innerHTML = html === '' ? '<p style="text-align:center; width:100%;">ไม่มีแคมเปญในระยะเวลานี้</p>' : html;
        } else container.innerHTML = '<p style="text-align:center; width:100%;">ไม่พบข้อมูลในระบบ</p>';
    });
}

function loadReports() {
    const container = document.getElementById('reports-container'); container.innerHTML = '<div class="spinner-small"></div>';
    fetch(API_URL + "?action=get_reports").then(r => r.json()).then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            let html = ''; data.data.reverse().forEach(item => {
                const typeClass = item.type === 'รายเดือน' ? 'monthly' : '';
                const icon = item.type === 'รายเดือน' ? 'fa-calendar-alt' : 'fa-calendar-week';
                html += `<div class="report-item ${typeClass}"><div class="report-info"><h4><i class="fas ${icon}"></i> ${item.filename}</h4><p>รอบการประเมิน: <b>${item.period}</b> | ชนิดรายงาน: ${item.type}</p></div><a href="${item.link}" target="_blank" class="btn-view" style="width:auto;"><i class="fas fa-file-pdf"></i> เปิดดูเอกสาร</a></div>`;
            });
            container.innerHTML = html;
        } else container.innerHTML = `<p style="text-align:center; width:100%;">ไม่พบเอกสารรายงาน</p>`;
    });
}

// ✨ ฟังก์ชันคำนวณ 2 บรรทัด (จำนวน + เปอร์เซ็นต์) สำหรับกราฟโดนัท
const donutFormatter = (value, ctx) => {
    if(value === 0) return '';
    let sum = 0;
    ctx.chart.data.datasets[0].data.forEach(data => { sum += data; });
    let percentage = (value * 100 / sum).toFixed(1) + "%";
    return [value + " คัน", "(" + percentage + ")"]; // คืนค่าเป็น Array เพื่อให้ขึ้นบรรทัดใหม่
};

function loadDashboard() {
    const month = document.getElementById('dash_month').value; const year = document.getElementById('dash_year').value;
    document.getElementById('dash_loading').style.display = 'block'; document.getElementById('dash_charts').style.display = 'none';

    fetch(`${API_URL}?action=get_dashboard&month=${month}&year=${year}`)
    .then(r => r.json()).then(res => {
        document.getElementById('dash_loading').style.display = 'none'; document.getElementById('dash_charts').style.display = 'block';

        if (res.result === 'success') {
            const d = res.data;
            currentDashboardData = d; 

            document.getElementById('dash_target').innerText = d.target;
            document.getElementById('dash_current').innerText = d.current;
            let percent = d.target > 0 ? Math.round((d.current / d.target) * 100) : 0;
            const pb = document.getElementById('dash_progress');
            pb.style.width = (percent > 100 ? 100 : percent) + '%'; pb.innerText = percent + '%';
            
            // 🤖 ระบบ AI แจ้งข้อความให้กำลังใจตามผลงาน
            let motivationText = "";
            if(percent >= 100) {
                pb.style.background = "linear-gradient(90deg, #1b5e20, #388e3c)";
                motivationText = "🏆 ยอดเยี่ยมเหนือความคาดหมาย! ผลงานทะลุเป้าหมายประจำเดือนแล้ว ขอเสียงปรบมือให้ทีม CR ครับ 🎉";
            }
            else if(percent >= 80) {
                pb.style.background = "linear-gradient(90deg, #388e3c, #81c784)";
                motivationText = "🔥 โค้งสุดท้ายแล้ว! ผลงานทะลุ 80% ลุยอีกนิดเดียวเป้าหมายอยู่แค่เอื้อมครับ 🚀";
            }
            else if(percent >= 50) {
                pb.style.background = "linear-gradient(90deg, #1565c0, #4fc3f7)";
                motivationText = "💪 เดินทางมาเกินครึ่งทางแล้ว! รักษามาตรฐานการทำงานที่ยอดเยี่ยมนี้ต่อไปครับ ✨";
            }
            else {
                pb.style.background = "linear-gradient(90deg, #d32f2f, #e57373)";
                motivationText = "🌱 เริ่มต้นเป้าหมายใหม่ ค่อยๆ สะสมยอดไปทีละคัน เป็นกำลังใจให้ทีม CR ทุกคนครับ ✌️";
            }
            document.getElementById('dash_motivation').innerHTML = motivationText;

            if (crChartInstance) crChartInstance.destroy();
            crChartInstance = new Chart(document.getElementById('crChart'), {
                type: 'bar',
                data: { labels: ['กรรณิกา', 'เรืองศิริ'], datasets: [{ data: [d.kannika, d.ruangsiri], backgroundColor: ['#2e7d32', '#1565c0'], borderRadius: 6 }] },
                options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } }, plugins: { legend: { display: false }, datalabels: { color: '#0d47a1', font: { weight: 'bold', size: 16 }, anchor: 'end', align: 'top', offset: 4, formatter: v => v > 0 ? v : '' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });

            if (typeChartInstance) typeChartInstance.destroy();
            typeChartInstance = new Chart(document.getElementById('typeChart'), {
                type: 'doughnut',
                data: { labels: ['ระบบตรีเพชร', 'ติดต่อด้วยตนเอง', 'Walk-in/แนะนำ'], datasets: [{ data: [d.breakdown.tripetch, d.breakdown.inbound, d.breakdown.referral], backgroundColor: ['#2e7d32', '#1565c0', '#0288d1'], borderWidth: 2 }] },
                options: { 
                    responsive: true, maintainAspectRatio: false, cutout: '55%', 
                    plugins: { 
                        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 13 } } }, 
                        datalabels: { 
                            color: '#fff', font: { weight: 'bold', size: 13 }, textAlign: 'center', formatter: donutFormatter
                        } 
                    } 
                }
            });

            if (d.csvData && d.csvData.length > 0) {
                let csvHtml = '<div style="grid-column: 1 / -1;"><h3 style="color:#0d47a1; margin-top:20px; border-bottom:2px solid #bbdefb; padding-bottom:10px;"><i class="fas fa-headset" style="color:#1565c0;"></i> สรุปสถานะการติดตามลูกค้า (อัปเดตจากตรีเพชร)</h3></div>';
                d.csvData.forEach(item => {
                    const needToCall = item.tracked + item.untracked; 
                    let actualPercent = needToCall === 0 ? 100 : Math.round((item.tracked / needToCall) * 100);
                    csvHtml += `
                    <div class="csv-card">
                        <div class="csv-title">${item.group}</div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
                            <span style="color:#555;">ความคืบหน้าการโทร</span><span style="color:#1565c0; font-weight:bold;">${actualPercent}%</span>
                        </div>
                        <div style="width:100%; background:#e0e0e0; height:12px; border-radius:6px; overflow:hidden; margin-bottom:15px;">
                            <div style="width:${actualPercent}%; background:linear-gradient(90deg, #1976d2, #4fc3f7); height:100%; transition: width 1s;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; background:#f9f9f9; padding:8px; border-radius:6px; margin-bottom:5px;">
                            <span>🎯 เป้าหมายกลุ่ม:</span><b>${item.target} คัน</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; background:#f9f9f9; padding:8px; border-radius:6px; margin-bottom:5px;">
                            <span>✅ เข้าก่อนติดตาม:</span><b style="color:#2e7d32;">${item.preService} คัน</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; background:#f9f9f9; padding:8px; border-radius:6px;">
                            <span>📞 สถานะการโทร:</span><span>โทรแล้ว <b style="color:#1565c0;">${item.tracked}</b> | ค้าง <b style="color:#d32f2f;">${item.untracked}</b></span>
                        </div>
                    </div>`;
                });
                document.getElementById('dash_csv_tracking').innerHTML = csvHtml;
            } else {
                document.getElementById('dash_csv_tracking').innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:#777; padding: 40px; background: #fff; border: 1px dashed #ccc; border-radius: 10px;">⚠️ ผู้ดูแลระบบยังไม่ได้อัปโหลดฐานข้อมูลการติดตามลูกค้าในเดือนนี้</p>';
            }
        }
    }).catch(e => { document.getElementById('dash_loading').innerText = "โหลดข้อมูลล้มเหลว"; });
}

function openBreakdownModal() {
    if (!currentDashboardData) return alert("⚠️ ข้อมูลยังไม่พร้อม กรุณารอสักครู่");
    const d = currentDashboardData;
    
    document.getElementById('breakdown-modal').style.display = 'flex';

    // หน่วงเวลา 100ms ให้ Modal เปิดสุดก่อนวาดกราฟ (แก้ปัญหากราฟไม่แสดงผล)
    setTimeout(() => {
        if (kannikaChartInstance) kannikaChartInstance.destroy();
        kannikaChartInstance = new Chart(document.getElementById('kannikaChart'), {
            type: 'doughnut',
            data: { 
                labels: ['ระบบตรีเพชร', 'ติดต่อด้วยตนเอง', 'Walk-in/แนะนำ'], 
                datasets: [{ data: [d.kannikaBreakdown.tripetch, d.kannikaBreakdown.inbound, d.kannikaBreakdown.referral], backgroundColor: ['#2e7d32', '#1565c0', '#0288d1'], borderWidth: 2 }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '55%', 
                plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }, 
                    datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, textAlign: 'center', formatter: donutFormatter } 
                } 
            }
        });

        if (ruangsiriChartInstance) ruangsiriChartInstance.destroy();
        ruangsiriChartInstance = new Chart(document.getElementById('ruangsiriChart'), {
            type: 'doughnut',
            data: { 
                labels: ['ระบบตรีเพชร', 'ติดต่อด้วยตนเอง', 'Walk-in/แนะนำ'], 
                datasets: [{ data: [d.ruangsiriBreakdown.tripetch, d.ruangsiriBreakdown.inbound, d.ruangsiriBreakdown.referral], backgroundColor: ['#2e7d32', '#1565c0', '#0288d1'], borderWidth: 2 }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '55%', 
                plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }, 
                    datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, textAlign: 'center', formatter: donutFormatter } 
                } 
            }
        });
    }, 100);
}

function closeBreakdownModal() {
    document.getElementById('breakdown-modal').style.display = 'none';
}
