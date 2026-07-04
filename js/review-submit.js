/* Bewertungs-Seite: Fragen des aktiven Kurses, Text + optionale Sterne. */
(function () {
  if (!window.SB) return;
  var sb = window.SB.get();

  var courseEl = document.querySelector("[data-review-course]");
  var form = document.querySelector("[data-review-form]");
  var questionsEl = document.querySelector("[data-review-questions]");
  var noneEl = document.querySelector("[data-review-none]");
  var thanksEl = document.querySelector("[data-review-thanks]");
  var errEl = document.querySelector("[data-review-error]");
  var bodyEl = document.querySelector("[data-review-body]");
  var confirmNameBtn = document.querySelector("[data-review-confirm-name]");
  var editNameBtn = document.querySelector("[data-review-edit-name]");

  var activeCourse = null;
  var questions = [];

  function wordCount(t) {
    var s = (t || "").trim();
    if (!s) return 0;
    return s.split(/\s+/).length;
  }

  sb.from("courses").select("id,name,signup_open").eq("status", "active").maybeSingle().then(function (res) {
    activeCourse = res.data || null;
    if (!activeCourse) {
      if (form) form.style.display = "none";
      if (courseEl) courseEl.style.display = "none";
      if (noneEl) noneEl.style.display = "";
      return;
    }
    if (activeCourse.signup_open !== false) {
      activeCourse = null;
      if (form) form.style.display = "none";
      if (courseEl) courseEl.style.display = "none";
      if (noneEl) {
        noneEl.style.display = "";
        noneEl.innerHTML = "<p>Die Bewertung ist erst verfügbar, sobald die Anmeldung zum Kurs geschlossen ist.</p>";
      }
      return;
    }
    if (courseEl) courseEl.textContent = activeCourse.name || "";
    loadQuestions();
  });

  function loadQuestions() {
    sb.from("review_questions").select("*").eq("course_id", activeCourse.id).order("sort_order", { ascending: true }).then(function (res) {
      if (res.error) { questionsEl.innerHTML = "<p class=\"admin-error\">Fehler beim Laden.</p>"; return; }
      questions = res.data || [];
      if (!questions.length) {
        questionsEl.innerHTML = "<p class=\"course-field-hint\">Für diesen Kurs sind noch keine Bewertungsfragen hinterlegt.</p>";
        return;
      }
      renderQuestions();
    });
  }

  function renderQuestions() {
    questionsEl.innerHTML = "";
    questions.forEach(function (q) {
      var block = document.createElement("div");
      block.className = "review-q";
      block.setAttribute("data-qid", q.id);

      var label = document.createElement("p");
      label.className = "review-q-text";
      label.textContent = q.question_text || "";
      block.appendChild(label);

      if (q.allow_stars) {
        block.appendChild(buildStars(block));
      }

      var ta = document.createElement("textarea");
      ta.className = "review-q-textarea";
      ta.rows = 3;
      ta.placeholder = "Ihre Antwort (optional)";
      block.appendChild(ta);

      questionsEl.appendChild(block);
    });
  }

  function buildStars(block) {
    var wrap = document.createElement("div");
    wrap.className = "review-stars-input";
    wrap.setAttribute("data-stars", "0");
    for (var i = 1; i <= 5; i++) {
      (function (val) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "review-star-btn";
        b.textContent = "☆";
        b.addEventListener("click", function () {
          wrap.setAttribute("data-stars", String(val));
          Array.prototype.slice.call(wrap.querySelectorAll(".review-star-btn")).forEach(function (s, i2) {
            s.textContent = i2 < val ? "★" : "☆";
            s.classList.toggle("active", i2 < val);
          });
        });
        wrap.appendChild(b);
      })(i);
    }
    return wrap;
  }

  if (confirmNameBtn) {
    confirmNameBtn.addEventListener("click", function () {
      if (errEl) errEl.textContent = "";
      var name = form.author_name.value.trim();
      if (!name) {
        if (errEl) errEl.textContent = "Bitte geben Sie Ihren Namen ein.";
        form.author_name.focus();
        return;
      }
      form.author_name.readOnly = true;
      confirmNameBtn.style.display = "none";
      if (bodyEl) bodyEl.style.display = "";
    });
  }

  if (editNameBtn) {
    editNameBtn.addEventListener("click", function () {
      form.author_name.readOnly = false;
      form.author_name.focus();
      if (bodyEl) bodyEl.style.display = "none";
      if (confirmNameBtn) confirmNameBtn.style.display = "";
    });
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (errEl) errEl.textContent = "";
      if (!activeCourse) return;

      var authorName = form.author_name.value.trim();
      if (!authorName) {
        if (errEl) errEl.textContent = "Bitte geben Sie Ihren Namen ein.";
        return;
      }
      var rows = [];
      Array.prototype.slice.call(questionsEl.querySelectorAll(".review-q")).forEach(function (block) {
        var qid = block.getAttribute("data-qid");
        var ta = block.querySelector(".review-q-textarea");
        var text = ta ? ta.value.trim() : "";
        var starsWrap = block.querySelector(".review-stars-input");
        var stars = starsWrap ? parseInt(starsWrap.getAttribute("data-stars"), 10) || 0 : 0;
        if (text || stars) {
          var autoShow = stars === 5 && !!text && wordCount(text) < 15;
          rows.push({
            course_id: activeCourse.id,
            question_id: qid,
            author_name: authorName,
            text: text || null,
            stars: stars || null,
            show_on_page: autoShow,
            show_in_marquee: autoShow,
          });
        }
      });

      if (!rows.length) {
        if (errEl) errEl.textContent = "Bitte mindestens eine Frage beantworten oder bewerten.";
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Wird gesendet …";
      try {
        var res = await sb.from("reviews").insert(rows);
        if (res.error) throw res.error;
        form.style.display = "none";
        if (courseEl) courseEl.style.display = "none";
        if (thanksEl) thanksEl.style.display = "";
      } catch (ex) {
        if (errEl) errEl.textContent = "Fehler beim Senden: " + (ex.message || ex);
        btn.disabled = false;
        btn.textContent = "Bewertung absenden";
      }
    });
  }
})();
