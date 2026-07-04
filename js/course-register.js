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

  var priorField = document.querySelector("[data-prior-field]");

  sb.from("courses").select("id,name,max_participants,signup_open,ask_prior_knowledge").eq("status", "active").maybeSingle().then(function (res) {
    if (res.error) { console.error("Kurs laden:", res.error.message); }
    activeCourse = res.data || null;
    if (!activeCourse) {
      if (signupCard) signupCard.style.display = "none";
      if (noCourse) noCourse.style.display = "";
      if (nameOut) nameOut.style.display = "none";
      return;
    }
    if (activeCourse.signup_open === false) {
      if (signupCard) signupCard.style.display = "none";
      if (nameOut) nameOut.style.display = "none";
      if (noCourse) {
        noCourse.style.display = "";
        noCourse.innerHTML = "<p>Die Anmeldung für diesen Kurs ist <strong>bereits geschlossen</strong>. Bitte schauen Sie später wieder auf der <a href=\"kurse.html\">Kurse-Seite</a> vorbei.</p>";
      }
      return;
    }
    if (nameOut) nameOut.textContent = activeCourse.name || "";
    if (priorField && activeCourse.ask_prior_knowledge) priorField.style.display = "";
    checkCapacity();
  });

  function checkCapacity() {
    if (!activeCourse || !activeCourse.max_participants || activeCourse.max_participants <= 0) return;
    sb.rpc("course_signup_count", { p_course_id: activeCourse.id }).then(function (res) {
      var count = (res && typeof res.data === "number") ? res.data : 0;
      if (count >= activeCourse.max_participants) {
        if (signupCard) signupCard.style.display = "none";
        if (noCourse) {
          noCourse.style.display = "";
          noCourse.innerHTML = "<p>Dieser Kurs ist leider bereits <strong>ausgebucht</strong>. Bitte schauen Sie später wieder auf der <a href=\"kurse.html\">Kurse-Seite</a> vorbei.</p>";
        }
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (errEl) errEl.textContent = "";
      if (!activeCourse) { if (errEl) errEl.textContent = "Kein aktiver Kurs vorhanden."; return; }

      var name = form.name.value.trim();
      var contact = form.contact.value.trim();

      if (!name) { if (errEl) errEl.textContent = "Bitte geben Sie Ihren Namen an."; return; }
      if (!contact) {
        if (errEl) errEl.textContent = "Bitte geben Sie eine E-Mail-Adresse oder Telefonnummer an.";
        return;
      }

      // E-Mail vs. Telefon anhand des "@"-Zeichens unterscheiden
      var isEmail = contact.indexOf("@") !== -1;
      var email = isEmail ? contact : null;
      var phone = isEmail ? null : contact;

      var priorKnowledge = null;
      if (activeCourse.ask_prior_knowledge) {
        var checked = form.querySelector('input[name="prior_knowledge"]:checked');
        if (!checked) {
          if (errEl) errEl.textContent = "Bitte geben Sie an, ob Sie Vorkenntnisse haben.";
          return;
        }
        priorKnowledge = checked.value === "yes";
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
          prior_knowledge: priorKnowledge,
        });
        if (res.error) throw res.error;
        try { sessionStorage.setItem("course_signup_name", name); } catch (e) { /* ignorieren */ }
        window.location.href = "kurs-erfolg.html";
      } catch (ex) {
        if (errEl) errEl.textContent = "Anmeldung fehlgeschlagen: " + (ex.message || ex);
        btn.disabled = false;
        btn.textContent = "Verbindlich anmelden";
      }
    });
  }
})();
