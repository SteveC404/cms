require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mssql = require('mssql');

const app = express();
const upload = multer({ dest: process.env.UPLOAD_DIR || 'uploads/' });

// MSSQL config
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        trustServerCertificate: true
    }
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Helper: get initials
function getInitials(first, last) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
}

// Helper: get user by email
async function getUserByEmail(email) {
    const pool = await mssql.connect(dbConfig);
    const result = await pool.request()
        .input('email', mssql.NVarChar, email)
        .query('SELECT * FROM Users WHERE Email = @email');
    return result.recordset[0];
}

// Helper: update user password
async function updateUserPassword(id, hash, updatedBy) {
    const pool = await mssql.connect(dbConfig);
    await pool.request()
        .input('id', mssql.Int, id)
        .input('password', mssql.NVarChar, hash)
        .input('updatedBy', mssql.NVarChar, updatedBy)
        .input('updatedDate', mssql.DateTime, new Date())
        .query('UPDATE Users SET Password = @password, UpdatedBy = @updatedBy, UpdatedDate = @updatedDate WHERE Id = @id');
}

// Login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login handler
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.Active) return res.status(403).json({ error: 'Your account has been disabled.' });
    if (!user.Password) return res.json({ changePassword: true, userId: user.Id });
    const match = await bcrypt.compare(password, user.Password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });
    req.session.user = { id: user.Id, email: user.Email, name: user.FirstName + ' ' + user.LastName, photo: user.Photo };
    res.json({ success: true });
});

// Change password (first login)
app.post('/change-password', async (req, res) => {
    const { userId, password, password2 } = req.body;
    if (!password || password !== password2) return res.status(400).json({ error: 'Passwords do not match.' });
    const hash = await bcrypt.hash(password, 10);
    await updateUserPassword(userId, hash, 'self');
    res.json({ success: true });
});

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).redirect('/');
    next();
}

