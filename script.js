const API_URL = "https://script.google.com/macros/s/AKfycbyz-B3bW7G5OgqCHJWXmIvDnxzks_Itp7yErwZ8t77DhiQdsFzklhxz9V6hS_s_ijoO3A/exec";

// เปิดใช้งาน Plugin ตัวเลขในกราฟของ Chart.js
Chart.register(ChartDataLabels);

let crChartInstance = null;
let typeChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();
    document.getElementById('record_date').value = today.toLocaleDateString('en-CA');
    
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    let yyyy = String(today.getFullYear());
    if(document.getElementById('dash_month').querySelector(`option[value="${mm}"]`)) document.getElementById('dash_month').value = mm;
    if(document.getElementById('dash_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('dash_year').value = yyyy;

    const savedCR = localStorage.getItem('cr_hub_name');
    if (savedCR) document.getElementById('cr_name').value = savedCR;
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

// 🔒 เข้าสู่โหมด Admin เพื่ออัปโหลด CSV
function openAdminTab() {
    const pin = prompt("🔒 กรุณาใส่รหัสผ่าน Admin เพื่อเข้าสู่ระบบจัดการ (รหัสเริ่มต้น: 1234):");
    if (pin === "1234") {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-admin').classList.add('active');
        document.getElementById('admin-tab-btn').classList.add('active');
    } else if (pin !== null) {
        alert("❌ รหัสผ่านไม่ถูกต้องครับ!");
    }
}

// ---------------------------------------------------
// 🚀 เฟส 4: ฟังก์ชันอ่านไฟล์ CSV ตรีเพชรด้วย PapaParse
// ---------------------------------------------------
function uploadCSV() {
    const fileInput = document.getElementById('csv_file');
    const file = fileInput.files[0];
    if (!file) return alert("⚠️ กรุณาเลือกไฟล์ .csv ก่อนครับ");

    const btn = document.getElementById('upload-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังแกะข้อมูล...';
    btn.disabled = true;

    // สั่งอ่านไฟล์ CSV
    Papa.parse(file, {
        header: true, // ให้อ่านบรรทัดแรกเป็นหัวข้อคอลัมน์เลย
        skipEmptyLines: true,
        complete: function(results) {
            const data = results.data;
            const payload = { action: "upload_csv", csvData: data };

            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            })
            .then(r => r.json())
            .then(res => {
                btn.innerHTML = '<i class="fas fa-rocket"></i> อัปโหลดฐานข้อมูล';
                btn.disabled = false;
                if(res.result === 'success') {
                    alert("✅ อัปโหลดข้อมูลการโทรจากตรีเพชรเรียบร้อยแล้วครับ พนักงานเห็นอัปเดตทันที!");
                    fileInput.value = "";
                } else {
                    alert("❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + res.message);
                }
            })
            .catch(e => {
                btn.innerHTML = '<i class="fas fa-rocket"></i> อัปโหลดฐานข้อมูล';
                btn.disabled = false;
                alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาตรวจสอบอินเทอร์เน็ตครับ");
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
    const tripetch = parseInt(document.getElementById('type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('type_referral').value) || 0;
    const total = parseInt(document.getElementById('type_total').value) || 0;

    if (!recordDate) return alert("⚠️ กรุณาเลือกวันที่ก่อนบันทึกผลงานครับ");
    if (total === 0) if(!confirm("วันนี้ยังไม่มียอดรถเข้าเลย (รวม 0 คัน) ยืนยันที่จะบันทึกใช่หรือไม่?")) return;

    localStorage.setItem('cr_hub_name', crName);
    const payload = { action: "save_record", date: recordDate, cr_name: crName, tripetch: tripetch, inbound: inbound, referral: referral, total: total };

    const btn = document.getElementById('save-btn');
    const overlay = document.getElementById('loading-overlay');
    btn.disabled = true; overlay.style.display = "flex";

    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(data => {
        overlay.style.display = "none"; btn.disabled = false;
        if(data.result === 'success') {
            alert("✅ บันทึกผลงานเรียบร้อยแล้วครับ!");
            document.getElementById('type_tripetch').value = 0; document.getElementById('type_inbound').value = 0; document.getElementById('type_referral').value = 0; calculateTotal();
        } else alert("❌ เกิดข้อผิดพลาด: " + data.message);
    }).catch(e => {
        overlay.style.display = "none"; btn.disabled = false;
        alert("✅ ส่งข้อมูลสำเร็จ! (ถ้ายอดไม่ขึ้นในชีต ให้ลองตรวจสอบอินเทอร์เน็ตอีกครั้ง)");
        document.getElementById('type_tripetch').value = 0; document.getElementById('type_inbound').value = 0; document.getElementById('type_referral').value = 0; calculateTotal();
    });
}

function loadPromotions() {
    const container = document.getElementById('promo-container');
    container.innerHTML = '<div class="spinner-small"></div>';
    fetch(API_URL + "?action=get_promos").then(r => r.json()).then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            let html = ''; const today = new Date(); today.setHours(0,0,0,0);
            data.data.forEach(item => {
                let isValid = true;
                if (item.startDate) { let sDate = new Date(item.startDate); sDate.setHours(0,0,0,0); if (today < sDate) isValid = false; }
                if (item.endDate) { let eDate = new Date(item.endDate); eDate.setHours(0,0,0,0); if (today > eDate) isValid = false; }
                if(isValid) {
                    let expireText = item.endDate ? `<p style="font-size:11px; color:#d32f2f; margin-bottom:10px;"><i class="fas fa-clock"></i> หมดเขต: ${item.endDate}</p>` : '';
                    html += `<div class="promo-card"><span style="font-size:11px; background:#e8eaf6; padding:3px 8px; border-radius:12px; color:#3f51b5; font-weight:bold;">${item.category}</span><h4 style="margin-top: 10px;">${item.title}</h4><p>${item.desc}</p>${expireText}<a href="${item.link}" target="_blank" class="btn-view"><i class="fas fa-external-link-alt"></i> เปิดดูไฟล์</a></div>`;
                }
            });
            container.innerHTML = html === '' ? '<p style="text-align:center; color:#777; width:100%;">ไม่มีโปรโมชั่นในช่วงเวลานี้ครับ</p>' : html;
        } else container.innerHTML = '<p style="text-align:center; color:#777; width:100%;">ยังไม่มีโปรโมชั่นในระบบครับ</p>';
    }).catch(e => container.innerHTML = '<p style="color:red; text-align:center; width:100%;">โหลดข้อมูลไม่สำเร็จ</p>');
}

function loadReports() {
    const container = document.getElementById('reports-container');
    container.innerHTML = '<div class="spinner-small"></div>';
    fetch(API_URL + "?action=get_reports").then(r => r.json()).then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            let html = ''; const reversedData = data.data.reverse(); 
            reversedData.forEach(item => {
                const typeClass = item.type === 'รายเดือน' ? 'monthly' : '';
                const icon = item.type === 'รายเดือน' ? 'fa-calendar-alt' : 'fa-calendar-week';
                html += `<div class="report-item ${typeClass}"><div class="report-info"><h4><i class="fas ${icon}" style="color: #777;"></i> ${item.filename}</h4><p>รอบ: <b>${item.period}</b> | ชนิด: ${item.type}</p></div><a href="${item.link}" target="_blank" class="btn-view" style="width:auto; padding: 10px 15px;"><i class="fas fa-file-pdf"></i> เปิดดู</a></div>`;
            });
            container.innerHTML = html;
        } else container.innerHTML = `<p style="text-align:center; color:#777; width:100%;">ยังไม่มีรายงานในระบบครับ</p>`;
    }).catch(e => container.innerHTML = '<p style="color:red; text-align:center; width:100%;">โหลดข้อมูลไม่สำเร็จ</p>');
}

function loadDashboard() {
    const month = document.getElementById('dash_month').value;
    const year = document.getElementById('dash_year').value;
    
    document.getElementById('dash_loading').style.display = 'block';
    document.getElementById('dash_charts').style.display = 'none';

    fetch(`${API_URL}?action=get_dashboard&month=${month}&year=${year}`)
    .then(r => r.json())
    .then(res => {
        document.getElementById('dash_loading').style.display = 'none';
        document.getElementById('dash_charts').style.display = 'block';

        if (res.result === 'success') {
            const d = res.data;
            
            // 1. Progress Bar
            document.getElementById('dash_target').innerText = d.target;
            document.getElementById('dash_current').innerText = d.current;
            let percent = d.target > 0 ? Math.round((d.current / d.target) * 100) : 0;
            let barWidth = percent > 100 ? 100 : percent; 
            const progressBar = document.getElementById('dash_progress');
            progressBar.style.width = barWidth + '%';
            progressBar.innerText = percent + '%';
            
            if(percent >= 100) progressBar.style.background = "linear-gradient(90deg, #1b5e20, #4caf50)";
            else if(percent >= 80) progressBar.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
            else if(percent >= 50) progressBar.style.background = "linear-gradient(90deg, #ff9800, #ffb74d)";
            else progressBar.style.background = "linear-gradient(90deg, #f44336, #e57373)";

            // 2. กราฟแท่ง (ใส่ตัวเลขไว้ในกราฟ)
            const ctxCr = document.getElementById('crChart').getContext('2d');
            if (crChartInstance) crChartInstance.destroy();
            crChartInstance = new Chart(ctxCr, {
                type: 'bar',
                data: {
                    labels: ['กรรณิกา', 'เรืองศิริ'],
                    datasets: [{
                        data: [d.kannika, d.ruangsiri],
                        backgroundColor: ['#2196f3', '#e91e63'],
                        borderRadius: 6
                    }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: false },
                        datalabels: { // ฝังตัวเลขลงในกราฟแท่ง
                            color: '#fff',
                            font: { weight: 'bold', size: 14 },
                            anchor: 'end',
                            align: 'bottom',
                            formatter: (value) => value > 0 ? value : ''
                        }
                    }, 
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } 
                }
            });

            // 3. กราฟโดนัท (ใส่ตัวเลขไว้ในกราฟ)
            const ctxType = document.getElementById('typeChart').getContext('2d');
            if (typeChartInstance) typeChartInstance.destroy();
            typeChartInstance = new Chart(ctxType, {
                type: 'doughnut',
                data: {
                    labels: ['ระบบตรีเพชร', 'โทรมาเอง', 'คนอื่นนัด/Walk-in'],
                    datasets: [{
                        data: [d.breakdown.tripetch, d.breakdown.inbound, d.breakdown.referral],
                        backgroundColor: ['#4caf50', '#ff9800', '#9c27b0'],
                        borderWidth: 2
                    }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, cutout: '55%', 
                    plugins: { 
                        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                        datalabels: { // ฝังตัวเลขลงในกราฟโดนัท
                            color: '#fff',
                            font: { weight: 'bold', size: 16 },
                            formatter: (value) => value > 0 ? value : ''
                        }
                    } 
                }
            });

            // 4. เรนเดอร์หลอดข้อมูลสถานะการโทรจากไฟล์ CSV ของตรีเพชร
            if (d.csvData && d.csvData.length > 0) {
                let csvHtml = '<h4 style="color:#555; text-align:left; margin-top:30px; border-bottom:2px solid #eee; padding-bottom:10px;"><i class="fas fa-headset" style="color:#ff9800;"></i> สถานะการโทรตามลูกค้า (ข้อมูลจากตรีเพชร)</h4>';
                
                d.csvData.forEach(item => {
                    const totalToCall = item.tracked + item.untracked;
                    let pct = totalToCall > 0 ? Math.round((item.tracked / totalToCall) * 100) : 0;
                    
                    csvHtml += `
                    <div style="margin-top: 15px; font-size: 13px; background: #fafafa; padding: 12px; border-radius: 8px; border: 1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <strong style="color:#333;">${item.group}</strong>
                            <span style="color:#2e7d32; font-weight:bold; font-size: 14px;">${pct}%</span>
                        </div>
                        <div style="width:100%; background:#e0e0e0; height:10px; border-radius:5px; overflow:hidden;">
                            <div style="width:${pct}%; background:linear-gradient(90deg, #2196f3, #00bcd4); height:100%; transition: width 1s;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:12px; color:#666;">
                            <span>เป้าหมายกลุ่ม: <b>${item.target}</b></span>
                            <span>โทรแล้ว: <b style="color:#1565c0;">${item.tracked}</b> | ค้างโทร: <b style="color:#d32f2f;">${item.untracked}</b></span>
                        </div>
                    </div>
                    `;
                });
                document.getElementById('dash_csv_tracking').innerHTML = csvHtml;
            } else {
                document.getElementById('dash_csv_tracking').innerHTML = '<p style="text-align:center; color:#777; margin-top:20px; font-size: 13px;">⚠️ ผู้ดูแลระบบยังไม่ได้อัปโหลดข้อมูลการโทรของวันนี้ครับ</p>';
            }

        }
    })
    .catch(e => {
        document.getElementById('dash_loading').innerText = "โหลดข้อมูลล้มเหลว กรุณาลองใหม่";
    });
}
