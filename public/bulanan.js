function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function prettyUser(u){
  const s = String(u || "").trim();
  if(!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

async function fetchBulanan(status){
  const res = await fetch(`/api/admin/jobs-all?status=${encodeURIComponent(status)}`);
  if(!res.ok) throw new Error("Gagal load rekap bulanan");
  return res.json();
}

(async function initBulanan(){
  const list = document.getElementById("bulananList");
  const reload = document.getElementById("reload");
  const filterStatus = document.getElementById("filterStatus");
  const filterDate = document.getElementById("filterDate"); // ✅ date input
  const summary = document.getElementById("summary");

  if(!list || !filterStatus || !summary) return;

  // kalau HTML belum ditambah input date, tetap jalan tanpa error
  const hasDateFilter = Boolean(filterDate);

  async function render(){
    try{
      list.innerHTML = `<div class="muted">Memuat...</div>`;

      const status = filterStatus.value || "all";
      const pickedDate = hasDateFilter ? (filterDate.value || "") : "";

      const data = await fetchBulanan(status);

      // ✅ data dari API: { statusFilter, dates:[{date,status,total,doneCount,jobs:[...]}] }
      let dates = data.dates || [];

      // ✅ filter tanggal di frontend (kalau dipilih)
      if(pickedDate){
        dates = dates.filter(d => d.date === pickedDate);
      }

      // ✅ summary mengikuti hasil filter tampil
      const totalJobs = dates.reduce((acc, d) => acc + (d.jobs?.length || 0), 0);
      const totalDone = dates.reduce((acc, d) => acc + ((d.jobs || []).filter(j=>j.done).length || 0), 0);
      summary.textContent = `Total tampil: ${totalJobs} pekerjaan • Selesai: ${totalDone} • Belum: ${Math.max(0, totalJobs - totalDone)}`;

      if(dates.length === 0){
        list.innerHTML = `<div class="muted">Tidak ada catatan untuk filter ini.</div>`;
        return;
      }

      list.innerHTML = dates.map(day => {
        const jobs = Array.isArray(day.jobs) ? day.jobs : [];
        const doneCount = jobs.filter(j => j.done).length;
        const total = jobs.length;

        const jobsHtml = jobs.map(j => `
          <div class="jobCard ${j.done ? "jobCard--done" : ""}" style="margin-top:10px;">
            <div class="jobCard__top">
              <div class="jobCard__title">${esc(j.namaClient)}</div>
              ${j.done
                ? `<span class="pill pill--done">Selesai</span>`
                : `<span class="pill pill--info">Belum</span>`
              }
            </div>

            <div class="jobCard__row"><b>Alamat:</b> ${esc(j.alamat)}</div>
            <div class="jobCard__row"><b>Kendala:</b> ${esc(j.kendala)}</div>
            <div class="muted small">Dibuat: ${esc(fmtDate(j.createdAt))}</div>

            ${j.done ? `
              <div class="muted small" style="margin-top:6px;">
                Selesai oleh: <b>${esc(prettyUser(j.doneBy))}</b>
                ${j.doneAt ? ` • ${esc(fmtDate(j.doneAt))}` : ``}
              </div>
            ` : ``}
          </div>
        `).join("");

        return `
          <div class="jobCard">
            <div class="jobCard__top">
              <div class="jobCard__title">Tanggal: ${esc(day.date)}</div>
              <span class="pill pill--info">${doneCount}/${total} selesai</span>
            </div>
            <div class="muted small">Klik “Catatan” untuk detail per tanggal, ini rekap semua.</div>
            ${jobsHtml}
          </div>
        `;
      }).join("");

    } catch(err){
      console.error(err);
      summary.textContent = "Gagal memuat.";
      list.innerHTML = `<div class="muted">Gagal load rekap bulanan.</div>`;
    }
  }

  reload?.addEventListener("click", render);
  filterStatus.addEventListener("change", render);
  if(hasDateFilter){
    filterDate.addEventListener("change", render); // ✅ auto filter saat pilih tanggal
  }

  await render();
})();
