function pad2(n){ return String(n).padStart(2,"0"); }
function monthStr(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function isoDate(y,m,day){ return `${y}-${pad2(m)}-${pad2(day)}`; }

function firstDayIndexMonday(year, month1to12){
  const js = new Date(year, month1to12-1, 1);
  return (js.getDay() + 6) % 7; // Mon=0
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
  if(status==="completed") return "status-completed";
  if(status==="full") return "status-full";
  if(status==="closed") return "status-closed";
  return "status-available";
}
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function computedStatus(dateISO, storedStatus){
  if(dateISO < todayISO()) return "completed";
  return storedStatus || "available";
}

async function fetchMonthAvailability(month){
  // ✅ PILIH SALAH SATU:
  // 1) Sama dengan CLIENT (public):
  const url = `/api/public/availability?month=${encodeURIComponent(month)}&_ts=${Date.now()}`;
  console.log("STAFF fetch:", url);


  // 2) Kalau STAFF login dan backend mengizinkan role staff:
  // const url = `/api/admin/availability?month=${encodeURIComponent(month)}`;

  const res = await fetch(url, { credentials: "include" }); // penting utk cookie session
  if(!res.ok){
    const txt = await res.text().catch(()=> "");
    throw new Error(`Gagal load availability (${res.status}): ${txt.slice(0,120)}`);
  }
  return res.json(); // format: { month:"YYYY-MM", days:{ "YYYY-MM-DD":"available/full/closed" } }
}

function renderCalendar(el, monthData){
  const { month, days } = monthData;
  const [y, m] = month.split("-").map(Number);
  const startIdx = firstDayIndexMonday(y, m);
  const totalDays = daysInMonth(y, m);
  const tISO = todayISO();

  el.innerHTML = "";

  for(let i=0;i<startIdx;i++){
    const div = document.createElement("div");
    div.className = "dayCell dayCell--empty dayCell--readonly";
    el.appendChild(div);
  }

  for(let d=1; d<=totalDays; d++){
    const dateISO = isoDate(y, m, d);
    const stored = days?.[dateISO] || "available";
    const status = computedStatus(dateISO, stored);

    const div = document.createElement("div");
    div.className = "dayCell dayCell--readonly";
    if(dateISO === tISO) div.classList.add("dayCell--today");
    if(status === "completed") div.classList.add("dayCell--past");

    div.innerHTML = `
      <div class="dayTop">
        <div class="dayNum">${d}</div>
        <div class="dayMini">${dateISO}</div>
      </div>
      <div class="dayBadge ${statusClass(status)}">${statusLabel(status)}</div>
    `;
    el.appendChild(div);
  }
}

// ===== INIT STAFF =====
(async function initStaffSchedule(){
  const cal = document.getElementById("calendar");
  const label = document.getElementById("monthLabel");
  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");
  if(!cal || !label || !prev || !next) return;

  let cur = new Date();

  async function load(){
    const m = monthStr(cur);
    label.textContent = m;
    const data = await fetchMonthAvailability(m);
    renderCalendar(cal, data);
  }

  prev.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()-1); await load(); });
  next.addEventListener("click", async ()=>{ cur.setMonth(cur.getMonth()+1); await load(); });

  await load();
})().catch(console.error);
