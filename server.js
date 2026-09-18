const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- تنظیمات ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '5879';
const MAX_ITEMS = 20; // حداکثر تعداد محتوا
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// --- اطمینان از وجود پوشه uploads ---
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- توابع مدیریت دیتابیس JSON ---
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- میدل‌ورها ---
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// --- تنظیمات Multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // ۲۰ مگابایت
});

// --- میدل‌ور بررسی رمز ادمین ---
function checkAdmin(req, res, next) {
  const password = req.headers['x-admin-password'] || req.query.password;
  if (password === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'رمز اشتباه است' });
}

// --- API: دریافت لیست محتوا (عمومی) ---
app.get('/api/files', (req, res) => {
  const data = loadData();
  res.json(data);
});

// --- API: آپلود فایل (فقط ادمین) ---
app.post('/api/upload', checkAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایلی ارسال نشد' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let type = 'file';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) type = 'image';
  else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) type = 'audio';
  else if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) type = 'video';

  const newItem = {
    id: Date.now().toString(),
    originalName: req.file.originalname,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    type: type,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  };

  let data = loadData();
  data.unshift(newItem); // جدیدترین اول لیست

  // --- محدودیت ۲۰ محتوا: حذف قدیمی‌ترین‌ها ---
  if (data.length > MAX_ITEMS) {
    const removed = data.slice(MAX_ITEMS); // آیتم‌های اضافی
    data = data.slice(0, MAX_ITEMS);
    
    // حذف فایل‌های فیزیکی قدیمی
    removed.forEach(item => {
      const filePath = path.join(UPLOAD_DIR, item.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    });
  }

  saveData(data);
  res.json({ message: 'آپلود شد', file: newItem });
});

// --- API: حذف فایل (فقط ادمین) ---
app.delete('/api/files/:id', checkAdmin, (req, res) => {
  const id = req.params.id;
  let data = loadData();
  const item = data.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'یافت نشد' });
  }

  // حذف فایل فیزیکی
  const filePath = path.join(UPLOAD_DIR, item.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }

  // حذف از دیتابیس
  data = data.filter(i => i.id !== id);
  saveData(data);

  res.json({ message: 'حذف شد' });
});

// --- API: پاک کردن همه (فقط ادمین) ---
app.delete('/api/all', checkAdmin, (req, res) => {
  const data = loadData();
  data.forEach(item => {
    const filePath = path.join(UPLOAD_DIR, item.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  });
  saveData([]);
  res.json({ message: 'همه پاک شد' });
});

app.listen(PORT, () => {
  console.log(`🍌 موز کده روی پورت ${PORT} اجرا شد`);
});
