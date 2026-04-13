// ⚠️ สำคัญมาก: กรุณาแก้ไข API_URL ด้านล่างนี้ ให้เป็น URL ของคุณรณกฤตก่อนใช้งานจริงนะครับ
const API_URL = "https://script.google.com/macros/s/AKfycbyz-B3bW7G5OgqCHJWXmIvDnxzks_Itp7yErwZ8t77DhiQdsFzklhxz9V6hS_s_ijoO3A/exec"; 

Chart.register(ChartDataLabels);
let crChartInstance = null;
let typeChartInstance = null;
let kannikaChartInstance = null;
let ruangsiriChartInstance = null;
let currentDashboardData = null; 

let allReportsList = [];

// 🌟 ตัวแปรสำหรับระบบจัดการประวัติงาน 🌟
let recentRecordsList = []; // เก็บประวัติการบันทึกงานดิบทั้งหมดจาก API
let filteredRecordsList = []; // เก็บประวัติที่ผ่านการกรองแล้ว
let currentRecordPage = 1; // หน้าปัจจุบันของตารางประวัติ
const recordsPerPage = 10; // แสดงหน้าละ 10 รายการ

// ตัวแปรสำหรับระบบศูนย์ฝึกอบรม (Training Quiz)
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let score = 0;

// 🔥 ฟังก์ชันช่วยแสดง Loading หรูๆ
function showLoading(text) {
    Swal.fire({
        title: text,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => { Swal.showLoading(); }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();
    document.getElementById('record_date').value = today.toLocaleDateString('en-CA');
    
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    let yyyy = String(today.getFullYear());
    
    // เซ็ตค่า Default ให้หน้า Dashboard
    if(document.getElementById('dash_month').querySelector(`option[value="${mm}"]`)) document.getElementById('dash_month').value = mm;
    if(document.getElementById('dash_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('dash_year').value = yyyy;
    
    // เซ็ตค่า Default ให้หน้า Admin
    if(document.getElementById('admin_month').querySelector(`option[value="${mm}"]`)) document.getElementById('admin_month').value = mm;
    if(document.getElementById('admin_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('admin_year').value = yyyy;

    // 🌟 [เพิ่มใหม่] เซ็ตค่า Default ให้ตัวกรอง "ตารางประวัติงาน" 🌟
    if(document.getElementById('filter_record_month') && document.getElementById('filter_record_month').querySelector(`option[value="${mm}"]`)) {
        document.getElementById('filter_record_month').value = mm;
    }
    if(document.getElementById('filter_record_year') && document.getElementById('filter_record_year').querySelector(`option[value="${yyyy}"]`)) {
        document.getElementById('filter_record_year').value = yyyy;
    }

    const savedCR = localStorage.getItem('cr_hub_name');
    if (savedCR) {
        document.getElementById('cr_name').value = savedCR;
        document.getElementById('quiz_user_name').value = savedCR;
    }

    loadDashboard();
    loadRecentRecords(); 
});

// ==========================================
// 🌟 Navigation & Utilities
// ==========================================
function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');

    if (tabId === 'tab-promo') loadPromotions();
    if (tabId === 'tab-reports') loadReports();
    if (tabId === 'tab-dashboard') loadDashboard();
    if (tabId === 'tab-input') loadRecentRecords(); // โหลดประวัติงานอัปเดตใหม่เมื่อเข้าแท็บ
    if (tabId === 'tab-training') { loadQuizTopics(); loadScoreHistory(); }
}

// 🔥 อัปเกรดการถามรหัสผ่าน (Admin PIN)
async function openAdminTab() {
    const { value: pin } = await Swal.fire({
        title: '🔒 Administrator',
        input: 'password',
        inputLabel: 'กรุณาใส่รหัสผ่านผู้ดูแลระบบ',
        inputPlaceholder: 'รหัสเริ่มต้น: 1234',
        showCancelButton: true,
        confirmButtonColor: '#1565c0',
        cancelButtonColor: '#d33',
        confirmButtonText: 'เข้าสู่ระบบ',
        cancelButtonText: 'ยกเลิก'
    });

    if (pin === "1234") {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-admin').classList.add('active');
    } else if (pin) {
        Swal.fire({ icon: 'error', title: 'ปฏิเสธการเข้าถึง', text: 'รหัสผ่านไม่ถูกต้อง!', confirmButtonColor: '#1565c0' });
    }
}

// ==========================================
// 🌟 แท็บ 1: กระดานแสดงผล (Dashboard) - ระบบ 3 มิติ และ Extra Leads
// ==========================================
const donutFormatter = (value, ctx) => {
    if(value === 0) return '';
    let sum = 0;
    ctx.chart.data.datasets[0].data.forEach(data => { sum += data; });
    let percentage = (value * 100 / sum).toFixed(1) + "%";
    return [value + " คัน", "(" + percentage + ")"]; 
};

function createGradient(ctx, colorStart, colorEnd) {
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
}

let hasCelebratedCR100 = false; 

function loadDashboard() {
    const month = document.getElementById('dash_month').value; 
    const year = document.getElementById('dash_year').value;
    
    document.getElementById('dash_loading').style.display = 'block'; 
    document.getElementById('dash_charts').style.display = 'none';
    document.querySelector('.dashboard-summary-grid').style.display = 'none';

    fetch(`${API_URL}?action=get_dashboard&month=${month}&year=${year}`)
    .then(r => r.json())
    .then(res => {
        document.getElementById('dash_loading').style.display = 'none'; 
        document.getElementById('dash_charts').style.display = 'block';
        document.querySelector('.dashboard-summary-grid').style.display = 'grid';

        if (res.result === 'success') {
            const d = res.data;
            currentDashboardData = d; 

            // 🎯 การคำนวณ Dashboard 3 มิติ (Leading Indicator)
            const targetOutcome = 317; 
            const targetLeads = 1057;  
            
            let totalLeadsInHand = 0; 
            let totalTracked = 0;     

            // 1. รวมยอดจาก CSV ตรีเพชร (15 กลุ่ม)
            if (d.csvData && d.csvData.length > 0) {
                d.csvData.forEach(item => {
                    totalLeadsInHand += item.target; 
                    totalTracked += item.tracked;    
                });
            }

            // 2. รวมยอดจาก "รายชื่อเสริม" (Extra Leads สีเขียว) ที่เพิ่มเข้ามาใหม่
            if (d.extraLeads && d.extraLeads.length > 0) {
                d.extraLeads.forEach(item => {
                    totalLeadsInHand += item.target; 
                    totalTracked += item.tracked;
                });
            }

            // --- มิติ 1 ฐานข้อมูล (Leads) ---
            let leadPct = Math.round((totalLeadsInHand / targetLeads) * 100);
            if (leadPct > 100) leadPct = 100;
            document.getElementById('label_lead_percent').innerText = leadPct + '%';
            document.getElementById('bar_lead_flow').style.width = leadPct + '%';
            document.getElementById('text_lead_total').innerText = `มีรายชื่อในมือ: ${totalLeadsInHand.toLocaleString()} / 1,057 รายการ`;

            // --- มิติ 2 ความพยายาม (Effort/Action) ---
            let effortPct = totalLeadsInHand > 0 ? Math.round((totalTracked / totalLeadsInHand) * 100) : 0;
            if (effortPct > 100) effortPct = 100;
            document.getElementById('label_effort_percent').innerText = effortPct + '%';
            document.getElementById('bar_effort_flow').style.width = effortPct + '%';
            document.getElementById('text_effort_total').innerText = `โทรแล้ว: ${totalTracked.toLocaleString()} / ${totalLeadsInHand.toLocaleString()} รายการ`;

            // --- มิติ 3 ผลลัพธ์สุทธิ (Outcome/Result) ---
            let outcomePct = Math.round((d.current / targetOutcome) * 100);
            if (outcomePct > 100) outcomePct = 100;
            document.getElementById('label_outcome_percent').innerText = outcomePct + '%';
            document.getElementById('bar_outcome_flow').style.width = outcomePct + '%';
            document.getElementById('text_outcome_total').innerText = `เข้าจริง: ${d.current.toLocaleString()} / 317 คัน`;

            // --- 💡 กำหนดข้อความ Motivation ตาม 3 มิติ ---
            let motivationText = "";
            if(outcomePct >= 100) {
                motivationText = "🏆 ยอดเยี่ยมเหนือความคาดหมาย! ผลงานรถเข้าศูนย์ทะลุเป้าหมาย 317 คันแล้ว ขอเสียงปรบมือให้ทีม CR ครับ 🎉"; 
                if(!hasCelebratedCR100) { confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 3000 }); hasCelebratedCR100 = true; }
            } else if (effortPct >= 100) {
                motivationText = "🔥 ความพยายามสุดยอดมาก! โทรติดตามลูกค้าครบทุกรายชื่อในมือแล้ว รอรับผลลัพธ์ที่สวยงามได้เลย 🚀";
                hasCelebratedCR100 = false;
            } else if (totalLeadsInHand < targetLeads) {
                let shortage = targetLeads - totalLeadsInHand;
                motivationText = `⚠️ <b>แจ้งเตือนผู้บริหาร:</b> ฐานข้อมูลยังขาดอีก ${shortage} รายชื่อเพื่อให้ถึงเป้าหมาย | <b>ทีม CR:</b> สู้ๆ ทยอยโทรที่มีอยู่ในมือให้ครบก่อนนะครับ 💪`;
                hasCelebratedCR100 = false;
            } else {
                motivationText = "💪 ฐานข้อมูลพร้อมแล้ว! ลุยโทรติดตามให้ครบทุกรายชื่อ เพื่อเป้าหมายรถเข้าศูนย์ของเราครับ ✨";
                hasCelebratedCR100 = false;
            }
            document.getElementById('dash_motivation').innerHTML = motivationText;

            // อัปเดตข้อมูลจิปาถะ และกราฟต่างๆ
            document.getElementById('update_kannika').innerText = d.lastUpdateKannika;
            document.getElementById('update_ruangsiri').innerText = d.lastUpdateRuangsiri;

            const barCtx = document.getElementById('crChart').getContext('2d');
            const barGradKannika = createGradient(barCtx, '#4ade80', '#15803d'); 
            const barGradRuangsiri = createGradient(barCtx, '#60a5fa', '#1d4ed8'); 

            if (crChartInstance) crChartInstance.destroy();
            crChartInstance = new Chart(barCtx, {
                type: 'bar',
                data: { 
                    labels: ['กรรณิกา', 'เรืองศิริ'], 
                    datasets: [{ data: [d.kannika, d.ruangsiri], backgroundColor: [barGradKannika, barGradRuangsiri], borderRadius: 6 }] 
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } }, 
                    plugins: { legend: { display: false }, datalabels: { color: '#334155', font: { weight: 'bold', size: 16 }, anchor: 'end', align: 'top', offset: 4, formatter: v => v > 0 ? v : '' } }, 
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } 
                }
            });

            const typeCtx = document.getElementById('typeChart').getContext('2d');
            const donutGrad1 = createGradient(typeCtx, '#34d399', '#047857'); 
            const donutGrad2 = createGradient(typeCtx, '#fbbf24', '#b45309'); 
            const donutGrad3 = createGradient(typeCtx, '#38bdf8', '#0369a1'); 
            const donutGradients = [donutGrad1, donutGrad2, donutGrad3];

            if (typeChartInstance) typeChartInstance.destroy();
            typeChartInstance = new Chart(typeCtx, {
                type: 'doughnut',
                data: { 
                    labels: ['รายชื่อจากระบบตรีเพชร', 'ลูกค้าติดต่อรับบริการด้วยตนเอง ', 'ได้รับการแนะนำ'], 
                    datasets: [{ data: [d.breakdown.tripetch, d.breakdown.inbound, d.breakdown.referral], backgroundColor: donutGradients, borderWidth: 2 }] 
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, cutout: '55%', 
                    plugins: { 
                        legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 10, font: { size: 13 } } }, 
                        datalabels: { color: '#fff', font: { weight: 'bold', size: 13 }, textAlign: 'center', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,0.3)', formatter: donutFormatter } 
                    } 
                }
            });

            // ==========================================
            // 🌟 วาดการ์ดทั้งหมดให้เรียงต่อกันในกล่องเดียว 🌟
            // ==========================================
            let finalCardsHtml = '';
            
            let lastUpdateBadge = d.csvLastUpdate && d.csvLastUpdate !== '-' ? `<span style="font-size: 12px; background: #e3f2fd; color: #1565c0; padding: 4px 10px; border-radius: 12px; font-weight: normal; margin-left: 10px; border: 1px solid #bbdefb;"><i class="fas fa-history"></i> ล่าสุด: ${d.csvLastUpdate}</span>` : '';
            finalCardsHtml += `<div style="grid-column: 1 / -1; display: flex; align-items: center; flex-wrap: wrap; margin-bottom:10px;"><h3 style="color:#0d47a1; margin: 0;"><i class="fas fa-headset" style="color:#1565c0;"></i> สรุปสถานะการติดตามลูกค้า (อัปเดตจากตรีเพชร)</h3>${lastUpdateBadge}</div>`;

            // 1. วาดการ์ด CSV แบบเก่า (สีฟ้า/เทา)
            if (d.csvData && d.csvData.length > 0) {
                d.csvData.forEach(item => {
                    const needToCall = item.tracked + item.untracked; 
                    let actualPercent = needToCall === 0 ? 100 : Math.round((item.tracked / needToCall) * 100);
                    finalCardsHtml += `
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
            } else { 
                finalCardsHtml += '<p style="grid-column: 1 / -1; text-align:center; color:#777; padding: 40px; background: #fff; border: 1px dashed #ccc; border-radius: 10px; margin-bottom: 20px;">⚠️ ผู้ดูแลระบบยังไม่ได้อัปโหลดฐานข้อมูลการติดตามลูกค้าในเดือนนี้</p>'; 
            }

            // 2. วาดการ์ด Extra Leads ที่แอดมินเพิ่งเพิ่มเข้ามา (สีเขียว)
            if (d.extraLeads && d.extraLeads.length > 0) {
                d.extraLeads.forEach(item => {
                    const needToCall = item.tracked + item.untracked; 
                    let actualPercent = needToCall === 0 ? 100 : Math.round((item.tracked / needToCall) * 100);
                    finalCardsHtml += `
                    <div class="csv-card" style="border: 2px solid #81c784; background: #f1f8e9;">
                        <div class="csv-title" style="color: #2e7d32;"><i class="fas fa-link"></i> ${item.sheetName}</div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
                            <span style="color:#555;">ความคืบหน้าการโทร</span><span style="color:#2e7d32; font-weight:bold;">${actualPercent}%</span>
                        </div>
                        <div style="width:100%; background:#c8e6c9; height:12px; border-radius:6px; overflow:hidden; margin-bottom:15px;">
                            <div style="width:${actualPercent}%; background:linear-gradient(90deg, #388e3c, #81c784); height:100%; transition: width 1s;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; background:#fff; padding:8px; border-radius:6px; margin-bottom:5px; border: 1px solid #e8f5e9;">
                            <span>🎯 รายชื่อที่หามาเพิ่ม:</span><b style="color: #2e7d32;">${item.target} รายการ</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; background:#fff; padding:8px; border-radius:6px; border: 1px solid #e8f5e9; margin-bottom: 5px;">
                            <span>📞 สถานะการโทร:</span><span>โทรแล้ว <b style="color:#1565c0;">${item.tracked}</b> | ค้าง <b style="color:#d32f2f;">${item.untracked}</b></span>
                        </div>
                        <a href="${item.url}" target="_blank" style="display: block; text-align: center; font-size: 12px; color: #1565c0; text-decoration: none; margin-top: 5px;"><i class="fas fa-external-link-alt"></i> เปิดไฟล์ Google Sheet</a>
                    </div>`;
                });
            }
            
            // 3. เติมการ์ด ปุ่ม "+" ต่อท้ายสุดเสมอ
            finalCardsHtml += `
            <div class="csv-card" style="border: 2px dashed #4caf50; background: #f1f8e9; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; min-height: 200px; transition: 0.2s;" onclick="openExtraLeadModal()" onmouseover="this.style.background='#e8f5e9'; this.style.transform='translateY(-3px)';" onmouseout="this.style.background='#f1f8e9'; this.style.transform='translateY(0)';">
                <i class="fas fa-plus-circle" style="font-size: 40px; color: #2e7d32; margin-bottom: 15px;"></i>
                <h4 style="color: #1b5e20; margin: 0;">เพิ่มฐานข้อมูลเสริม</h4>
                <p style="font-size: 13px; color: #555; margin-top: 8px;">เชื่อมโยง Google Sheet (Track อัตโนมัติ)</p>
            </div>`;

            document.getElementById('dash_csv_tracking').innerHTML = finalCardsHtml;
        }
    })
    .catch(e => { 
        document.getElementById('dash_loading').innerText = "โหลดข้อมูลล้มเหลว"; 
    });
}

function openBreakdownModal() {
    if (!currentDashboardData) return Swal.fire({ icon: 'warning', text: 'ข้อมูลยังไม่พร้อม กรุณารอสักครู่' });
    const d = currentDashboardData;
    document.getElementById('breakdown-modal').style.display = 'flex';

    setTimeout(() => {
        const kanCtx = document.getElementById('kannikaChart').getContext('2d');
        const ruangCtx = document.getElementById('ruangsiriChart').getContext('2d');
        
        const dGrad1 = createGradient(kanCtx, '#34d399', '#047857'); 
        const dGrad2 = createGradient(kanCtx, '#fbbf24', '#b45309'); 
        const dGrad3 = createGradient(kanCtx, '#38bdf8', '#0369a1'); 
        const donutGradients = [dGrad1, dGrad2, dGrad3];

        if (kannikaChartInstance) kannikaChartInstance.destroy();
        kannikaChartInstance = new Chart(kanCtx, { 
            type: 'doughnut', 
            data: { labels: ['รายชื่อจากระบบตรีเพชร', 'ลูกค้าติดต่อรับบริการด้วยตนเอง ', 'ได้รับการแนะนำ'], datasets: [{ data: [d.kannikaBreakdown.tripetch, d.kannikaBreakdown.inbound, d.kannikaBreakdown.referral], backgroundColor: donutGradients, borderWidth: 2 }] }, 
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { size: 12 } } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, textAlign: 'center', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,0.3)', formatter: donutFormatter } } } 
        });
        
        if (ruangsiriChartInstance) ruangsiriChartInstance.destroy();
        ruangsiriChartInstance = new Chart(ruangCtx, { 
            type: 'doughnut', 
            data: { labels: ['รายชื่อจากระบบตรีเพชร', 'ลูกค้าติดต่อรับบริการด้วยตนเอง ', 'ได้รับการแนะนำ'], datasets: [{ data: [d.ruangsiriBreakdown.tripetch, d.ruangsiriBreakdown.inbound, d.ruangsiriBreakdown.referral], backgroundColor: donutGradients, borderWidth: 2 }] }, 
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { size: 12 } } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, textAlign: 'center', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,0.3)', formatter: donutFormatter } } } 
        });
    }, 100);
}

function closeBreakdownModal() { 
    document.getElementById('breakdown-modal').style.display = 'none'; 
}

// ==========================================
// 🌟 แท็บ 2: บันทึกข้อมูล และ การจัดการประวัติ (Edit/Delete/Filter/Pagination)
// ==========================================
function calculateTotal() {
    const tripetch = parseInt(document.getElementById('type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('type_referral').value) || 0;
    document.getElementById('type_total').value = tripetch + inbound + referral;
}

function saveRecord() {
    const crName = document.getElementById('cr_name').value;
    const recordDate = document.getElementById('record_date').value;
    
    if (!recordDate) return Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณาระบุวันที่ก่อนทำรายการ', confirmButtonColor: '#1565c0' });
    
    const tot = parseInt(document.getElementById('type_total').value) || 0;

    const executeSave = () => {
        localStorage.setItem('cr_hub_name', crName);
        const payload = { 
            action: "save_record", date: recordDate, cr_name: crName, 
            tripetch: parseInt(document.getElementById('type_tripetch').value) || 0, 
            inbound: parseInt(document.getElementById('type_inbound').value) || 0, 
            referral: parseInt(document.getElementById('type_referral').value) || 0, 
            total: tot 
        };
        
        showLoading('กำลังบันทึกข้อมูล...');

        fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(r => r.json())
        .then(data => {
            if(data.result === 'success') { 
                Swal.fire({ icon: 'success', title: 'สำเร็จ!', text: 'บันทึกข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว', timer: 2000, showConfirmButton: false });
                document.getElementById('type_tripetch').value = 0; 
                document.getElementById('type_inbound').value = 0; 
                document.getElementById('type_referral').value = 0; 
                calculateTotal(); 
                
                loadRecentRecords();
                loadDashboard();
            }
        })
        .catch(e => { 
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่' });
        });
    };

    if (tot === 0) {
        Swal.fire({
            title: 'ยอดรวมเป็น 0 คัน',
            text: "คุณแน่ใจหรือไม่ที่จะส่งข้อมูลยอดเป็น 0 เข้าสู่ระบบ?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#1565c0',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ยืนยันส่งข้อมูล',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) executeSave();
        });
    } else {
        executeSave();
    }
}

function loadRecentRecords() {
    const mEl = document.getElementById('filter_record_month');
    const yEl = document.getElementById('filter_record_year');
    const month = mEl ? mEl.value : String(new Date().getMonth() + 1).padStart(2, '0');
    const year = yEl ? yEl.value : new Date().getFullYear();
    
    document.getElementById('recentRecordsTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #777;"><div class="spinner-small"></div> กำลังโหลดข้อมูลประวัติ...</td></tr>';
    
    fetch(`${API_URL}?action=get_recent_records&month=${month}&year=${year}`)
    .then(r => r.json())
    .then(res => {
        if(res.result === 'success') {
            recentRecordsList = res.data;
            applyRecordFilters(); 
        } else {
            document.getElementById('recentRecordsTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #777;">ไม่พบข้อมูลประวัติในระบบ</td></tr>';
            if (document.getElementById('recordPagination')) document.getElementById('recordPagination').innerHTML = '';
        }
    }).catch(e => {
        document.getElementById('recentRecordsTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #d32f2f;">เครือข่ายขัดข้อง โหลดข้อมูลประวัติล้มเหลว</td></tr>';
    });
}

function applyRecordFilters() {
    const crFilterEl = document.getElementById('filter_record_cr');
    const crFilter = crFilterEl ? crFilterEl.value : 'all';

    filteredRecordsList = recentRecordsList.filter(rec => {
        if (crFilter !== 'all' && rec.cr_name !== crFilter) return false;
        return true;
    });

    filteredRecordsList.sort((a, b) => new Date(b.date) - new Date(a.date));

    currentRecordPage = 1; 
    renderRecentRecords();
}

function renderRecentRecords() {
    const tbody = document.getElementById('recentRecordsTableBody');
    
    if(filteredRecordsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #777;">ไม่พบประวัติการบันทึกงานตามเงื่อนไขที่เลือก</td></tr>';
        if (document.getElementById('recordPagination')) document.getElementById('recordPagination').innerHTML = '';
        return;
    }
    
    const totalItems = filteredRecordsList.length;
    const totalPages = Math.ceil(totalItems / recordsPerPage) || 1;
    const startIndex = (currentRecordPage - 1) * recordsPerPage;
    const pageData = filteredRecordsList.slice(startIndex, startIndex + recordsPerPage);
    
    let html = '';
    pageData.forEach(rec => {
        let displayDate = rec.date;
        try {
            const parts = rec.date.split('T')[0].split('-');
            if(parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`; 
        } catch(e) {}

        html += `
        <tr>
            <td>${displayDate}</td>
            <td><b>${rec.cr_name}</b></td>
            <td>${rec.tripetch}</td>
            <td>${rec.inbound}</td>
            <td>${rec.referral}</td>
            <td><b style="color:#1565c0;">${rec.total}</b></td>
            <td>
                <button class="btn-sm" onclick="openEditRecordModal('${rec.id}')" title="แก้ไข"><i class="fas fa-edit"></i></button>
                <button class="btn-sm btn-danger-sm" onclick="deleteRecord('${rec.id}')" title="ลบ"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;

    const paginationContainer = document.getElementById('recordPagination');
    if (paginationContainer) {
        paginationContainer.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 15px;">
                <button class="btn-sm" style="padding: 8px 12px; border-radius: 6px;" ${currentRecordPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="changeRecordPage(-1)">◀ ก่อนหน้า</button>
                <span style="font-weight:bold; font-size:14px; margin: 0 5px; color: #555;">หน้า ${currentRecordPage} / ${totalPages}</span>
                <button class="btn-sm" style="padding: 8px 12px; border-radius: 6px;" ${currentRecordPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="changeRecordPage(1)">ถัดไป ▶</button>
            </div>
        `;
    }
}

function changeRecordPage(direction) {
    currentRecordPage += direction;
    renderRecentRecords();
}

function deleteRecord(id) {
    Swal.fire({
        title: 'ยืนยันการลบประวัติ?',
        text: "ข้อมูลนี้จะถูกลบออกจากระบบและหายไปจากแดชบอร์ดถาวร",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#aaa',
        confirmButtonText: 'ลบเลย!'
    }).then((result) => {
        if(result.isConfirmed) {
            showLoading('กำลังลบข้อมูล...');
            fetch(API_URL, { method:'POST', body: JSON.stringify({action: 'delete_record', id: id}) })
            .then(r => r.json())
            .then(res => {
                if(res.result === 'success') {
                    Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', showConfirmButton: false, timer: 1500 });
                    loadRecentRecords();
                    loadDashboard();
                } else {
                    Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: res.message });
                }
            }).catch(e => Swal.fire({ icon: 'error', title: 'ขัดข้อง', text: 'เชื่อมต่อขัดข้อง' }));
        }
    });
}

