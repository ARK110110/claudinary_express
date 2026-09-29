import express from "express";
import connection from "../config/db/index.js";
import jwt from "jsonwebtoken";
import auth from "../src/middleware/auth.js";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import dot from "dotenv";
import cloudinary from "../config/db/cloudinary.js";
// import { v2 as cloudinary } from 'cloudinary';
import path from "path"
dot.config();

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use()

if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}
const DEFAULT_AVATAR = 'https://res.cloudinary.com/j3vazowg/image/upload/v1790433319/profile.jpg'

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post("/api/login", async (req, res) => {
  const { email, username } = req.body;

  // ngevalidasi data email password
  if (!req.body.username || !req.body.email || !req.body.password) {
    return res.status(400).json({
      message: "Login failed",
    });
  }

  // get user by email (query)
  const [result] = await connection.query(
    `
    select * from users where email = ? and username = ?`,
    [email, username],
  );

  // ngecompare password
  if (result[0].password != req.body.password) {
    return res.status(400).json({
      message: "Login gagal",
    });
  }

  // generate jwt
  const token = jwt.sign(
    {
      id: result[0].id,
      username: result[0].username,
      email: result[0].email
    },
    "KYKY",
    {expiresIn: "1d"}
  );

  // kirim jwt
  res.status(200).json({
    message: "Login Success",
    token: token,
  });
});

app.get("/api/users", auth, async (req, res) => {
  try {
    const [result] = await connection.query(`
    select * from users  
    `);
    res.status(200).json({
      message: "berhasil mengambil user",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      message: "gagal mengambil user",
    });
  }
});

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username && !email && !password) {
      res.status(400).json({
        message: "Username, email, atau password belum di isi",
      });
    }
    const [result] = await connection.query(
      `
      insert into users(username, email, password)
      values
      (?, ?, ?);
      `,
      [username, email, password],
    );
    res.status(200).json({
      message: "Data berhasil di buat",
      data: result,
    });
  } catch (error) {
    console.log(error);
  }
});

// Endpoint POST /api/avatar
app.post('/api/avatar', upload.single('profile_picture'), async (req, res) => {
  try {
    const { userId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
    }

    // Gunakan public_id berdasarkan userId agar file lama tertimpa
    const publicId = `avatar_user_${userId}`;

    const cloudinaryResult = await cloudinary.uploader.upload(file.path, {
      public_id: publicId,
      folder: 'profile_pictures',
      overwrite: true,   // Timpa file lama jika public_id sama
      invalidate: true,  // Bersihkan cache CDN Cloudinary agar gambar langsung berubah
    });

    // Hapus file temporer dari folder "uploads" lokal
    fs.unlink(file.path, (err) => {
      if (err) console.error('Gagal menghapus file temporer:', err);
    });

    const secureUrl = cloudinaryResult.secure_url;

    // Update database MySQL/PostgreSQL
    const updateQuery = `UPDATE users SET avatar = ? WHERE id = ?`;
    await connection.query(updateQuery, [secureUrl, userId]);

    return res.status(200).json({
      success: true,
      message: 'Foto profil berhasil diperbarui.',
      data: { avatar: secureUrl },
    });
  } catch (error) {
    console.error('Upload Error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ success: false, message: 'Gagal memproses unggahan foto profil.' });
  }
});

// Endpoint RESET Avatar ke nilai kosong ("")
app.post('/api/avatar/reset', async (req, res) => {
  try {
    const { userId } = req.body;

    // Logika UPDATE users SET avatar = "" WHERE id = ?
    const query = `UPDATE users SET avatar = "" WHERE id = ?`;
    // await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      message: 'Avatar berhasil di-reset.',
      data: {
        avatar: DEFAULT_AVATAR,
      },
    });
  } catch (error) {
    console.error('Reset Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mereset foto profil.' });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const { id, username, email, avatar } = req.params;

    // Query untuk mengambil data user dari MySQL
    const query = `SELECT id, username, email, avatar FROM users WHERE id = ?`;
    
    // Contoh eksekusi query (jika menggunakan mysql2/promise):
    const [rows] = await connection.query(query, [id]);
    const user = rows[0];

    /* 
      Simulasi response dari database (ganti bagian ini dengan query database Anda):
    */
    // const user = {
    //   id: id,
    //   username: username,
    //   email: email,
    //   avatar: "", // Jika nilainya "" atau NULL dari DB, fallback diterapkan
    // };

    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    // Jika avatar di database kosong ("") atau NULL, kembalikan DEFAULT_AVATAR
    const avatarUrl = user.avatar && user.avatar.trim() !== '' ? user.avatar : DEFAULT_AVATAR;

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: avatarUrl,
      },
    });
  } catch (error) {
    console.error('Fetch User Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data user.' });
  }
});

app.listen(port, () => {
  console.log(`Contoh app mendengarkan di port ${port}`);
});