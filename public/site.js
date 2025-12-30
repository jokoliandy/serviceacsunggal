// public/site.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-menu]").forEach((btn) => {
    const header = btn.closest("header") || document;
    const mobile = header.querySelector("[data-mobile]");

    if (!mobile) return;

    btn.addEventListener("click", () => {
      const open = mobile.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
});
