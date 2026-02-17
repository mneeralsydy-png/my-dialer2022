require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
// Render يستخدم المنفذ 10000 تلقائياً
const port = 5000; 

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// --- Firebase Init (التعديل الجديد) ---
let db;
try {
    // الطريقة الأفضل: بناء الكائن يدوياً من متغيرات منفصلة
    // تأكد من ضبط هذه المتغيرات الثلاثة في Render
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        
        const serviceAccount = {
            "type": "service_account",
            "project_id": process.env.FIREBASE_PROJECT_ID,
            "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID, // اختياري
            "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // معالجة الأسطر هنا فقط
            "client_email": process.env.FIREBASE_CLIENT_EMAIL,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        console.log("✅ Firebase Admin Connected successfully via Separate Env Vars");
        db = admin.firestore();

    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // دعم الطريقة القديمة (JSON كامل) كاحتياط، لكن بدون استبدال الأسطر قبل البارس
        // يجب أن يكون المتغير في Missing عبارة عن سطر واحد مضغوط (Minified JSON)
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("✅ Firebase Admin Connected via Full JSON Var");
        db = admin.firestore();
    } else {
        throw new Error("Missing Firebase Credentials");
    }

} catch (e) {
    console.error("❌ Firebase Admin failure:", e.message);
    // المحاولة الأخيرة باستخدام معرف المشروع فقط
    try {
        if (!admin.apps.length) {
            admin.initializeApp({ projectId: "call-now-24582" }); // تأكد من أن هذا المعرف صحيح
        }
        db = admin.firestore();
        console.log("⚠️ Operating with limited Firebase (Fallback mode)");
    } catch (err) {
        console.error("Critical: Could not initialize Firebase at all.");
    }
    }
// Token1. Token Generation
app.get('/token', (req, res) => {
identityidentity = req.query.identity || 'user_' + Math.floor(Math.random() * 1000);

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) {
      return res.status(500).send({ error: "Twilio credentials not configured" });
  }

  try {
    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: identity }
    );

    const grant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_APP_SID,
      incomingAllow: true,
    });

    accessToken.addGrant(grant);
    res.send({ token: accessToken.toJwt(), identity: identity });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// 2. Voice Webhook
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const to = req.body.To;
  if (to) {
    const dial = twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER });
    if (/^[\d\+\-\(\) ]+$/.test(to)) { dial.number(to); } else { dial.client(to); }
  } else {
    twiml.say({ language: 'ar-SA' }, 'مرحباً، لم يتم استلام رقم للاتصال به.');
  }
  res.type('text/xml');
  res.send(twiml.toString());
});

// 3. SMS
app.post('/send-sms', async (req, res) => {
  const { to, body, userUid } = req.body;
  const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    const userDoc = await db.collection('users').doc(userUid).get();
    if (!userDoc.exists) return res.status(404).send('User not found');
    const userData = userDoc.data();
    const cost = 0.05;
    if (userData.balance < cost) return res.status(400).send('Insufficient balance');

    const message = await twilioClient.messages.create({ body: body, from: process.env.TWILIO_PHONE_NUMBER, to: to });
    await db.collection('users').doc(userUid).update({
      balance: admin.firestore.FieldValue.increment(-cost),
      transactions: admin.firestore.FieldValue.arrayUnion({ type: 'SMS', amount: -cost, date: new Date().toISOString() })
    });
    res.send({ success: true, sid: message.sid });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