function openEditRecordModal(id) {
    const rec = recentRecordsList.find(r => String(r.id) === String(id));
    if(!rec) return;
    
    document.getElementById('edit_record_id').value = rec.id;
    document.getElementById('edit_cr_name').value = rec.cr_name;
    document.getElementById('edit_record_date').value = rec.date.split('T')[0]; 
    document.getElementById('edit_type_tripetch').value = rec.tripetch;
    document.getElementById('edit_type_inbound').value = rec.inbound;
    document.getElementById('edit_type_referral').value = rec.referral;
    document.getElementById('edit_type_total').value = rec.total;
    
    document.getElementById('editRecordModal').style.display = 'flex';
}

function closeEditRecordModal() {
    document.getElementById('editRecordModal').style.display = 'none';
}

function calculateEditTotal() {
    const tripetch = parseInt(document.getElementById('edit_type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('edit_type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('edit_type_referral').value) || 0;
    document.getElementById('edit_type_total').value = tripetch + inbound + referral;
}

function saveEditRecord() {
    const id = document.getElementById('edit_record_id').value;
    const crName = document.getElementById('edit_cr_name').value;
    const date = document.getElementById('edit_record_date').value;
    const tp = parseInt(document.getElementById('edit_type_tripetch').value) || 0;
    const ib = parseInt(document.getElementById('edit_type_inbound').value) || 0;
    const rf = parseInt(document.getElementById('edit_type_referral').value) || 0;
    const tot = parseInt(document.getElementById('edit_type_total').value) || 0;

    if (!date) return Swal.fire({ icon: 'warning', text: 'กรุณาระบุวันที่' });

    showLoading('กำลังอัปเดตข้อมูล...');
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'edit_record', id: id, cr_name: crName, date: date, 
            tripetch: tp, inbound: ib, referral: rf, total: tot
        })
    })
    .then(r => r.json())
    .then(res => {
        if(res.result === 'success') {
            Swal.fire({ icon: 'success', title: 'แก้ไขสำเร็จ', showConfirmButton: false, timer: 1500 });
            closeEditRecordModal();
            loadRecentRecords();
            loadDashboard();
        } else {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: res.message });
        }
    }).catch(e => Swal.fire({ icon: 'error', title: 'ขัดข้อง', text: 'เชื่อมต่อขัดข้อง' }));
}

