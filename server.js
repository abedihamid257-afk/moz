const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '5879';
const MAX_ITEMS = 20;
const MAX_MESSAGES = 50;
const DATA_FILE = path.join(__dirname, 'data.json');
const CHAT_FILE = path.join(__dirname, 'chat.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.use(express.json());

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadJSON(file, fallback = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback));
    return fallback;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

function checkAdmin(req, res, next) {
  const password = req.headers['x-admin-password'] || req.query.password;
  if (password === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'رمز اشتباه است' });
}

// --- فایل‌ها ---
app.get('/api/files', (req, res) => res.json(loadJSON(DATA_FILE)));

app.post('/api/upload', checkAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایلی ارسال نشد' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  let type = 'file';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) type = 'image';
  else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'].includes(ext)) type = 'audio';
  else if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) type = 'video';

  const newItem = {
    id: Date.now().toString(),
    originalName: req.file.originalname,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    type, size: req.file.size,
    uploadedAt: new Date().toISOString()
  };

  let data = loadJSON(DATA_FILE);
  data.unshift(newItem);

  if (data.length > MAX_ITEMS) {
    const removed = data.slice(MAX_ITEMS);
    data = data.slice(0, MAX_ITEMS);
    removed.forEach(item => {
      const fp = path.join(UPLOAD_DIR, item.filename);
      if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) {}
    });
  }

  saveJSON(DATA_FILE, data);
  res.json({ message: 'آپلود شد', file: newItem });
});

app.delete('/api/files/:id', checkAdmin, (req, res) => {
  const id = req.params.id;
  let data = loadJSON(DATA_FILE);
  const item = data.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'یافت نشد' });

  const fp = path.join(UPLOAD_DIR, item.filename);
  if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) {}

  data = data.filter(i => i.id !== id);
  saveJSON(DATA_FILE, data);
  res.json({ message: 'حذف شد' });
});

app.delete('/api/all', checkAdmin, (req, res) => {
  const data = loadJSON(DATA_FILE);
  data.forEach(item => {
    const fp = path.join(UPLOAD_DIR, item.filename);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) {}
  });
  saveJSON(DATA_FILE, []);
  res.json({ message: 'همه پاک شد' });
});

// --- چت ---
app.get('/api/chat', (req, res) => res.json(loadJSON(CHAT_FILE)));

app.post('/api/chat', (req, res) => {
  const { name, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: 'نام و پیام لازمه' });
  if (name.length > 30 || message.length > 300) {
    return res.status(400).json({ error: 'طول نام یا پیام زیاد است' });
  }

  const msg = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    message: message.trim(),
    at: new Date().toISOString()
  };

  let chat = loadJSON(CHAT_FILE);
  chat.push(msg);
  if (chat.length > MAX_MESSAGES) chat = chat.slice(-MAX_MESSAGES);
  saveJSON(CHAT_FILE, chat);

  res.json({ message: 'ارسال شد', msg });
});

app.delete('/api/chat', checkAdmin, (req, res) => {
  saveJSON(CHAT_FILE, []);
  res.json({ message: 'چت پاک شد' });
});

app.listen(PORT, () => console.log(`🍌 موز کده روی پورت ${PORT}`));
