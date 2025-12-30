/* =========================================================
   Service AC Sunggal - app.js (FULL)
   - Public schedule
   - Admin preview
   - Admin edit (modal status + catatan)
   - Admin catatan pekerjaan page
   Notes:
   - All fetch use credentials: "include" for session/cookies (Render-ready)
   - All query params encoded
========================================================= */

function pad2(n){ return String(n).padStart(2,"0"); }
function monthStr(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function isoDate(y,m,day){ return `${y}-${pad2(m)}-${pad2(day)}`; }

function monthLabelID(dateObj){
  const bulan = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];
  return `${bulan[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

function firstDayIndexMonday(year, month1to12){
  const js = new Date(year, month1to12-1, 1);
  const dow = js.getDay(); // 0 Sun..6 Sat
  return (dow + 6) % 7; // Mon=0
}

function daysInMonth(year, month1to12){
  return new Date(year, month1to12, 0).getDate();
}

function statusLabel(status){
  if(status==="completed") return "Completed";
  if(status==="full") return "Penuh";
  if(status==="closed") return "Tutup";
  return "Tersedia";
}

function statusClass(status){
  // ini harus match CSS:
  // .status-available => hijau
  // .status-full => merah
  // .status-closed => abu
  // .status-completed => biru
  if(status==="completed") return "status-completed";
  if(status==="full") return "status-full";
  if(status==="closed") return "status-closed";
  return "status-available";
}

function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

// kalau tanggal < hari ini => completed (UI fallback)
function computedStatus(dateISO, storedStatus){
  const t = todayISO();
  if(dateISO < t) return "completed";
  return storedStatus || "available";
}

async function fetchJson(url, opts = {}){
  const res = await fetch(url, {
    credentials: "include",
    ...opts
  });

  if(!res.ok){
    // kadang API balikin HTML (redirect/login), kita ambil sedikit buat debug
    const text = await res.text().catch(()=> "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0,160)}`);
  }

  // aman kalau content-type bukan json
  const ct = res.headers.get("content-type") || "";
  if(!ct.includes("application/json")){
    const text = await res.text().catch(()=> "");
    throw new Error(`Response bukan JSON: ${text.slice(0,160)}`);
  }

  return res.json();
}

async function fetchMonthAvailability(month, mode){
  const url = mode === "admin"
    ? `/api/admin/availability?month=${encodeURIComponent(month)}`
    : `/api/public/availability?month=${encodeURIComponent(month)}`;

  return fetchJson(url);
}

