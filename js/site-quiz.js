/* Wissensquiz-Seite: kursunabhängiges Quiz für alle Besucher.
   Zeigt nach dem Absenden die Lösungen an. Pro Gerät nur einmal (localStorage). */
(function () {
  if (!window.SB) return;
  var sb = window.SB.get();

  var listEl = document.querySelector("[data-site-quiz-list]");
  var emptyEl = document.querySelector("[data-site-quiz-empty]");
  var doneEl = document.querySelector("[data-site-quiz-done]");
  if (!listEl) return;

  function toEmbedUrl(url) {
    if (!url) return "";
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];
    var vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vim) return "https://player.vimeo.com/video/" + vim[1];
    return url;
  }

  var STORE = "site_quiz_answered";
  function getAnsweredSet() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function markAnswered(qid) {
    var s = getAnsweredSet();
    s[qid] = true;
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* ignorieren */ }
  }

  sb.rpc("get_site_quiz").then(function (res) {
    if (res.error || !res.data || !res.data.enabled) {
      if (emptyEl) emptyEl.textContent = "Zurzeit ist kein Quiz verfügbar. Schauen Sie bald wieder vorbei!";
      return;
    }
    var questions = res.data.questions || [];
    if (!questions.length) {
      if (emptyEl) emptyEl.textContent = "Zurzeit ist kein Quiz verfügbar. Schauen Sie bald wieder vorbei!";
      return;
    }
    renderQuiz(questions);
  });

  function revealAnswers(optionsWrap, answers) {
    Array.prototype.slice.call(optionsWrap.querySelectorAll(".quiz-option")).forEach(function (lbl) {
      var aid = lbl.getAttribute("data-answer-id");
      var ans = answers.filter(function (a) { return a.id === aid; })[0];
      var inp = lbl.querySelector("input");
      var wasSelected = inp.checked;
      inp.disabled = true;
      if (ans && ans.correct) lbl.classList.add("is-correct");
      else if (wasSelected) lbl.classList.add("is-wrong");
    });
  }

  function renderQuiz(questions) {
    listEl.innerHTML = "";
    var answeredSet = getAnsweredSet();
    var answeredCount = 0;
    var cards = [];

    function revealCard(i) {
      if (i >= 0 && i < cards.length) cards[i].style.display = "";
    }
    function revealNext(index, doScroll) {
      var next = cards[index + 1];
      if (!next) return;
      next.style.display = "";
      if (doScroll) next.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    questions.forEach(function (q, index) {
      var card = document.createElement("div");
      card.className = "quiz-card site-quiz-card";
      card.style.display = "none";
      cards.push(card);

      var num = document.createElement("span");
      num.className = "quiz-number";
      num.textContent = "Frage " + (index + 1) + " / " + questions.length;
      card.appendChild(num);

      if (q.media_type && q.media_type !== "none" && q.media_url) {
        card.appendChild(buildMedia(q));
      }

      var qtext = document.createElement("h3");
      qtext.className = "quiz-question-text";
      qtext.textContent = q.question_text || "";
      card.appendChild(qtext);

      var answers = Array.isArray(q.answers) ? q.answers : [];
      var multiple = answers.filter(function (a) { return a.correct; }).length > 1;
      var optionsWrap = document.createElement("div");
      optionsWrap.className = "quiz-options";
      answers.forEach(function (a) {
        var label = document.createElement("label");
        label.className = "quiz-option";
        var input = document.createElement("input");
        input.type = multiple ? "checkbox" : "radio";
        input.name = "sq_" + q.id;
        input.value = a.id;
        label.appendChild(input);
        var span = document.createElement("span");
        span.textContent = a.text || "";
        label.appendChild(span);
        label.setAttribute("data-answer-id", a.id);
        optionsWrap.appendChild(label);
      });
      card.appendChild(optionsWrap);

      var btn = document.createElement("button");
      btn.className = "btn quiz-submit-btn";
      btn.type = "button";
      btn.textContent = "Antwort abgeben";
      btn.addEventListener("click", function () {
        var selected = Array.prototype.slice.call(optionsWrap.querySelectorAll("input:checked"))
          .map(function (i) { return i.value; });
        if (!selected.length) return;
        btn.disabled = true;
        sb.rpc("submit_quiz_answer", { p_question_id: q.id, p_selected: selected }).then(function () {
          revealAnswers(optionsWrap, answers);
          card.classList.add("revealed");
          btn.style.display = "none";
          markAnswered(q.id);
          answeredCount++;
          revealNext(index, true);
          if (answeredCount >= questions.length && doneEl) doneEl.hidden = false;
        });
      });
      card.appendChild(btn);

      // Bereits auf diesem Gerät beantwortet: nur Lösungen anzeigen (kein erneutes Absenden)
      if (answeredSet[q.id]) {
        revealAnswers(optionsWrap, answers);
        card.classList.add("revealed");
        btn.style.display = "none";
        answeredCount++;
      }

      listEl.appendChild(card);
    });

    // Fragen nacheinander freischalten: erste offene Frage plus alle bereits beantworteten anzeigen
    revealCard(0);
    for (var i = 0; i < cards.length; i++) {
      if (answeredSet[questions[i].id]) revealCard(i + 1);
      else break;
    }

    if (answeredCount >= questions.length && doneEl) doneEl.hidden = false;
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
})();
