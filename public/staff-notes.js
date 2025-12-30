/* =========================
   STAFF NOTES (LIST + DETAIL)
   File: /public/staff-notes.js
   ========================= */

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getQuery(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

// fetch helper with auth handling
async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);

  // kalau session habis / forbidden, arahkan login
  if (res.status === 401 || res.status === 403) {
    // biar user balik lagi setelah login
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `/login.html?next=${next}`;
    return null;
  }

  return res;
}

async function fetchDates() {
  const res = await safeFetch("/api/staff/notes-dates");
  if (!res) return null;
  if (!res.ok) throw new Error("Gagal load tanggal catatan");
  return res.json();
}

async function fetchDay(date) {
  const res = await safeFetch(`/api/staff/day?date=${encodeURIComponent(date)}`);
  if (!res) return null;
  if (!res.ok) throw new Error("Gagal load detail catatan");
  return res.json();
}

async function markDone(date, id) {
  const yakin = confirm("Yakin sudah selesai?");
  if (!yakin) return false;

  const res = await safeFetch("/api/staff/job/done", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, id })
  });

  if (!res) return false;
  if (!res.ok) throw new Error("Gagal update selesai");

  return true;
}

function setLoading(el, text = "Memuat...") {
  el.innerHTML = `<div class="muted">${esc(text)}</div>`;
}

function setError(el, text = "Terjadi error.") {
  el.innerHTML = `
    <div class="jobCard">
      <div class="jobCard__top">
        <div class="jobCard__title">Gagal memuat</div>
      </div>
      <div class="muted small">${esc(text)}</div>
    </div>
  `;
}

/* =======================================
   Page: LIST TANGGAL ( /staff/catatan )
   - butuh #datesList dan #reload
   ======================================= */
(async function initDatesList() {
  const list = document.getElementById("datesList");
  const reload = document.getElementById("reload");
  if (!list) return; // bukan halaman list

  async function render() {
    try {
      setLoading(list, "Memuat tanggal catatan...");
      const data = await fetchDates();
      if (!data) return;

      const dates = data.dates || [];
      if (dates.length === 0) {
        list.innerHTML = `<div class="muted">Belum ada catatan pekerjaan.</div>`;
        return;
      }

      list.innerHTML = dates
        .map((d) => {
          const progress = `${d.done}/${d.total} selesai`;
          return `
            <a class="jobCard jobCard--link" href="/staff/catatan/detail?date=${encodeURIComponent(d.date)}">
              <div class="jobCard__top">
                <div class="jobCard__title">${esc(d.date)}</div>
                <span class="pill pill--info">${esc(progress)}</span>
              </div>
              <div class="muted small">Klik untuk lihat detail pekerjaan</div>
            </a>
          `;
        })
        .join("");
    } catch (err) {
      console.error(err);
      setError(list, err?.message || "Tidak bisa memuat data.");
    }
  }

  reload?.addEventListener("click", render);
  await render();
})().catch(console.error);

/* =======================================
   Page: DETAIL PEKERJAAN
   - URL: /staff/catatan/detail?date=YYYY-MM-DD
   - butuh #jobs dan #dateLabel
   ======================================= */
(async function initDetail() {
  const jobsEl = document.getElementById("jobs");
  const dateLabel = document.getElementById("dateLabel");
  if (!jobsEl || !dateLabel) return; // bukan halaman detail

  const date = getQuery("date");
  dateLabel.textContent = date ? `Tanggal: ${date}` : "Tanggal tidak valid";

  async function render() {
    try {
      if (!date) {
        jobsEl.innerHTML = `<div class="muted">Tanggal tidak valid.</div>`;
        return;
      }

      setLoading(jobsEl, "Memuat pekerjaan...");

      const day = await fetchDay(date);
      if (!day) return;

      const jobs = day.jobs || [];
      if (jobs.length === 0) {
        jobsEl.innerHTML = `<div class="muted">Tidak ada pekerjaan di tanggal ini.</div>`;
        return;
      }

      jobsEl.innerHTML = jobs
        .map((j) => {
          const doneHtml = j.done
            ? `<span class="pill pill--done">Selesai</span>`
            : `<button class="btn btn--primary btn--xs" data-done="${esc(j.id)}">Sudah selesai</button>`;

          // card hijau kalau done
          return `
            <div class="jobCard ${j.done ? "jobCard--done" : ""}" data-id="${esc(j.id)}">
              <div class="jobCard__top">
                <div class="jobCard__title">${esc(j.namaClient)}</div>
                ${doneHtml}
              </div>

              <div class="jobCard__row"><b>Alamat:</b> ${esc(j.alamat)}</div>
              <div class="jobCard__row"><b>Kendala:</b> ${esc(j.kendala)}</div>

              ${
                j.done
                  ? `<div class="muted small" style="margin-top:6px;">
                      Diselesaikan oleh <b>${esc(j.doneBy || "-")}</b>
                      ${j.doneAt ? ` • ${esc(new Date(j.doneAt).toLocaleString("id-ID"))}` : ""}
                    </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("");

      jobsEl.querySelectorAll("[data-done]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const id = btn.getAttribute("data-done");
            const ok = await markDone(date, id);
            if (ok) await render();
          } catch (err) {
            console.error(err);
            alert(err?.message || "Gagal update selesai.");
          }
        });
      });
    } catch (err) {
      console.error(err);
      setError(jobsEl, err?.message || "Tidak bisa memuat detail.");
    }
  }

  await render();
})().catch(console.error);