function formatDDMMYYYY(iso){ // "2025-12-30" -> "30-12-2025"
  const [y,m,d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function dayNameID(iso){ // "2025-12-30" -> "Selasa"
  const dt = new Date(iso + "T00:00:00");
  const names = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return names[dt.getDay()];
}

function formatDDMMYYYY(iso){ // "2025-12-30" -> "30-12-2025"
  const [y,m,d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function dayNameID(iso){ // "2025-12-30" -> "Selasa"
  const dt = new Date(iso + "T00:00:00");
  const names = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return names[dt.getDay()];
}


function renderCalendar(el, monthData, { clickable=false, onDateClick=null } = {}){
  const { month, days } = monthData; // month = YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const startIdx = firstDayIndexMonday(y, m);
  const totalDays = daysInMonth(y, m);
  const tISO = todayISO();

  el.innerHTML = "";

  for(let i=0;i<startIdx;i++){
    const div = document.createElement("div");
    div.className = "dayCell dayCell--empty";
    el.appendChild(div);
  }

  for(let d=1; d<=totalDays; d++){
  const dateISO = isoDate(y, m, d);
  const stored = days?.[dateISO] || "available";
  const status = computedStatus(dateISO, stored);

  const div = document.createElement("div");
  div.className = clickable ? "dayCell" : "dayCell dayCell--readonly";

  if(dateISO === tISO) div.classList.add("dayCell--today");
  if(status === "completed") div.classList.add("dayCell--past");

const isMobile = window.matchMedia("(max-width: 760px)").matches;

div.innerHTML = `
  <div class="dayTop">
    ${isMobile ? `
      <div class="dayMeta">
        <div class="dayDow">${dayNameID(dateISO)}</div>
        <div class="dayDate">${formatDDMMYYYY(dateISO)}</div>
      </div>
    ` : ``}
    <div class="dayBadge ${statusClass(status)}">${statusLabel(status)}</div>
  </div>
  <div class="dayNum">${d}</div>
`;

  if(clickable && typeof onDateClick === "function" && status !== "completed"){
    div.addEventListener("click", ()=> onDateClick(dateISO, stored, status));
  }

  el.appendChild(div);
}

}

function formatTodayDDMMYYYY(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const todayEl = document.getElementById("todayText");
if(todayEl){
  todayEl.textContent = formatTodayDDMMYYYY();
}

function watchBreakpoint(onChange){
  let last = window.matchMedia("(max-width: 760px)").matches;
  window.addEventListener("resize", () => {
    const now = window.matchMedia("(max-width: 760px)").matches;
    if(now !== last){
      last = now;
      onChange(now);
    }
  });
}


/* =========================================================
   PUBLIC schedule page
========================================================= */
(async function initPublicSchedule(){
  const cal = document.getElementById("calendar");
  const label = document.getElementById("monthLabel");
  const prev = document.getElementById("prevMonth");
  const next = document.getElementById("nextMonth");
  const todayLbl = document.getElementById("todayLabel");

  if(!cal || !label || !prev || !next) return;

  let cur = new Date();

  if(todayLbl){
    todayLbl.textContent = `Hari ini: ${todayISO()}`;
  }

window.addEventListener("resize", () => {
  loadMonth(currentMonth);
});

  async function load(){
    const m = monthStr(cur);
    label.textContent = monthLabelID(cur);

    const data = await fetchMonthAvailability(m, "public");
    renderCalendar(cal, data, { clickable:false });
  }

  prev.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()-1); await load(); });
  next.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()+1); await load(); });

  await load();
})().catch(console.error);


/* =========================================================
   ADMIN preview page (read-only)
========================================================= */
(async function initAdminPreview(){
  const cal = document.getElementById("calendarPreview");
  const label = document.getElementById("monthLabelPreview");
  const prev = document.getElementById("prevMonthPreview");
  const next = document.getElementById("nextMonthPreview");
  if(!cal || !label || !prev || !next) return;

  let cur = new Date();

  async function load(){
    const m = monthStr(cur);
    label.textContent = monthLabelID(cur);
    const data = await fetchMonthAvailability(m, "admin");
    renderCalendar(cal, data, { clickable:false });
  }

  prev.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()-1); await load(); });
  next.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()+1); await load(); });


  await load();
})().catch(console.error);