// ==========================================
// 🌟 แท็บ 3: ศูนย์ฝึกอบรมและประเมินผล (Training Quiz)
// ==========================================
function loadQuizTopics() {
    fetch(`${API_URL}?action=get_quiz_list`)
    .then(r => r.json())
    .then(res => {
        if(res.result === 'success') {
            let html = '<option value="">-- เลือกหัวข้อที่ต้องการสอบ --</option>';
            res.data.forEach(t => html += `<option value="${t}">${t}</option>`);
            document.getElementById('quiz_topic_list').innerHTML = html;
        }
    });
}

function loadScoreHistory() {
    fetch(`${API_URL}?action=get_score_history`)
    .then(r => r.json())
    .then(res => {
        if(res.result === 'success') {
            let html = '';
            const reversedData = res.data.reverse();
            const uniqueHistory = [];
            const seen = new Set();
            
            reversedData.forEach(h => {
                let key = h.name + "_" + h.topic; 
                if(!seen.has(key)) { seen.add(key); uniqueHistory.push(h); }
            });

            uniqueHistory.slice(0, 10).forEach(h => {
                let scoreClass = (h.score/h.full >= 0.8) ? '#10b981' : (h.score/h.full >= 0.5 ? '#f59e0b' : '#ef4444');
                html += `
                <div class="history-item" style="border-left: 4px solid ${scoreClass}; background:#fff; padding: 15px; border-radius: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div><b style="color:#1e293b; font-size: 15px;">${h.name}</b><br><span style="color:#64748b; font-size: 13px;">${h.topic}</span><br><small style="color:#94a3b8;">${new Date(h.date).toLocaleDateString('th-TH')}</small></div>
                    <div style="text-align:right; font-size:13px; color:#475569;">คะแนน: <b style="color:${scoreClass}; font-size: 20px;">${h.score}/${h.full}</b><br><span style="font-size: 11px;">รอบที่สอบ: ${h.attempt}</span></div>
                </div>`;
            });
            document.getElementById('score-history-container').innerHTML = html || '<p style="text-align:center; color:#999; padding: 20px;">ยังไม่มีประวัติการทำแบบทดสอบในระบบ</p>';
        }
    });
}

