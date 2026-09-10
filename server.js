const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists on Render
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Middleware Configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Connect to Render PostgreSQL database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Database Setup Tables
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255),
                dob VARCHAR(50),
                gender VARCHAR(20),
                email VARCHAR(255),
                phone VARCHAR(50),
                area_involvement VARCHAR(255),
                skills TEXT,
                supporting_doc VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Pending'
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS item_donations (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                items_description TEXT,
                category VARCHAR(100),
                preferred_date VARCHAR(50),
                preferred_time VARCHAR(50),
                dropoff_location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Pending'
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS money_donations (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                amount NUMERIC(10,2),
                payment_method VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Pending'
            )
        `);

        console.log("PostgreSQL Database connected and initialized successfully.");
    } catch (err) {
        console.error("Database initialization error:", err);
    }
}

initDB();

// --- API ROUTES ---

// 1. Submit Membership Application
app.post('/api/applications', upload.single('supporting_doc'), async (req, res) => {
    try {
        const { full_name, dob, gender, email, phone, area_involvement, skills } = req.body;
        const supporting_doc = req.file ? req.file.filename : null;
        
        const query = `
            INSERT INTO applications (full_name, dob, gender, email, phone, area_involvement, skills, supporting_doc) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `;
        const result = await pool.query(query, [full_name, dob, gender, email, phone, area_involvement, skills, supporting_doc]);
        
        res.json({ message: 'Application submitted successfully!', id: result.rows[0].id });
    } catch (err) {
        console.error('Error saving application:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Submit Item Donation
app.post('/api/donations/items', async (req, res) => {
    try {
        const { full_name, email, phone, items_description, category, preferred_date, preferred_time, dropoff_location } = req.body;
        
        const query = `
            INSERT INTO item_donations (full_name, email, phone, items_description, category, preferred_date, preferred_time, dropoff_location) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `;
        const result = await pool.query(query, [full_name, email, phone, items_description, category, preferred_date, preferred_time, dropoff_location]);
        
        res.json({ message: 'Item donation pledged successfully!', id: result.rows[0].id });
    } catch (err) {
        console.error('Error saving item donation:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Submit Money Donation
app.post('/api/donations/money', async (req, res) => {
    try {
        const { full_name, email, phone, amount, payment_method } = req.body;

        const query = `
            INSERT INTO money_donations (full_name, email, phone, amount, payment_method) 
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `;
        const result = await pool.query(query, [full_name, email, phone, amount, payment_method]);
        
        res.json({ message: 'Donation details logged. Please proceed with payment below.', id: result.rows[0].id });
    } catch (err) {
        console.error('Error saving money donation:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN & AUXILIARY ROUTES ---

app.get('/api/admin/applications', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM applications ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/donations', async (req, res) => {
    try {
        const itemRows = await pool.query(`SELECT * FROM item_donations ORDER BY id DESC`);
        const moneyRows = await pool.query(`SELECT * FROM money_donations ORDER BY id DESC`);
        res.json({ items: itemRows.rows, money: moneyRows.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/qr', async (req, res) => {
    try {
        const qrImage = await QRCode.toDataURL('https://gpg26-reg-2.onrender.com');
        res.json({ qr: qrImage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/applications/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query(`UPDATE applications SET status = $1 WHERE id = $2`, [status, req.params.id]);
        res.json({ message: `Applicant status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/donations/items/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query(`UPDATE item_donations SET status = $1 WHERE id = $2`, [status, req.params.id]);
        res.json({ message: `Donation status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Girls of Purpose Ghana Portal running on port ${PORT}`);
});