/* =========================================================
   ADMIN edit page (modal status + catatan)
========================================================= */
(async function initAdminEdit(){
  const cal = document.getElementById("calendarAdmin");
  const label = document.getElementById("monthLabelAdmin");
  const prev = document.getElementById("prevMonthAdmin");
  const next = document.getElementById("nextMonthAdmin");
  if(!cal || !label || !prev || !next) return;

  let cur = new Date();

  function ensureModal(){
    if(document.getElementById("dayModal")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="modal" id="dayModal" aria-hidden="true">
        <div class="modal__backdrop" data-close="1"></div>
        <div class="modal__panel" role="dialog" aria-modal="true">
          <div class="modal__head">
            <div>
              <div class="modal__title">Kelola Tanggal</div>
              <div class="modal__sub muted small" id="modalDateLabel">-</div>
            </div>
            <button class="iconBtn" data-close="1" aria-label="Close">✕</button>
          </div>

          <div class="modal__body">
            <button class="btn btn--ghost btn--block" id="btnEditStatus">Edit Status</button>
            <button class="btn btn--ghost btn--block" id="btnCatatan">Catatan Pekerjaan</button>

            <div class="statusBox" id="statusBox" style="display:none;">
              <div class="muted small" style="margin-bottom:8px;">Pilih status:</div>
              <div class="statusChoices">
                <label class="radioRow"><input type="radio" name="st" value="available"> Tersedia</label>
                <label class="radioRow"><input type="radio" name="st" value="full"> Penuh</label>
                <label class="radioRow"><input type="radio" name="st" value="closed"> Tutup</label>
              </div>
              <button class="btn btn--primary btn--block" id="btnSaveStatus">Simpan Status</button>
            </div>

            <div class="muted small" id="pastHint" style="display:none;margin-top:10px;">
              Tanggal sudah lewat (Completed) dan tidak bisa diubah.
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const modal = document.getElementById("dayModal");
    modal.addEventListener("click", (e)=>{
      const t = e.target;
      if(t?.dataset?.close) closeModal();
    });
  }

  function openModal(dateISO){
    ensureModal();
    const modal = document.getElementById("dayModal");
    modal.dataset.date = dateISO;
    document.getElementById("modalDateLabel").textContent = dateISO;

    document.getElementById("statusBox").style.display = "none";
    document.getElementById("pastHint").style.display = "none";

    if(dateISO < todayISO()){
      document.getElementById("btnEditStatus").disabled = true;
      document.getElementById("btnCatatan").disabled = false;
      document.getElementById("pastHint").style.display = "block";
    }else{
      document.getElementById("btnEditStatus").disabled = false;
      document.getElementById("btnCatatan").disabled = false;
    }

    modal.classList.add("modal--open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(){
    const modal = document.getElementById("dayModal");
    if(!modal) return;
    modal.classList.remove("modal--open");
    modal.setAttribute("aria-hidden", "true");
  }

  async function setStatus(dateISO, status){
    return fetchJson("/api/admin/day/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateISO, status })
    });
  }

  async function loadDay(dateISO){
    return fetchJson(`/api/admin/day?date=${encodeURIComponent(dateISO)}`);
  }

  function wireModal(){
    const modal = document.getElementById("dayModal");
    if(modal.dataset.wired) return;
    modal.dataset.wired = "1";

    const btnEditStatus = document.getElementById("btnEditStatus");
    const btnCatatan = document.getElementById("btnCatatan");
    const statusBox = document.getElementById("statusBox");
    const btnSaveStatus = document.getElementById("btnSaveStatus");

    btnEditStatus.addEventListener("click", async ()=>{
      const dateISO = modal.dataset.date;
      if(dateISO < todayISO()) return;

      const day = await loadDay(dateISO);

      statusBox.style.display = "block";
      const radios = document.querySelectorAll('input[name="st"]');
      radios.forEach(r => r.checked = (r.value === day.status));
    });

    btnSaveStatus.addEventListener("click", async ()=>{
      const dateISO = modal.dataset.date;
      if(dateISO < todayISO()) return;

      const picked = document.querySelector('input[name="st"]:checked')?.value;
      if(!picked) return;

      await setStatus(dateISO, picked);
      await load();
      closeModal();
    });

    btnCatatan.addEventListener("click", ()=>{
      const dateISO = modal.dataset.date;
      window.location.href = `/admin/catatan?date=${encodeURIComponent(dateISO)}`;
    });
  }

  async function load(){
    const m = monthStr(cur);
    label.textContent = monthLabelID(cur);
    const data = await fetchMonthAvailability(m, "admin");
    renderCalendar(cal, data, {
      clickable: true,
      onDateClick: async (dateISO) => {
        openModal(dateISO);
        wireModal();
      }
    });
  }

  prev.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()-1); await load(); });
  next.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()+1); await load(); });

  await load();
})().catch(console.error);


