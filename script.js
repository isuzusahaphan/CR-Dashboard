// ⚠️ สำคัญมาก: กรุณาแก้ไข API_URL ด้านล่างนี้ ให้เป็น URL ของคุณรณกฤตก่อนใช้งานจริงนะครับ
const API_URL = "https://script.google.com/macros/s/AKfycbyz-B3bW7G5OgqCHJWXmIvDnxzks_Itp7yErwZ8t77DhiQdsFzklhxz9V6hS_s_ijoO3A/exec"; 

Chart.register(ChartDataLabels);
let crChartInstance = null;
let typeChartInstance = null;
let kannikaChartInstance = null;
let ruangsiriChartInstance = null;
let currentDashboardData = null; 

let allReportsList = [];

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
    
    if(document.getElementById('dash_month').querySelector(`option[value="${mm}"]`)) document.getElementById('dash_month').value = mm;
    if(document.getElementById('dash_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('dash_year').value = yyyy;
    if(document.getElementById('admin_month').querySelector(`option[value="${mm}"]`)) document.getElementById('admin_month').value = mm;
    if(document.getElementById('admin_year').querySelector(`option[value="${yyyy}"]`)) document.getElementById('admin_year').value = yyyy;

    const savedCR = localStorage.getItem('cr_hub_name');
    if (savedCR) {
        document.getElementById('cr_name').value = savedCR;
        document.getElementById('quiz_user_name').value = savedCR;
    }

    loadDashboard();
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
// 🌟 แท็บ 1: กระดานแสดงผล (Dashboard)
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

let hasCelebratedCR100 = false; // ป้องกันพลุยิงซ้ำซาก

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
            currentDashboardData = d; 

            document.getElementById('dash_target').innerText = d.target;
            document.getElementById('dash_current').innerText = d.current;
            
            document.getElementById('update_kannika').innerText = d.lastUpdateKannika;
            document.getElementById('update_ruangsiri').innerText = d.lastUpdateRuangsiri;

            let percent = d.target > 0 ? Math.round((d.current / d.target) * 100) : 0;
            const pb = document.getElementById('dash_progress');
            pb.style.width = (percent > 100 ? 100 : percent) + '%'; 
            pb.innerText = percent + '%';
            
            let motivationText = "";
            if(percent >= 100) { 
                pb.style.background = "linear-gradient(90deg, #1b5e20, #388e3c)"; 
                motivationText = "🏆 ยอดเยี่ยมเหนือความคาดหมาย! ผลงานทะลุเป้าหมายประจำเดือนแล้ว ขอเสียงปรบมือให้ทีม CR ครับ 🎉"; 
                
                // 🔥 ยิงพลุเมื่อยอดเป้าหมาย CR ทะลุ 100%
                if(!hasCelebratedCR100) {
                    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 3000 });
                    hasCelebratedCR100 = true;
                }
            } else if(percent >= 80) { 
                pb.style.background = "linear-gradient(90deg, #388e3c, #81c784)"; 
                motivationText = "🔥 โค้งสุดท้ายแล้ว! ผลงานทะลุ 80% ลุยอีกนิดเดียวเป้าหมายอยู่แค่เอื้อมครับ 🚀"; 
                hasCelebratedCR100 = false;
            } else if(percent >= 50) { 
                pb.style.background = "linear-gradient(90deg, #1565c0, #4fc3f7)"; 
                motivationText = "💪 เดินทางมาเกินครึ่งทางแล้ว! รักษามาตรฐานการทำงานที่ยอดเยี่ยมนี้ต่อไปครับ ✨"; 
                hasCelebratedCR100 = false;
            } else { 
                pb.style.background = "linear-gradient(90deg, #d32f2f, #e57373)"; 
                motivationText = "🌱 เริ่มต้นเป้าหมายใหม่ ค่อยๆ สะสมยอดไปทีละคัน เป็นกำลังใจให้ทีม CR ทุกคนครับ ✌️"; 
                hasCelebratedCR100 = false;
            }
            document.getElementById('dash_motivation').innerHTML = motivationText;

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
                    labels: ['ระบบตรีเพชร', 'ติดต่อด้วยตนเอง', 'Walk-in/แนะนำ'], 
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

            if (d.csvData && d.csvData.length > 0) {
                let lastUpdateBadge = d.csvLastUpdate && d.csvLastUpdate !== '-' ? `<span style="font-size: 12px; background: #e3f2fd; color: #1565c0; padding: 4px 10px; border-radius: 12px; font-weight: normal; margin-left: 10px; border: 1px solid #bbdefb;"><i class="fas fa-history"></i> ล่าสุด: ${d.csvLastUpdate}</span>` : '';
                let csvHtml = `<div style="grid-column: 1 / -1; display: flex; align-items: center; flex-wrap: wrap; margin-top:20px; border-bottom:2px solid #bbdefb; padding-bottom:10px;"><h3 style="color:#0d47a1; margin: 0;"><i class="fas fa-headset" style="color:#1565c0;"></i> สรุปสถานะการติดตามลูกค้า (อัปเดตจากตรีเพชร)</h3>${lastUpdateBadge}</div>`;
                
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
            data: { labels: ['ระบบตรีเพชร', 'ติดต่อด้วยตนเอง', 'Walk-in/แนะนำ'], datasets: [{ data: [d.kannikaBreakdown.tripetch, d.kannikaBreakdown.inbound, d.kannikaBreakdown.referral], backgroundColor: donutGradients, borderWidth: 2 }] }, 
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { size: 12 } } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, textAlign: 'center', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,0.3)', formatter: donutFormatter } } } 
        });
        
        if (ruangsiriChartInstance) ruangsiriChartInstance.destroy();
        ruangsiriChartInstance = new Chart(ruangCtx, { 
            type: 'doughnut', 
            data: { labels: ['ระบบตรีเพชร', 'ติดต่อด้วยตนเอง', 'Walk-in/แนะนำ'], datasets: [{ data: [d.ruangsiriBreakdown.tripetch, d.ruangsiriBreakdown.inbound, d.ruangsiriBreakdown.referral], backgroundColor: donutGradients, borderWidth: 2 }] }, 
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { size: 12 } } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, textAlign: 'center', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,0.3)', formatter: donutFormatter } } } 
        });
    }, 100);
}

function closeBreakdownModal() { 
    document.getElementById('breakdown-modal').style.display = 'none'; 
}

// ==========================================
// 🌟 แท็บ 2: บันทึกข้อมูล (Input)
// ==========================================
function calculateTotal() {
    const tripetch = parseInt(document.getElementById('type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('type_referral').value) || 0;
    document.getElementById('type_total').value = tripetch + inbound + referral;
}

// 🔥 อัปเกรด Alert บันทึกข้อมูล
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

// ==========================================
// 🎓 แท็บ 3: ศูนย์ฝึกอบรมและประเมินผล (Training Quiz)
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

// 🔥 อัปเกรด Alert การเริ่มสอบ
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

// 🔥 อัปเกรดตอนประเมินผลคะแนน
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
           // 🔥 ยิงพลุฉลองคนเก่ง! 🔥
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
// 🌟 แท็บ 6: ผู้ดูแลระบบ (Admin)
// ==========================================
// 🔥 อัปเกรด Alert อัปโหลดไฟล์ CSV
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
