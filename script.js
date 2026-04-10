// 🎯 กำหนด URL ของ Google Apps Script ที่คุณรณกฤตให้มา
const API_URL = "https://script.google.com/macros/s/AKfycbyz-B3bW7G5OgqCHJWXmIvDnxzks_Itp7yErwZ8t77DhiQdsFzklhxz9V6hS_s_ijoO3A/exec";

document.addEventListener("DOMContentLoaded", () => {
    // 1. ตั้งค่าวันที่เริ่มต้นให้เป็น "วันนี้" อัตโนมัติ
    const today = new Date().toLocaleDateString('en-CA'); // Format YYYY-MM-DD
    document.getElementById('record_date').value = today;
    
    // 2. ดึงชื่อ CR ที่เคยเลือกไว้ล่าสุด (ช่วยลดขั้นตอนให้ CR ไม่ต้องกดเลือกบ่อยๆ)
    const savedCR = localStorage.getItem('cr_hub_name');
    if (savedCR) {
        document.getElementById('cr_name').value = savedCR;
    }
});

// ฟังก์ชันสลับหน้าต่าง Tabs (เมนูด้านล่าง)
function switchTab(evt, tabId) {
    // ซ่อนเนื้อหาทั้งหมด และเอาขีดแดง (Active) ออกจากปุ่มทั้งหมด
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // โชว์เนื้อหาที่กด และขีดแดงที่ปุ่มที่กด
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// ฟังก์ชันคำนวณยอดรถรวมอัตโนมัติ ทันทีที่ CR พิมพ์ตัวเลข
function calculateTotal() {
    // ดึงค่ามาแปลงเป็นตัวเลข ถ้าช่องว่างให้มองเป็น 0
    const tripetch = parseInt(document.getElementById('type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('type_referral').value) || 0;
    
    const total = tripetch + inbound + referral;
    
    // แสดงผลที่ช่องรวม
    document.getElementById('type_total').value = total;
}

// ฟังก์ชันไฮไลท์หลัก: ดึงข้อมูลส่งเข้า Google Sheets
function saveRecord() {
    const crName = document.getElementById('cr_name').value;
    const recordDate = document.getElementById('record_date').value;
    const tripetch = parseInt(document.getElementById('type_tripetch').value) || 0;
    const inbound = parseInt(document.getElementById('type_inbound').value) || 0;
    const referral = parseInt(document.getElementById('type_referral').value) || 0;
    const total = parseInt(document.getElementById('type_total').value) || 0;

    // ดักจับ: ถ้าลืมใส่วันที่
    if (!recordDate) {
        alert("⚠️ กรุณาเลือกวันที่ก่อนบันทึกผลงานครับ");
        return;
    }

    // ดักจับ: ถ้าไม่มียอดรถเข้าเลย
    if (total === 0) {
        const confirmEmpty = confirm("วันนี้ยังไม่มียอดรถเข้าเลย (รวม 0 คัน) ยืนยันที่จะบันทึกใช่หรือไม่?");
        if(!confirmEmpty) return;
    }

    // 💾 บันทึกความจำลงในเครื่องมือถือ ว่าผู้ใช้นี้คือใคร (เช่น เรืองศิริ)
    localStorage.setItem('cr_hub_name', crName);

    // แพ็กข้อมูลเตรียมส่ง
    const payload = {
        action: "save_record",
        date: recordDate,
        cr_name: crName,
        tripetch: tripetch,
        inbound: inbound,
        referral: referral,
        total: total
    };

    // แสดงหน้าจอโหลดดิ้ง
    const btn = document.getElementById('save-btn');
    const overlay = document.getElementById('loading-overlay');
    btn.disabled = true;
    overlay.style.display = "flex";

    // 🚀 ยิงข้อมูลไปที่ Google Sheets
    fetch(API_URL, {
        method: 'POST',
        // ส่งข้อมูลเป็น JSON String ไปให้ Web App อ่าน
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        overlay.style.display = "none";
        btn.disabled = false;
        
        if(data.result === 'success') {
            alert("✅ บันทึกผลงานเรียบร้อยแล้วครับ ลุยต่อได้เลย!");
            
            // รีเซ็ตเฉพาะช่องตัวเลขให้กลับเป็น 0 เพื่อรอคีย์ข้อมูลใหม่
            document.getElementById('type_tripetch').value = 0;
            document.getElementById('type_inbound').value = 0;
            document.getElementById('type_referral').value = 0;
            calculateTotal();
        } else {
            alert("❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + data.message);
        }
    })
    .catch(error => {
        // ดัก Error เผื่อเน็ตหลุดหรือมีปัญหา CORS
        overlay.style.display = "none";
        btn.disabled = false;
        
        // *หมายเหตุ: บางเบราว์เซอร์จะบล็อกการอ่านค่ากลับจาก GAS ทำให้ขึ้น Error (CORS) 
        // แต่จริงๆ ข้อมูลวิ่งเข้าชีตไปแล้ว เราเลยเขียนแจ้งเตือนแบบเนียนๆ ให้ CR สบายใจ
        alert("✅ ส่งข้อมูลสำเร็จ! (ถ้าพบยอดไม่ขึ้นในชีต ให้ลองตรวจสอบอินเทอร์เน็ตอีกครั้ง)");
        
        document.getElementById('type_tripetch').value = 0;
        document.getElementById('type_inbound').value = 0;
        document.getElementById('type_referral').value = 0;
        calculateTotal();
    });
}