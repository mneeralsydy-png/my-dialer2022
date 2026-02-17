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
const port = 5000; 

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// --- Firebase Init ---
let db;
try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        const serviceAccount = {
            "type": "service_account",
            "project_id": process.env.FIREBASE_PROJECT_ID,
            "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            "client_email": process.env.FIREBASE_CLIENT_EMAIL,
        };
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("✅ Firebase Admin Connected via separate env vars");
        db = admin.firestore();
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("✅ Firebase Admin Connected via full JSON var");
        db = admin.firestore();
    } else {
        admin.initializeApp({ projectId: "call-now-24582" });
        db = admin.firestore();
        console.log("⚠️ Operating in fallback mode");
    }
} catch (e) {
    console.error("❌ Firebase failure:", e.message);
}

// 1. Token Generation
app.get('/token', (req, res) => {
  const identity = req.query.identity || 'user_' + Math.floor(Math.random() * 1000);
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) {
      return res.status(500).json({ error: "Twilio credentials not configured" });
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
    res.json({ token: accessToken.toJwt(), identity: identity });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const userData = userDoc.data();
    const cost = 0.05;
    if (userData.balance < cost) return res.status(400).json({ error: 'Insufficient balance' });
    const message = await twilioClient.messages.create({ body: body, from: process.env.TWILIO_PHONE_NUMBER, to: to });
    await db.collection('users').doc(userUid).update({
      balance: admin.firestore.FieldValue.increment(-cost),
      transactions: admin.firestore.FieldValue.arrayUnion({ type: 'SMS', amount: -cost, date: new Date().toISOString() })
    });
    res.json({ success: true, sid: message.sid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update Balance
app.post('/update-balance', async (req, res) => {
    const { userUid, amount, paymentId } = req.body;
    try {
        const userRef = db.collection('users').doc(userUid);
        await userRef.update({
            balance: admin.firestore.FieldValue.increment(parseFloat(amount)),
            transactions: admin.firestore.FieldValue.arrayUnion({
                type: 'Top-up', amount: parseFloat(amount), paymentId: paymentId || 'manual', date: new Date().toISOString()
            })
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port: ${port}`);
});