/* Kurs-Anmeldung: aktiven Kurs laden, Anmeldung speichern, weiterleiten. */
(function () {
  if (!window.SB) return;
  var sb = window.SB.get();

  var nameOut = document.querySelector("[data-course-name]");
  var signupCard = document.querySelector("[data-signup-card]");
  var noCourse = document.querySelector("[data-no-course]");
  var form = document.querySelector("[data-signup-form]");
  var errEl = document.querySelector("[data-signup-error]");

  var activeCourse = null;

  sb.from("courses").select("id,name").eq("status", "active").maybeSingle().then(function (res) {
    if (res.error) { console.error("Kurs laden:", res.error.message); }
    activeCourse = res.data || null;
    if (!activeCourse) {
      if (signupCard) signupCard.style.display = "none";
      if (noCourse) noCourse.style.display = "";
      if (nameOut) nameOut.style.display = "none";
      return;
    }
    if (nameOut) nameOut.textContent = activeCourse.name || "";
  });

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (errEl) errEl.textContent = "";
      if (!activeCourse) { if (errEl) errEl.textContent = "Kein aktiver Kurs vorhanden."; return; }

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var phone = form.phone.value.trim();

      if (!name) { if (errEl) errEl.textContent = "Bitte geben Sie Ihren Namen an."; return; }
      if (!email && !phone) {
        if (errEl) errEl.textContent = "Bitte geben Sie eine E-Mail-Adresse oder Telefonnummer an.";
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Wird gesendet …";

      try {
        var res = await sb.from("course_registrations").insert({
          course_id: activeCourse.id,
          name: name,
          email: email || null,
          phone: phone || null,
        });
        if (res.error) throw res.error;
        window.location.href = "kurs-erfolg.html";
      } catch (ex) {
        if (errEl) errEl.textContent = "Anmeldung fehlgeschlagen: " + (ex.message || ex);
        btn.disabled = false;
        btn.textContent = "Verbindlich anmelden";
      }
    });
  }
})();