function prepareQuiz() {
    const topic = document.getElementById('quiz_topic_list').value;
    const name = document.getElementById('quiz_user_name').value;
    if(!topic) return Swal.fire({ icon: 'warning', title: 'ช้าก่อน!', text: 'กรุณาเลือกหัวข้อแบบทดสอบก่อนเริ่มสอบครับ', confirmButtonColor: '#1565c0' });
    
    localStorage.setItem('cr_hub_name', name);
    showLoading('กำลังจัดเตรียมข้อสอบ...');
    
    fetch(`${API_URL}?action=get_quiz_questions&topic=${encodeURIComponent(topic.trim())}`)
    .then(r => r.json())
    .then(res => {
        Swal.close();
        if(res.result === 'success' && res.data.length > 0) {
            currentQuestions = res.data;
            currentQuestionIndex = 0;
            score = 0;
            userAnswers = [];
            
            document.getElementById('quiz-selection').style.display = 'none';
            document.getElementById('quiz-container').style.display = 'block';
            document.getElementById('current_quiz_title').innerText = topic;
            
            showQuestion();
        } else {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: 'ไม่พบคำถามในหัวข้อนี้ กรุณาติดต่อแอดมิน', confirmButtonColor: '#d33' });
        }
    })
    .catch(e => {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'เครือข่ายขัดข้อง', text: 'เชื่อมต่อฐานข้อมูลล้มเหลว', confirmButtonColor: '#d33' });
    });
}

function showQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    document.getElementById('quiz_step').innerText = `ข้อที่ ${currentQuestionIndex + 1} จาก ${currentQuestions.length}`;
    
    document.getElementById('explanation_box').style.display = 'none';
    document.getElementById('next-q-btn').style.display = 'none';
    document.getElementById('q_text').innerText = `${currentQuestionIndex + 1}. ${q.q}`;
    
    let optionsHtml = '';
    const choices = [
        { id: 'A', text: q.a, explain: q.expA },
        { id: 'B', text: q.b, explain: q.expB },
        { id: 'C', text: q.c, explain: q.expC },
        { id: 'D', text: q.d, explain: q.expD }
    ];

    choices.forEach(choice => {
        optionsHtml += `
        <div class="quiz-opt-container" id="container-${choice.id}">
            <div class="quiz-opt-header" onclick="checkAnswer('${choice.id}')">
                <span style="background:#eee; padding:5px 10px; border-radius:5px; font-weight:bold; color:#333;">${choice.id}</span>
                ${choice.text}
            </div>
            <div class="opt-explain" id="explain-${choice.id}">
                ${choice.explain ? choice.explain : "ไม่มีคำอธิบายเพิ่มเติมสำหรับข้อนี้"}
            </div>
        </div>`;
    });

    document.getElementById('options_container').innerHTML = optionsHtml;
}

