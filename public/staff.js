// ===== staff catatan page =====
(async function initStaffNotes(){
  const datePick = document.getElementById("datePick");
  const jobsEl = document.getElementById("jobs");
  if(!datePick || !jobsEl) return;

  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  async function loadDay(date){
    const res = await fetch(`/api/staff/day?date=${encodeURIComponent(date)}`);
    if(!res.ok) throw new Error("Gagal load catatan staff");
    return res.json();
  }

  async function markDone(date, id){
    const yakin = confirm("Yakin sudah selesai?");
    if(!yakin) return false; // "belum"
    const res = await fetch("/api/staff/job/done", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ date, id })
    });
    if(!res.ok) throw new Error("Gagal update selesai");
    return true;
  }

  async function render(date){
    if(!date){
      jobsEl.innerHTML = `<div class="muted">Pilih tanggal dulu.</div>`;
      return;
    }

    const day = await loadDay(date);
    const jobs = day.jobs || [];

    if(jobs.length === 0){
      jobsEl.innerHTML = `<div class="muted">Belum ada catatan di tanggal ini.</div>`;
      return;
    }

    jobsEl.innerHTML = jobs.map(j => `
      <div class="jobCard ${j.done ? "jobCard--done" : ""}" data-id="${esc(j.id)}">
        <div class="jobCard__top">
          <div class="jobCard__title">${esc(j.namaClient)}</div>

          ${j.done
            ? `<span class="pill pill--done">Selesai</span>`
            : `<button class="btn btn--primary btn--xs" data-done="${esc(j.id)}">Sudah selesai</button>`
          }
        </div>

        <div class="jobCard__row"><b>Alamat:</b> ${esc(j.alamat)}</div>
        <div class="jobCard__row"><b>Kendala:</b> ${esc(j.kendala)}</div>

        ${j.done
          ? `<div class="muted small">Selesai oleh <b>${esc(j.doneBy||"-")}</b> • ${new Date(j.doneAt).toLocaleString()}</div>`
          : `<div class="muted small">Status: belum selesai</div>`
        }
      </div>
    `).join("");

    jobsEl.querySelectorAll("[data-done]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-done");

        // optimasi UX: langsung hijau dulu (optimistic) setelah OK
        const ok = await markDone(date, id);
        if(!ok) return;

        const card = jobsEl.querySelector(`.jobCard[data-id="${CSS.escape(id)}"]`);
        if(card){
          card.classList.add("jobCard--done");
          btn.remove();
          const top = card.querySelector(".jobCard__top");
          if(top){
            const pill = document.createElement("span");
            pill.className = "pill pill--done";
            pill.textContent = "Selesai";
            top.appendChild(pill);
          }
        }

        // lalu sync ulang dari server biar data doneBy/doneAt update
        await render(date);
      });
    });
  }

  // default hari ini
  const now = new Date();
  const pad2 = (n)=>String(n).padStart(2,"0");
  const today = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  datePick.value = today;

  datePick.addEventListener("change", async ()=>{ await render(datePick.value); });
  await render(datePick.value);
})().catch(console.error);
