const API_URL = "https://script.google.com/macros/s/AKfycbyz-B3bW7G5OgqCHJWXmIvDnxzks_Itp7yErwZ8t77DhiQdsFzklhxz9V6hS_s_ijoO3A/exec";

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toLocaleDateString('en-CA');
    document.getElementById('record_date').value = today;
    
    const savedCR = localStorage.getItem('cr_hub_name');
    if (savedCR) {
        document.getElementById('cr_name').value = savedCR;
    }
});

function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');

    // โหลดข้อมูลอัตโนมัติเมื่อกดเปลี่ยนแท็บ
    if (tabId === 'tab-promo') loadPromotions();
    if (tabId === 'tab-reports') loadReports();
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
    if (total === 0) {
        if(!confirm("วันนี้ยังไม่มียอดรถเข้าเลย (รวม 0 คัน) ยืนยันที่จะบันทึกใช่หรือไม่?")) return;
    }

    localStorage.setItem('cr_hub_name', crName);

    const payload = {
        action: "save_record",
        date: recordDate,
        cr_name: crName,
        tripetch: tripetch,
        inbound: inbound,
        referral: referral,
        total: total
    };

    const btn = document.getElementById('save-btn');
    const overlay = document.getElementById('loading-overlay');
    btn.disabled = true;
    overlay.style.display = "flex";

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        overlay.style.display = "none";
        btn.disabled = false;
        
        if(data.result === 'success') {
            alert("✅ บันทึกผลงานเรียบร้อยแล้วครับ ลุยต่อได้เลย!");
            document.getElementById('type_tripetch').value = 0;
            document.getElementById('type_inbound').value = 0;
            document.getElementById('type_referral').value = 0;
            calculateTotal();
        } else {
            alert("❌ เกิดข้อผิดพลาด: " + data.message);
        }
    })
    .catch(error => {
        overlay.style.display = "none";
        btn.disabled = false;
        alert("✅ ส่งข้อมูลสำเร็จ! (ถ้ายอดไม่ขึ้นในชีต ให้ลองตรวจสอบอินเทอร์เน็ตอีกครั้ง)");
        document.getElementById('type_tripetch').value = 0;
        document.getElementById('type_inbound').value = 0;
        document.getElementById('type_referral').value = 0;
        calculateTotal();
    });
}

// ---------------------------------------------------
// 🚀 เฟส 2: ดึงข้อมูลจาก Google Sheets (GET)
// ---------------------------------------------------

// 1. ดึงคลังอาวุธลับ (พร้อมระบบคัดกรองวันที่หมดอายุ)
function loadPromotions() {
    const container = document.getElementById('promo-container');
    container.innerHTML = '<div class="spinner-small"></div>';
    
    fetch(API_URL + "?action=get_promos")
    .then(r => r.json())
    .then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            let html = '';
            const today = new Date();
            today.setHours(0,0,0,0); // รีเซ็ตเวลาเป็น 00:00:00 เพื่อเทียบแค่วันที่

            data.data.forEach(item => {
                let isValid = true;
                
                // กรองวันที่เริ่มต้น: ถ้าใส่วันเริ่ม และวันนี้ยังไม่ถึง ให้ซ่อน
                if (item.startDate) {
                    let sDate = new Date(item.startDate);
                    sDate.setHours(0,0,0,0);
                    if (today < sDate) isValid = false;
                }
                
                // กรองวันที่สิ้นสุด: ถ้าใส่วันหมดอายุ และวันนี้เลยมาแล้ว ให้ซ่อน
                if (item.endDate) {
                    let eDate = new Date(item.endDate);
                    eDate.setHours(0,0,0,0);
                    if (today > eDate) isValid = false;
                }

                // ถ้าระยะเวลาถูกต้อง ให้สร้างการ์ดแสดงผล
                if(isValid) {
                    // แอบเพิ่มลูกเล่น โชว์วันที่หมดอายุเป็นตัวสีแดงไว้เตือนความจำ CR ด้วยครับ
                    let expireText = item.endDate ? `<p style="font-size:11px; color:#d32f2f; margin-bottom:10px;"><i class="fas fa-clock"></i> หมดเขต: ${item.endDate}</p>` : '';
                    
                    html += `
                    <div class="promo-card">
                        <span style="font-size:11px; background:#e8eaf6; padding:3px 8px; border-radius:12px; color:#3f51b5; font-weight:bold;">${item.category}</span>
                        <h4 style="margin-top: 10px;">${item.title}</h4>
                        <p>${item.desc}</p>
                        ${expireText}
                        <a href="${item.link}" target="_blank" class="btn-view"><i class="fas fa-external-link-alt"></i> เปิดดูไฟล์</a>
                    </div>`;
                }
            });

            if(html === '') {
                container.innerHTML = '<p style="text-align:center; color:#777; width:100%;">ไม่มีโปรโมชั่นในช่วงเวลานี้ครับ</p>';
            } else {
                container.innerHTML = html;
            }
        } else {
            container.innerHTML = '<p style="text-align:center; color:#777; width:100%;">ยังไม่มีโปรโมชั่นในระบบครับ</p>';
        }
    }).catch(e => container.innerHTML = '<p style="color:red; text-align:center; width:100%;">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>');
}

// 2. ดึงรายงานภาพรวม (ไม่แยกบุคคลแล้ว)
function loadReports() {
    const container = document.getElementById('reports-container');
    container.innerHTML = '<div class="spinner-small"></div>';
    
    fetch(API_URL + "?action=get_reports")
    .then(r => r.json())
    .then(data => {
        if(data.result === 'success' && data.data.length > 0) {
            let html = '';
            // กลับด้าน Array เพื่อให้รายงานที่อัปโหลดล่าสุด (บรรทัดล่างสุดในชีต) โชว์ขึ้นมาก่อน
            const reversedData = data.data.reverse(); 

            reversedData.forEach(item => {
                const typeClass = item.type === 'รายเดือน' ? 'monthly' : '';
                const icon = item.type === 'รายเดือน' ? 'fa-calendar-alt' : 'fa-calendar-week';
                html += `
                <div class="report-item ${typeClass}">
                    <div class="report-info">
                        <h4><i class="fas ${icon}" style="color: #777;"></i> ${item.filename}</h4>
                        <p>รอบ: <b>${item.period}</b> | ชนิด: ${item.type}</p>
                    </div>
                    <a href="${item.link}" target="_blank" class="btn-view" style="width:auto; padding: 10px 15px;"><i class="fas fa-file-pdf"></i> เปิดดู</a>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="text-align:center; color:#777; width:100%;">ยังไม่มีรายงานในระบบครับ</p>`;
        }
    }).catch(e => container.innerHTML = '<p style="color:red; text-align:center; width:100%;">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>');
}