function checkAnswer(userAns) {
    const q = currentQuestions[currentQuestionIndex];
    const containers = document.querySelectorAll('.quiz-opt-container');
    
    containers.forEach(c => c.classList.add('locked')); 
    userAnswers[currentQuestionIndex] = userAns;

    if (userAns === q.correct) {
        document.getElementById(`container-${userAns}`).classList.add('correct');
        score++;
    } else {
        document.getElementById(`container-${userAns}`).classList.add('incorrect');
        if(document.getElementById(`container-${q.correct}`)) {
            document.getElementById(`container-${q.correct}`).classList.add('correct');
        }
    }

    document.getElementById('explain-A').style.display = 'block';
    document.getElementById('explain-B').style.display = 'block';
    document.getElementById('explain-C').style.display = 'block';
    document.getElementById('explain-D').style.display = 'block';

    if(q.expSummary) {
        document.getElementById('explanation_text').innerText = q.expSummary;
        document.getElementById('explanation_box').style.display = 'block';
    }
    
    document.getElementById('next-q-btn').style.display = 'block';
    if(currentQuestionIndex === currentQuestions.length - 1) {
        document.getElementById('next-q-btn').innerHTML = 'ส่งคำตอบประเมินผล <i class="fas fa-paper-plane"></i>';
    } else {
        document.getElementById('next-q-btn').innerHTML = 'ข้อถัดไป <i class="fas fa-arrow-right"></i>';
    }
}

