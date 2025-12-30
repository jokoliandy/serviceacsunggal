import express from "express";
import path from "path";
import fs from "fs";
import session from "express-session";
import { fileURLToPath } from "url";

/* ================== BASIC SETUP ================== */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "data", "availability.json");
const USERS_FILE = path.join(__dirname, "data", "users.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const PRIVATE_DIR = path.join(__dirname, "private");

/* ================== SESSION ================== */
app.use(
  session({
    name: "ac_session",
    secret: process.env.SESSION_SECRET || "ac-secret-super-panjang",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

/* ================== FILE HELPERS ================== */
function ensureFile(file, def) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
}

function readUsers() {
  ensureFile(USERS_FILE, {
    users: [{ id: "u_master", username: "admin", password: "joko", role: "master" }]
  });
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Normalisasi data supaya aman walau file lama masih string:
 * days[date] bisa "available"/"full"/"closed" (string)
 * atau object { status, jobs }
 */
function normalizeData(raw) {
  const out = { days: {} };
  const days = raw?.days || {};

  for (const [date, val] of Object.entries(days)) {
    // format lama: string
    if (typeof val === "string") {
      const status = val === "full" ? "full" : val === "closed" ? "closed" : "available";
      out.days[date] = { status, jobs: [] };
      continue;
    }

    // format baru: object
    if (val && typeof val === "object") {
      const status = val.status === "full" ? "full" : val.status === "closed" ? "closed" : "available";
      const jobs = Array.isArray(val.jobs) ? val.jobs : [];
      out.days[date] = {
        status,
        jobs: jobs.map(j => ({
          id: j.id || `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          namaClient: String(j.namaClient || ""),
          alamat: String(j.alamat || ""),
          kendala: String(j.kendala || ""),
          createdAt: j.createdAt || new Date().toISOString(),
          done: Boolean(j.done),
          doneAt: j.doneAt || null,
          doneBy: j.doneBy || null
        }))
      };
    }
  }

  return out;
}

function readData() {
  ensureFile(DATA_FILE, { days: {} });
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  return normalizeData(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================== DATE HELPERS ================== */
const pad2 = n => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const isValidDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const isValidMonth = m => /^\d{4}-\d{2}$/.test(String(m || ""));

function monthAvailability(month) {
  const data = readData();
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const today = todayISO();
  const out = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad2(m)}-${pad2(d)}`;

    // tanggal lewat: tampil completed (UI)
    if (iso < today) {
      out[iso] = "completed";
      continue;
    }

    out[iso] = data.days?.[iso]?.status || "available";
  }

  return out;
}

/* ================== AUTH MIDDLEWARE ================== */
// PAGES: redirect ke login.html
function requireRolePage(role) {
  return (req, res, next) => {
    if (!req.session?.user) return res.redirect("/login.html");
    if (req.session.user.role !== role) return res.status(403).send("Forbidden");
    next();
  };
}

// API: balikin JSON
function requireRoleApi(role) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: "unauthorized" });
    if (req.session.user.role !== role) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

/* ================== STATIC ================== */
app.use(express.static(PUBLIC_DIR));

// ================== PUBLIC PAGE (JADWAL) ==================
app.get("/jadwal", (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, "schedule-public.html"));
});

// (opsional) alias kalau kamu pernah pakai /schedule
app.get("/schedule", (req, res) => {
  return res.redirect("/jadwal");
});


/* ================== DEBUG ================== */
app.get("/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});

/* ================== LOGIN / LOGOUT ================== */
app.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "").trim();

  const db = readUsers();
  const user = db.users.find(u => u.username === username);

  if (!user || user.password !== password) return res.redirect("/login.html");

  req.session.user = {
  id: user.id,
  username: user.username,
  role: user.role,
  name: user.name || user.username   // ✅ ini yang bikin "Halo Nama"
};

  return res.redirect(user.role === "master" ? "/admin" : "/staff");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("ac_session");
    res.redirect("/login.html");
  });
});


/* ================== PUBLIC ROUTES ================== */
/**
 * ✅ INI yang bikin /jadwal bisa dibuka
 * Pastikan file ada di: public/schedule-public.html
 */
app.get("/jadwal", (req, res) => {
  const fp = path.join(PUBLIC_DIR, "schedule-public.html");
  if (!fs.existsSync(fp)) return res.status(404).send(`File tidak ditemukan: ${fp}`);
  return res.sendFile(fp);
});

/* ================== PAGES (PRIVATE) ================== */
function sendPrivate(res, filename) {
  const fp = path.join(PRIVATE_DIR, filename);
  if (!fs.existsSync(fp)) return res.status(404).send(`File tidak ditemukan: ${fp}`);
  return res.sendFile(fp);
}

// MASTER
app.get("/admin", requireRolePage("master"), (req, res) => sendPrivate(res, "dashboard.html"));
app.get("/admin/atur", requireRolePage("master"), (req, res) => sendPrivate(res, "admin.html"));
app.get("/admin/jadwal", requireRolePage("master"), (req, res) => sendPrivate(res, "schedule.html"));
app.get("/admin/catatan", requireRolePage("master"), (req, res) => sendPrivate(res, "catatan.html"));
app.get("/admin/users", requireRolePage("master"), (req, res) => sendPrivate(res, "users.html"));
app.get("/admin/bulanan", requireRolePage("master"), (req, res) => sendPrivate(res, "bulanan.html"));

// STAFF
app.get("/staff", requireRolePage("staff"), (req, res) => sendPrivate(res, "staff-dashboard.html"));
app.get("/staff/jadwal", requireRolePage("staff"), (req, res) => sendPrivate(res, "staff-jadwal.html"));
app.get("/staff/catatan", requireRolePage("staff"), (req, res) => sendPrivate(res, "staff-catatan.html"));
app.get("/staff/catatan/detail", requireRolePage("staff"), (req, res) =>
  sendPrivate(res, "staff-catatan-detail.html")
);

/* ================== API PUBLIC ================== */
app.get("/api/public/availability", (req, res) => {
  const month = String(req.query.month || "");
  if (!isValidMonth(month)) return res.status(400).json({ error: "month harus YYYY-MM" });
  res.json({ month, days: monthAvailability(month) });
});

/* ================== API STAFF ================== */
app.get("/api/staff/availability", requireRoleApi("staff"), (req, res) => {
  const month = String(req.query.month || "");
  if (!isValidMonth(month)) return res.status(400).json({ error: "month harus YYYY-MM" });
  res.json({ month, days: monthAvailability(month) });
});

// tanggal yang punya jobs
app.get("/api/staff/notes-dates", requireRoleApi("staff"), (req, res) => {
  const data = readData();
  const dates = Object.entries(data.days || {})
    .filter(([_, v]) => Array.isArray(v.jobs) && v.jobs.length > 0)
    .map(([date, v]) => ({
      date,
      total: v.jobs.length,
      done: v.jobs.filter(j => j.done).length
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  res.json({ dates });
});

// detail jobs per tanggal
app.get("/api/staff/day", requireRoleApi("staff"), (req, res) => {
  const date = String(req.query.date || "");
  if (!isValidDate(date)) return res.status(400).json({ error: "date harus YYYY-MM-DD" });

  const data = readData();
  const day = data.days?.[date] || { status: "available", jobs: [] };
  res.json({ date, status: day.status, jobs: day.jobs });
});

// staff set done
app.post("/api/staff/job/done", requireRoleApi("staff"), (req, res) => {
  const date = String(req.body.date || "");
  const id = String(req.body.id || "");
  if (!isValidDate(date) || !id) return res.status(400).json({ error: "butuh date & id" });

  const data = readData();
  const day = data.days?.[date];
  if (!day) return res.status(404).json({ error: "tanggal tidak ditemukan" });

  const job = (day.jobs || []).find(j => j.id === id);
  if (!job) return res.status(404).json({ error: "job tidak ditemukan" });

  job.done = true;
  job.doneAt = new Date().toISOString();
  job.doneBy = req.session.user.username;

  writeData(data);
  res.json({ ok: true, job });
});

/* ================== API MASTER ================== */
app.get("/api/admin/availability", requireRoleApi("master"), (req, res) => {
  const month = String(req.query.month || "");
  if (!isValidMonth(month)) return res.status(400).json({ error: "month harus YYYY-MM" });
  res.json({ month, days: monthAvailability(month) });
});

// ✅ admin load catatan per tanggal
app.get("/api/admin/day", requireRoleApi("master"), (req, res) => {
  const date = String(req.query.date || "");
  if (!isValidDate(date)) return res.status(400).json({ error: "date harus YYYY-MM-DD" });

  const data = readData();
  const day = data.days?.[date] || { status: "available", jobs: [] };
  res.json({ date, status: day.status, jobs: day.jobs });
});

// update status admin
app.post("/api/admin/day/status", requireRoleApi("master"), (req, res) => {
  const date = String(req.body.date || "");
  const status = String(req.body.status || "");
  if (!isValidDate(date)) return res.status(400).json({ error: "date harus YYYY-MM-DD" });

  const allowed = new Set(["available", "full", "closed"]);
  if (!allowed.has(status)) return res.status(400).json({ error: "status harus available|full|closed" });

  // optional: larang edit tanggal lewat
  if (date < todayISO()) {
    return res.status(400).json({ error: "Tanggal sudah lewat (completed), tidak bisa diubah." });
  }

  const data = readData();
  data.days[date] = data.days[date] || { status: "available", jobs: [] };
  data.days[date].status = status;
  writeData(data);

  res.json({ ok: true, date, status });
});

// tambah job admin
app.post("/api/admin/day/job", requireRoleApi("master"), (req, res) => {
  const date = String(req.body.date || "");
  const namaClient = String(req.body.namaClient || "").trim();
  const alamat = String(req.body.alamat || "").trim();
  const kendala = String(req.body.kendala || "").trim();

  if (!isValidDate(date)) return res.status(400).json({ error: "date harus YYYY-MM-DD" });
  if (!namaClient || !alamat || !kendala) {
    return res.status(400).json({ error: "namaClient, alamat, kendala wajib" });
  }

  const data = readData();
  data.days[date] = data.days[date] || { status: "available", jobs: [] };

  const job = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    namaClient,
    alamat,
    kendala,
    createdAt: new Date().toISOString(),
    done: false,
    doneAt: null,
    doneBy: null
  };

  data.days[date].jobs.unshift(job);
  writeData(data);

  res.json({ ok: true, job });
});

// hapus job admin
app.delete("/api/admin/day/job", requireRoleApi("master"), (req, res) => {
  const date = String(req.query.date || "");
  const id = String(req.query.id || "");
  if (!isValidDate(date) || !id) return res.status(400).json({ error: "butuh date & id" });

  const data = readData();
  const day = data.days?.[date];
  if (!day) return res.json({ ok: true });

  day.jobs = (day.jobs || []).filter(j => j.id !== id);
  writeData(data);
  res.json({ ok: true });
});

// manage staff users
app.get("/api/admin/users", requireRoleApi("master"), (req, res) => {
  const db = readUsers();
  res.json({ users: db.users.map(u => ({ id: u.id, username: u.username, role: u.role })) });
});

app.post("/api/admin/users", requireRoleApi("master"), (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "").trim();
  if (!username || !password) return res.status(400).json({ error: "username & password wajib" });

  const db = readUsers();
  if (db.users.some(u => u.username === username)) return res.status(400).json({ error: "username sudah ada" });

  db.users.push({ id: `u_${Date.now()}`, username, password, role: "staff" });
  writeUsers(db);
  res.json({ ok: true });
});

// hapus staff user
app.delete("/api/admin/users", requireRoleApi("master"), (req, res) => {
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "butuh id" });

  const db = readUsers();

  // optional: larang hapus akun master
  const target = db.users.find(u => u.id === id);
  if (!target) return res.json({ ok: true });

  if (target.role === "master") {
    return res.status(400).json({ error: "akun master tidak boleh dihapus" });
  }

  db.users = db.users.filter(u => u.id !== id);
  writeUsers(db);

  res.json({ ok: true });
});

// rekap semua catatan (Bulanan)
app.get("/api/admin/jobs-all", requireRoleApi("master"), (req, res) => {
  const statusFilter = String(req.query.status || "all"); // all | pending | done
  const data = readData();
  const out = [];

  for (const [date, day] of Object.entries(data.days || {})) {
    const jobs = Array.isArray(day.jobs) ? day.jobs : [];
    if (jobs.length === 0) continue;

    const filtered = jobs.filter(j => {
      if (statusFilter === "done") return Boolean(j.done);
      if (statusFilter === "pending") return !Boolean(j.done);
      return true;
    });
    if (filtered.length === 0) continue;

    out.push({
      date,
      status: day.status || "available",
      total: jobs.length,
      doneCount: jobs.filter(j => j.done).length,
      jobs: filtered
    });
  }

  out.sort((a, b) => b.date.localeCompare(a.date));
  res.json({ statusFilter, dates: out });
});

/* ================== START ================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Running on http://localhost:${PORT}`));
