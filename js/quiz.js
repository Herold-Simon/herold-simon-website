/* Quiz-Seite: zeigt das Quiz des aktiven Kurses. Fragen werden nacheinander
   freigeschaltet – nach dem Abgeben wird die Frage gesperrt, die nächste
   erscheint und es wird dorthin gescrollt. Bewertung erfolgt serverseitig. */
(function () {
  if (!window.SB) return;
  var sb = window.SB.get();

  var titleEl = document.querySelector("[data-quiz-title]");
  var courseEl = document.querySelector("[data-quiz-course]");
  var listEl = document.querySelector("[data-quiz-list]");
  var doneEl = document.querySelector("[data-quiz-done]");

  function toEmbedUrl(url) {
    if (!url) return "";
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];
    var vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vim) return "https://player.vimeo.com/video/" + vim[1];
    return url;
  }

  sb.from("courses").select("id,name,signup_open").eq("status", "active").maybeSingle().then(function (res) {
    var course = res.data;
    if (!course) {
      listEl.innerHTML = "<p class=\"course-empty\">Zurzeit ist kein Kurs aktiv – es gibt gerade kein Quiz.</p>";
      if (courseEl) courseEl.style.display = "none";
      return;
    }
    if (course.signup_open !== false) {
      listEl.innerHTML = "<p class=\"course-empty\">Das Quiz ist erst verfügbar, sobald die Anmeldung zum Kurs geschlossen ist.</p>";
      if (courseEl) courseEl.style.display = "none";
      return;
    }
    if (courseEl) courseEl.textContent = course.name || "";
    loadQuestions(course.id);
  });

  function loadQuestions(courseId) {
    sb.rpc("get_quiz_public", { p_course_id: courseId })
      .then(function (res) {
        if (res.error) { listEl.innerHTML = "<p class=\"course-empty\">Fehler beim Laden.</p>"; return; }
        var questions = res.data || [];
        if (!questions.length) {
          listEl.innerHTML = "<p class=\"course-empty\">Für diesen Kurs ist noch kein Quiz hinterlegt.</p>";
          return;
        }
        renderQuestions(questions);
      });
  }

  function renderQuestions(questions) {
    listEl.innerHTML = "";
    questions.forEach(function (q, index) {
      var card = document.createElement("div");
      card.className = "quiz-card";
      if (index > 0) card.hidden = true;
      card.setAttribute("data-index", index);

      var num = document.createElement("span");
      num.className = "quiz-number";
      num.textContent = "Frage " + (index + 1) + " / " + questions.length;
      card.appendChild(num);

      if (q.media_type && q.media_type !== "none" && q.media_url) {
        card.appendChild(buildMedia(q));
      }

      var qtext = document.createElement("h2");
      qtext.className = "quiz-question-text";
      qtext.textContent = q.question_text || "";
      card.appendChild(qtext);

      var answers = Array.isArray(q.answers) ? q.answers : [];
      var optionsWrap = document.createElement("div");
      optionsWrap.className = "quiz-options";
      answers.forEach(function (a) {
        var label = document.createElement("label");
        label.className = "quiz-option";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.value = a.id;
        label.appendChild(input);
        var span = document.createElement("span");
        span.textContent = a.text || "";
        label.appendChild(span);
        optionsWrap.appendChild(label);
      });
      card.appendChild(optionsWrap);

      var lock = document.createElement("div");
      lock.className = "quiz-lock";
      lock.innerHTML = "<span class=\"quiz-lock-icon\">&#128274;</span> Beantwortet";
      card.appendChild(lock);

      var btn = document.createElement("button");
      btn.className = "btn quiz-submit-btn";
      btn.type = "button";
      btn.textContent = "Antwort abgeben";
      btn.addEventListener("click", function () {
        submitAnswer(q, optionsWrap, btn, card, index, questions.length);
      });
      card.appendChild(btn);

      listEl.appendChild(card);
    });
  }

  function buildMedia(q) {
    var wrap = document.createElement("div");
    wrap.className = "quiz-media";
    if (q.media_type === "image") {
      var img = document.createElement("img");
      img.src = window.SB.imgUrl(q.media_url);
      img.alt = "";
      img.loading = "lazy";
      wrap.appendChild(img);
    } else if (q.media_type === "video_file") {
      var v = document.createElement("video");
      v.src = window.SB.imgUrl(q.media_url);
      v.controls = true;
      v.preload = "metadata";
      wrap.appendChild(v);
    } else if (q.media_type === "video_embed") {
      wrap.classList.add("is-embed");
      var frame = document.createElement("iframe");
      frame.src = toEmbedUrl(q.media_url);
      frame.title = "Video zur Frage";
      frame.loading = "lazy";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      wrap.appendChild(frame);
    }
    return wrap;
  }

  async function submitAnswer(q, optionsWrap, btn, card, index, total) {
    var selected = Array.prototype.slice.call(optionsWrap.querySelectorAll("input:checked"))
      .map(function (i) { return i.value; });
    if (!selected.length) {
      if (!window.confirm("Keine Antwort ausgewählt. Trotzdem abgeben?")) return;
    }
    btn.disabled = true;
    btn.textContent = "Wird gesendet …";
    try {
      var res = await sb.rpc("submit_quiz_answer", { p_question_id: q.id, p_selected: selected });
      if (res.error) throw res.error;
      optionsWrap.querySelectorAll("input").forEach(function (i) { i.disabled = true; });
      card.classList.add("locked");
      btn.style.display = "none";

      var next = listEl.querySelector('.quiz-card[data-index="' + (index + 1) + '"]');
      if (next) {
        next.hidden = false;
        next.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (doneEl) {
        doneEl.hidden = false;
        doneEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (ex) {
      btn.disabled = false;
      btn.textContent = "Antwort abgeben";
      alert("Fehler beim Speichern: " + (ex.message || ex));
    }
  }
})();