function nextQuestion() {
    if(currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    showLoading('กำลังประมวลผลคะแนน...');
    
    const payload = {
        action: 'save_quiz_score',
        cr_name: document.getElementById('quiz_user_name').value,
        quiz_title: document.getElementById('current_quiz_title').innerText.trim(), 
        score: score,
        full_score: currentQuestions.length
    };
    
    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(res => {
        Swal.close();
        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('quiz-result').style.display = 'block';
        
        const pct = (score / currentQuestions.length) * 100;
        let iconHtml = '';
        
        if (pct >= 80) {
           iconHtml = '<i class="fas fa-trophy" style="color:#f59e0b;"></i>';
           confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, zIndex: 3000 });
        } else if (pct >= 50) {
           iconHtml = '<i class="fas fa-thumbs-up" style="color:#0ea5e9;"></i>';
        } else {
           iconHtml = '<i class="fas fa-book" style="color:#64748b;"></i>';
        }
        
        document.getElementById('result-icon').innerHTML = iconHtml;
        document.getElementById('result-score-text').innerText = `คุณทำได้ ${score} / ${currentQuestions.length} คะแนน`;
        document.getElementById('result-attempt-text').innerText = `(บันทึกเป็นความพยายามการสอบครั้งที่ ${res.attempt})`;
    })
    .catch(e => {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถบันทึกคะแนนได้', confirmButtonColor: '#d33' });
    });
}

function resetQuiz() {
    document.getElementById('quiz-result').style.display = 'none';
    document.getElementById('quiz-selection').style.display = 'block';
    document.getElementById('quiz_topic_list').value = "";
    loadScoreHistory(); 
}

// ==========================================
// 🌟 แท็บ 4: รายงานสรุป (Reports)
// ==========================================
function loadReports() {
    const container = document.getElementById('reports-container'); 
    container.innerHTML = '<div class="spinner-small"></div>';
    
    fetch(API_URL + "?action=get_reports")
    .then(r => r.json())
    .then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            allReportsList = data.data.reverse(); 
            
            const periodDropdown = document.getElementById('report_period_filter');
            const uniquePeriods = [...new Set(allReportsList.map(item => item.period))]; 
            
            let options = '<option value="all">ทุกเดือน (ทั้งหมด)</option>';
            uniquePeriods.forEach(p => {
                let isSelected = (p === uniquePeriods[0]) ? "selected" : "";
                options += `<option value="${p}" ${isSelected}>${p}</option>`;
            });
            periodDropdown.innerHTML = options;
            
            filterReports();
        } else { 
            container.innerHTML = `<p style="text-align:center; width:100%;">ไม่พบเอกสารรายงาน</p>`; 
        }
    });
}