// Home page after login
app.get('/home', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Get current user profile
app.get('/api/profile', requireAuth, async (req, res) => {
    const user = await getUserByEmail(req.session.user.email);
    res.json(user);
});

// Update user profile
app.post('/api/profile', requireAuth, upload.single('photo'), async (req, res) => {
    const { FirstName, LastName, Comments, Active, Password, Password2 } = req.body;
    const photo = req.file ? req.file.filename : null;
    const pool = await mssql.connect(dbConfig);
    let updateFields = 'FirstName = @FirstName, LastName = @LastName, Comments = @Comments, Active = @Active';
    let params = [
        { name: 'FirstName', type: mssql.NVarChar, value: FirstName },
        { name: 'LastName', type: mssql.NVarChar, value: LastName },
        { name: 'Comments', type: mssql.NVarChar, value: Comments },
        { name: 'Active', type: mssql.Bit, value: Active === 'true' ? 1 : 0 },
        { name: 'UpdatedBy', type: mssql.NVarChar, value: req.session.user.email },
        { name: 'UpdatedDate', type: mssql.DateTime, value: new Date() },
        { name: 'Id', type: mssql.Int, value: req.session.user.id }
    ];
    if (photo) {
        updateFields += ', Photo = @Photo';
        params.push({ name: 'Photo', type: mssql.NVarChar, value: photo });
    }
    if (Password && Password === Password2) {
        const hash = await bcrypt.hash(Password, 10);
        updateFields += ', Password = @Password';
        params.push({ name: 'Password', type: mssql.NVarChar, value: hash });
    }
    let request = pool.request();
    params.forEach(p => request.input(p.name, p.type, p.value));
    await request.query(`UPDATE Users SET ${updateFields}, UpdatedBy = @UpdatedBy, UpdatedDate = @UpdatedDate WHERE Id = @Id`);
    res.json({ success: true });
});

// List users
app.get('/api/users', requireAuth, async (req, res) => {
    const pool = await mssql.connect(dbConfig);
    const result = await pool.request().query('SELECT Id, FirstName, LastName, Email, Active FROM Users');
    res.json(result.recordset);
});

// List clients
app.get('/api/clients', requireAuth, async (req, res) => {
    const pool = await mssql.connect(dbConfig);
    const result = await pool.request().query('SELECT Id, FirstName, LastName, Email, Active FROM Clients');
    res.json(result.recordset);
});

// Get user details
app.get('/api/users/:id', requireAuth, async (req, res) => {
    const pool = await mssql.connect(dbConfig);
    const result = await pool.request().input('id', mssql.Int, req.params.id).query('SELECT * FROM Users WHERE Id = @id');
    res.json(result.recordset[0]);
});

// Get client details
app.get('/api/clients/:id', requireAuth, async (req, res) => {
    const pool = await mssql.connect(dbConfig);
    const result = await pool.request().input('id', mssql.Int, req.params.id).query('SELECT * FROM Clients WHERE Id = @id');
    res.json(result.recordset[0]);
});

// Update user details
app.post('/api/users/:id', requireAuth, upload.single('photo'), async (req, res) => {
    const { FirstName, LastName, Comments, Active, Password, Password2 } = req.body;
    const photo = req.file ? req.file.filename : null;
    const pool = await mssql.connect(dbConfig);
    let updateFields = 'FirstName = @FirstName, LastName = @LastName, Comments = @Comments, Active = @Active';
    let params = [
        { name: 'FirstName', type: mssql.NVarChar, value: FirstName },
        { name: 'LastName', type: mssql.NVarChar, value: LastName },
        { name: 'Comments', type: mssql.NVarChar, value: Comments },
        { name: 'Active', type: mssql.Bit, value: Active === 'true' ? 1 : 0 },
        { name: 'UpdatedBy', type: mssql.NVarChar, value: req.session.user.email },
        { name: 'UpdatedDate', type: mssql.DateTime, value: new Date() },
        { name: 'Id', type: mssql.Int, value: req.params.id }
    ];
    if (photo) {
        updateFields += ', Photo = @Photo';
        params.push({ name: 'Photo', type: mssql.NVarChar, value: photo });
    }
    if (Password && Password === Password2) {
        const hash = await bcrypt.hash(Password, 10);
        updateFields += ', Password = @Password';
        params.push({ name: 'Password', type: mssql.NVarChar, value: hash });
    }
    let request = pool.request();
    params.forEach(p => request.input(p.name, p.type, p.value));
    await request.query(`UPDATE Users SET ${updateFields}, UpdatedBy = @UpdatedBy, UpdatedDate = @UpdatedDate WHERE Id = @Id`);
    res.json({ success: true });
});

// Update client details
app.post('/api/clients/:id', requireAuth, upload.single('photo'), async (req, res) => {
    const { FirstName, LastName, Comments, Active, Phone, Address, City, State, Zip, Country, DateOfBirth, Gender, Password, Password2 } = req.body;
    const photo = req.file ? req.file.filename : null;
    const pool = await mssql.connect(dbConfig);
    let updateFields = 'FirstName = @FirstName, LastName = @LastName, Comments = @Comments, Active = @Active, Phone = @Phone, Address = @Address, City = @City, State = @State, Zip = @Zip, Country = @Country, DateOfBirth = @DateOfBirth, Gender = @Gender';
    let params = [
        { name: 'FirstName', type: mssql.NVarChar, value: FirstName },
        { name: 'LastName', type: mssql.NVarChar, value: LastName },
        { name: 'Comments', type: mssql.NVarChar, value: Comments },
        { name: 'Active', type: mssql.Bit, value: Active === 'true' ? 1 : 0 },
        { name: 'Phone', type: mssql.NVarChar, value: Phone },
        { name: 'Address', type: mssql.NVarChar, value: Address },
        { name: 'City', type: mssql.NVarChar, value: City },
        { name: 'State', type: mssql.NVarChar, value: State },
        { name: 'Zip', type: mssql.NVarChar, value: Zip },
        { name: 'Country', type: mssql.NVarChar, value: Country },
        { name: 'DateOfBirth', type: mssql.Date, value: DateOfBirth },
        { name: 'Gender', type: mssql.NVarChar, value: Gender },
        { name: 'UpdatedBy', type: mssql.NVarChar, value: req.session.user.email },
        { name: 'UpdatedDate', type: mssql.DateTime, value: new Date() },
        { name: 'Id', type: mssql.Int, value: req.params.id }
    ];
    if (photo) {
        updateFields += ', Photo = @Photo';
        params.push({ name: 'Photo', type: mssql.NVarChar, value: photo });
    }
    if (Password && Password === Password2) {
        const hash = await bcrypt.hash(Password, 10);
        updateFields += ', Password = @Password';
        params.push({ name: 'Password', type: mssql.NVarChar, value: hash });
    }
    let request = pool.request();
    params.forEach(p => request.input(p.name, p.type, p.value));
    await request.query(`UPDATE Clients SET ${updateFields}, UpdatedBy = @UpdatedBy, UpdatedDate = @UpdatedDate WHERE Id = @Id`);
    res.json({ success: true });
});

// Create new client
app.post('/api/clients', requireAuth, upload.single('photo'), async (req, res) => {
    const { FirstName, LastName, Email, Comments, Active, Phone, Address, City, State, Zip, Country, DateOfBirth, Gender, Password, Password2 } = req.body;
    if (!FirstName || !LastName || !Email) return res.status(400).json({ error: 'Required fields missing.' });
    if (Password !== Password2) return res.status(400).json({ error: 'Passwords do not match.' });
    const photo = req.file ? req.file.filename : null;
    const hash = Password ? await bcrypt.hash(Password, 10) : '';
    const pool = await mssql.connect(dbConfig);
    await pool.request()
        .input('FirstName', mssql.NVarChar, FirstName)
        .input('LastName', mssql.NVarChar, LastName)
        .input('Email', mssql.NVarChar, Email)
        .input('Photo', mssql.NVarChar, photo)
        .input('Active', mssql.Bit, Active === 'true' ? 1 : 0)
        .input('Comments', mssql.NVarChar, Comments)
        .input('Password', mssql.NVarChar, hash)
        .input('CreatedBy', mssql.NVarChar, req.session.user.email)
        .input('CreatedDate', mssql.DateTime, new Date())
        .input('Phone', mssql.NVarChar, Phone)
        .input('Address', mssql.NVarChar, Address)
        .input('City', mssql.NVarChar, City)
        .input('State', mssql.NVarChar, State)
        .input('Zip', mssql.NVarChar, Zip)
        .input('Country', mssql.NVarChar, Country)
        .input('DateOfBirth', mssql.Date, DateOfBirth)
        .input('Gender', mssql.NVarChar, Gender)
        .query('INSERT INTO Clients (FirstName, LastName, Email, Photo, Active, Comments, Password, CreatedBy, CreatedDate, Phone, Address, City, State, Zip, Country, DateOfBirth, Gender) VALUES (@FirstName, @LastName, @Email, @Photo, @Active, @Comments, @Password, @CreatedBy, @CreatedDate, @Phone, @Address, @City, @State, @Zip, @Country, @DateOfBirth, @Gender)');
    res.json({ success: true });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
