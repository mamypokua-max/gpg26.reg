const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware & File Upload Configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Database Connection
const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

// Database Setup Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        dob TEXT,
        gender TEXT,
        email TEXT,
        phone TEXT,
        area_involvement TEXT,
        skills TEXT,
        supporting_doc TEXT,
        status TEXT DEFAULT 'Pending'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS item_donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        email TEXT,
        phone TEXT,
        items_description TEXT,
        category TEXT,
        preferred_date TEXT,
        preferred_time TEXT,
        dropoff_location TEXT,
        status TEXT DEFAULT 'Pending'
    )`);
});

// Routes
app.post('/api/apply', upload.single('supporting_doc'), (req, res) => {
    const { full_name, dob, gender, email, phone, area_involvement, skills } = req.body;
    const supporting_doc = req.file ? req.file.filename : null;
    
    const query = `INSERT INTO applications (full_name, dob, gender, email, phone, area_involvement, skills, supporting_doc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [full_name, dob, gender, email, phone, area_involvement, skills, supporting_doc], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Application submitted successfully!', id: this.lastID });
    });
});

app.post('/api/donate/item', (req, res) => {
    const { full_name, email, phone, items_description, category, preferred_date, preferred_time, dropoff_location } = req.body;
    
    const query = `INSERT INTO item_donations (full_name, email, phone, items_description, category, preferred_date, preferred_time, dropoff_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [full_name, email, phone, items_description, category, preferred_date, preferred_time, dropoff_location], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Item donation pledged successfully!', id: this.lastID });
    });
});

app.get('/api/admin/applications', (req, res) => {
    db.all(`SELECT * FROM applications ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/donations', (req, res) => {
    db.all(`SELECT * FROM item_donations ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ items: rows });
    });
});

app.get('/api/qr', async (req, res) => {
    try {
        const qrImage = await QRCode.toDataURL('http://localhost:5000');
        res.json({ qr: qrImage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/applications/:id/status', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE applications SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Applicant status updated to ${status}` });
    });
});

app.patch('/api/admin/donations/items/:id/status', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE item_donations SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Donation status updated to ${status}` });
    });
});

app.listen(PORT, () => {
    console.log(`Girls of Purpose Ghana Portal running at http://localhost:${PORT}`);
});