function filterReports() {
    const periodFilter = document.getElementById('report_period_filter').value;
    const typeFilter = document.getElementById('report_type_filter').value;

    let filteredList = allReportsList.filter(item => {
        let matchPeriod = (periodFilter === "all" || item.period === periodFilter);
        let matchType = (typeFilter === "all" || item.type === typeFilter);
        return matchPeriod && matchType;
    });

    renderReports(filteredList);
}

function renderReports(list) {
    const container = document.getElementById('reports-container');
    if(list.length === 0) {
        container.innerHTML = `<p style="text-align:center; width:100%; color:#777; padding: 20px; border: 1px dashed #ccc; border-radius: 8px; background: #fff;">ไม่พบเอกสารรายงานที่ตรงกับเงื่อนไขการค้นหา</p>`;
        return;
    }
    
    let html = ''; 
    list.forEach(item => {
        const typeClass = item.type === 'รายเดือน' ? 'monthly' : '';
        const icon = item.type === 'รายเดือน' ? 'fa-calendar-alt' : 'fa-calendar-week';
        html += `<div class="report-item ${typeClass}"><div class="report-info"><h4><i class="fas ${icon}"></i> ${item.filename}</h4><p>รอบการประเมิน: <b>${item.period}</b> | ชนิดรายงาน: ${item.type}</p></div><a href="${item.link}" target="_blank" class="btn-view" style="width:auto;"><i class="fas fa-file-pdf"></i> เปิดดูเอกสาร</a></div>`;
    });
    container.innerHTML = html;
}

// ==========================================
// 🌟 แท็บ 5: ข้อมูลโปรโมชัน (Promotions)
// ==========================================
function loadPromotions() {
    const container = document.getElementById('promo-container'); 
    container.innerHTML = '<div class="spinner-small"></div>';
    
    fetch(API_URL + "?action=get_promos")
    .then(r => r.json())
    .then(data => {
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
        } else {
            container.innerHTML = '<p style="text-align:center; width:100%;">ไม่พบข้อมูลในระบบ</p>';
        }
    });
}

// ==========================================
// 🌟 แท็บ 6: ผู้ดูแลระบบ (Admin) & ฟีเจอร์เสริม (Extra Leads)
// ==========================================
function uploadCSV() {
    const fileInput = document.getElementById('csv_file');
    const file = fileInput.files[0];
    const adminMonth = document.getElementById('admin_month').value;
    const adminYear = document.getElementById('admin_year').value;

    if (!file) return Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณาแนบไฟล์นามสกุล .csv ก่อนทำรายการ', confirmButtonColor: '#1565c0' });

    showLoading('กำลังอัปโหลดและประมวลผลข้อมูล...');

    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        transformHeader: function(header) { return header.trim().replace(/^\uFEFF/, ''); },
        complete: function(results) {
            const payload = { action: "upload_csv", month: adminMonth, year: adminYear, csvData: results.data };
            
            fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
            .then(r => r.json())
            .then(res => {
                Swal.close();
                if(res.result === 'success') { 
                    Swal.fire({ icon: 'success', title: 'อัปเดตสำเร็จ!', text: 'ข้อมูลถูกบันทึกในเดือนที่ระบุเรียบร้อยแล้ว', confirmButtonColor: '#1565c0' });
                    fileInput.value = ""; 
                    document.getElementById('dash_month').value = adminMonth; 
                    document.getElementById('dash_year').value = adminYear;
                    switchTab({currentTarget: document.querySelector('.tab-btn')}, 'tab-dashboard');
                } else {
                    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: res.message, confirmButtonColor: '#d33' });
                }
            }).catch(e => {
                Swal.close();
                Swal.fire({ icon: 'error', title: 'เครือข่ายขัดข้อง', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', confirmButtonColor: '#d33' });
            });
        }
    });
}

// 🌟 ฟังก์ชันจัดการ Extra Leads (ฐานข้อมูลเสริม) 🌟
function openExtraLeadModal() {
    document.getElementById('extraLeadModal').style.display = 'flex';
}

function closeExtraLeadModal() {
    document.getElementById('extraLeadModal').style.display = 'none';
}

function saveExtraLead() {
    const url = document.getElementById('extra_sheet_url').value;
    const sheetName = document.getElementById('extra_sheet_name').value;
    const month = document.getElementById('dash_month').value; 
    const year = document.getElementById('dash_year').value;

    if (!url || !sheetName) {
        return Swal.fire({ icon: 'warning', text: 'กรุณากรอกลิงก์และชื่อแท็บให้ครบถ้วน' });
    }

    showLoading('กำลังดึงข้อมูลจาก Google Sheet...');

    const payload = {
        action: 'save_extra_lead',
        month: month,
        year: year,
        url: url.trim(),
        sheetName: sheetName.trim()
    };

    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(res => {
        Swal.close();
        if(res.result === 'success') {
            Swal.fire({ 
                icon: 'success', 
                title: 'เชื่อมโยงสำเร็จ!', 
                text: `ดึงมาได้ ${res.data.target} รายการ (โทรแล้ว ${res.data.tracked} / ค้าง ${res.data.untracked})`,
                confirmButtonColor: '#1565c0' 
            });
            document.getElementById('extra_sheet_url').value = '';
            document.getElementById('extra_sheet_name').value = '';
            closeExtraLeadModal();
            loadDashboard(); // รีเฟรชแดชบอร์ดเพื่อให้การ์ดสีเขียวขึ้น
        } else {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: res.message });
        }
    }).catch(e => {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'ขัดข้อง', text: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' });
    });
}