/* =========================================================
   ADMIN: Catatan Pekerjaan page
========================================================= */
(async function initCatatan(){
  const jobsList = document.getElementById("jobsList");
  const dateLabel = document.getElementById("dateLabel");
  const jobDate = document.getElementById("jobDate");
  const form = document.getElementById("jobForm");
  const countLabel = document.getElementById("countLabel");
  if(!jobsList || !dateLabel || !jobDate || !form) return;

  const params = new URLSearchParams(window.location.search);
  const date = (params.get("date") || "").trim();

  if(!date){
    dateLabel.textContent = "-";
    jobDate.value = "";
    if(countLabel) countLabel.textContent = "0 catatan";
    jobsList.innerHTML = `
      <div class="muted">
        Tanggal belum dipilih. Silakan kembali ke <b>Atur Jadwal</b> lalu klik tanggal → <b>Catatan Pekerjaan</b>.
      </div>`;
    form.querySelectorAll("input, textarea, button").forEach(el => el.disabled = true);
    return;
  }

  dateLabel.textContent = date;
  jobDate.value = date;

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  async function load(){
    try{
      const data = await fetchJson(`/api/admin/day?date=${encodeURIComponent(date)}`);
      const jobs = data.jobs || [];
      if(countLabel) countLabel.textContent = `${jobs.length} catatan`;

      if(jobs.length === 0){
        jobsList.innerHTML = `<div class="muted">Belum ada catatan.</div>`;
        return;
      }

      jobsList.innerHTML = jobs.map(j => `
        <div class="jobCard ${j.done ? "jobCard--done" : ""}">
          <div class="jobCard__top">
            <div class="jobCard__title">${escapeHtml(j.namaClient)}</div>

            <div style="display:flex; gap:8px; align-items:center;">
              ${j.done ? `<span class="pill pill--done">Selesai</span>` : ``}
              <button class="btn btn--ghost btn--xs" data-del="${escapeHtml(j.id)}">Hapus</button>
            </div>
          </div>

          <div class="jobCard__row"><b>Alamat:</b> ${escapeHtml(j.alamat)}</div>
          <div class="jobCard__row"><b>Kendala:</b> ${escapeHtml(j.kendala)}</div>

          <div class="muted small">Dibuat: ${new Date(j.createdAt).toLocaleString()}</div>

          ${j.done ? `
            <div class="muted small" style="margin-top:6px;">
              Selesai oleh: <b>${escapeHtml(j.doneBy || "-")}</b>
              ${j.doneAt ? ` • ${new Date(j.doneAt).toLocaleString()}` : ``}
            </div>
          ` : ``}
        </div>
      `).join("");

      jobsList.querySelectorAll("[data-del]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = btn.getAttribute("data-del");
          await fetchJson(`/api/admin/day/job?date=${encodeURIComponent(date)}&id=${encodeURIComponent(id)}`, {
            method: "DELETE"
          });
          await load();
        });
      });
    }catch(e){
      console.error(e);
      jobsList.innerHTML = `<div class="muted">Gagal memuat catatan (cek console).</div>`;
      if(countLabel) countLabel.textContent = "0 catatan";
    }
  }

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);

    const payload = {
      date,
      namaClient: fd.get("namaClient"),
      alamat: fd.get("alamat"),
      kendala: fd.get("kendala"),
    };

    try{
      await fetchJson("/api/admin/day/job", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });

      form.reset();
      jobDate.value = date;
      await load();
    }catch(err){
      console.error(err);
      alert("Gagal simpan. Pastikan semua field terisi & Anda sudah login.");
    }
  });

  await load();
})().catch(console.error);

document.addEventListener("DOMContentLoaded", () => {
  const btn =
    document.querySelector("[data-menu]") ||
    document.getElementById("menuBtn") ||
    document.querySelector(".menuBtn");

  const nav =
    document.querySelector("[data-mobile]") ||
    document.getElementById("mobileNav") ||
    document.querySelector(".mobileNav");

  if (!btn || !nav) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", nav.classList.contains("is-open") ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => nav.classList.remove("is-open"));
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const btn =
    document.querySelector("[data-menu]") ||
    document.getElementById("menuBtn") ||
    document.querySelector(".menuBtn");

  const nav =
    document.querySelector("[data-mobile]") ||
    document.getElementById("mobileNav") ||
    document.querySelector(".mobileNav");

  if (!btn || !nav) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", nav.classList.contains("is-open") ? "true" : "false");
  });
});
