/* Öffentliche Kurse-Seite: Video, Werbetext, aktiver Kurs (Slideshow),
   vergangene Kurse (Lightbox). Bewertungs-Laufband folgt in Phase 3. */
(function () {
  if (!window.SB) return;
  var sb = window.SB.get();

  var videoEl = document.querySelector("[data-course-video]");
  var promoEl = document.querySelector("[data-course-promo]");
  var activeEl = document.querySelector("[data-active-course]");
  var pastEl = document.querySelector("[data-past-courses]");
  var marqueeSection = document.querySelector("[data-review-marquee-section]");
  var marqueeTrack = document.querySelector("[data-review-track]");

  /* ---------- Hilfsfunktionen ---------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }

  function formatWhen(c) {
    var mode = c.date_mode || "datetime";
    if (mode === "range") {
      var a = formatDate(c.event_date) + (c.event_time ? ", " + c.event_time + " Uhr" : "");
      var b = formatDate(c.event_end_date) + (c.event_end_time ? ", " + c.event_end_time + " Uhr" : "");
      if (a && b) return a + " – " + b;
      return a || b;
    }
    if (mode === "date") return formatDate(c.event_date);
    return formatDate(c.event_date) + (c.event_time ? ", " + c.event_time + " Uhr" : "");
  }

  // Wandelt eine Video-URL (YouTube/Vimeo) in eine Embed-URL um.
  function toEmbedUrl(url) {
    if (!url) return "";
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];
    var vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vim) return "https://player.vimeo.com/video/" + vim[1];
    return url;
  }

  function renderVideo(setting) {
    if (!videoEl) return;
    if (!setting || !setting.url) { videoEl.style.display = "none"; return; }
    if (setting.type === "file") {
      var v = document.createElement("video");
      v.src = window.SB.imgUrl(setting.url);
      v.controls = true;
      v.preload = "metadata";
      videoEl.appendChild(v);
    } else {
      var frame = document.createElement("iframe");
      frame.src = toEmbedUrl(setting.url);
      frame.title = "Kurs-Video";
      frame.loading = "lazy";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      videoEl.appendChild(frame);
    }
  }

  /* ---------- Globale Inhalte (Video + Werbetext) ---------- */
  sb.from("site_settings")
    .select("key,value")
    .in("key", ["courses_video", "courses_promo_text"])
    .then(function (res) {
      if (res.error) { console.error("Kurse-Einstellungen:", res.error.message); return; }
      var map = {};
      (res.data || []).forEach(function (r) { map[r.key] = r.value; });
      renderVideo(map.courses_video);
      if (promoEl) {
        var promo = map.courses_promo_text;
        var html = promo && typeof promo === "object" && promo.html ? promo.html
          : (typeof promo === "string" ? promo : "");
        if (html) promoEl.innerHTML = html;
        else promoEl.style.display = "none";
      }
    });

  /* ---------- Kurse laden ---------- */
  Promise.all([
    sb.from("courses").select("*").eq("status", "active").maybeSingle(),
    sb.from("courses").select("*").eq("status", "past").order("event_date", { ascending: false }).order("sort_order", { ascending: true }),
  ]).then(function (results) {
    var active = results[0] && results[0].data ? results[0].data : null;
    var past = results[1] && results[1].data ? results[1].data : [];

    var courseIds = [];
    if (active) courseIds.push(active.id);
    past.forEach(function (c) { courseIds.push(c.id); });

    if (!courseIds.length) {
      renderActive(null, {});
      renderPast([], {});
      return;
    }

    sb.from("course_images")
      .select("course_id,image_url,sort_order")
      .in("course_id", courseIds)
      .order("sort_order", { ascending: true })
      .then(function (imgRes) {
        var byCourse = {};
        (imgRes.data || []).forEach(function (img) {
          (byCourse[img.course_id] = byCourse[img.course_id] || []).push(img.image_url);
        });

        var openActive = active && active.signup_open !== false ? active : null;
        var closedActive = active && active.signup_open === false ? active : null;

        var activeSection = activeEl.closest ? activeEl.closest(".courses-block") : null;
        if (activeSection) activeSection.style.display = "";
        renderActive(openActive, byCourse);

        var pastDisplay = past.slice();
        if (closedActive) {
          closedActive._activeMarker = true;
          pastDisplay.unshift(closedActive);
        }
        renderPast(pastDisplay, byCourse);
      });
  });

  /* ---------- Aktiver Kurs ---------- */
  function renderActive(course, imagesByCourse) {
    if (!activeEl) return;
    activeEl.innerHTML = "";
    if (!course) {
      var info = document.createElement("p");
      info.className = "course-empty";
      info.textContent = "Aktuell gibt es keine Kurse zum Anmelden.";
      activeEl.appendChild(info);
      return;
    }

    var images = imagesByCourse[course.id] || [];
    var card = document.createElement("div");
    card.className = "course-active-card";

    var show = document.createElement("div");
    show.className = "course-slideshow";
    if (images.length) {
      images.forEach(function (url, i) {
        var slide = document.createElement("div");
        slide.className = "course-slide" + (i === 0 ? " active" : "");
        var im = document.createElement("img");
        im.src = window.SB.imgUrl(url);
        im.alt = course.name || "";
        im.loading = "lazy";
        slide.appendChild(im);
        show.appendChild(slide);
      });
    } else {
      show.classList.add("is-empty");
    }
    card.appendChild(show);

    var body = document.createElement("div");
    body.className = "course-active-info";

    var badge = document.createElement("span");
    badge.className = "course-badge";
    badge.textContent = "Anmeldung offen";
    body.appendChild(badge);

    var h2 = document.createElement("h2");
    h2.textContent = course.name || "";
    body.appendChild(h2);

    var meta = document.createElement("ul");
    meta.className = "course-meta";
    if (course.event_date || course.event_end_date) meta.appendChild(metaItem(course.date_mode === "range" ? "Zeitraum" : "Datum", formatWhen(course)));
    var place = formatPlace(course);
    if (place) meta.appendChild(metaItem("Ort", place));
    if (course.price) meta.appendChild(metaItem("Preis", course.price));
    body.appendChild(meta);

    // Teilnehmer-Anzeige (Live-Zähler)
    var capacityEl = document.createElement("div");
    capacityEl.className = "course-capacity";
    body.appendChild(capacityEl);

    if (course.description) {
      var desc = document.createElement("div");
      desc.className = "course-desc prose";
      desc.innerHTML = course.description;
      body.appendChild(desc);
    }

    var cta = document.createElement("a");
    cta.className = "btn course-signup-btn";
    cta.href = "kurs-anmeldung.html";
    cta.textContent = "Jetzt anmelden";
    body.appendChild(cta);

    card.appendChild(body);
    activeEl.appendChild(card);

    renderCapacity(capacityEl, course, cta);
    if (images.length > 1) startSlideshow(show);
  }

  function renderCapacity(el, course, cta) {
    sb.rpc("course_signup_count", { p_course_id: course.id }).then(function (res) {
      var count = (res && typeof res.data === "number") ? res.data : 0;
      var max = course.max_participants;
      if (max && max > 0) {
        var free = Math.max(0, max - count);
        var pct = Math.min(100, Math.round((count / max) * 100));
        var full = count >= max;
        var bar = '<div class="course-capacity-bar"><span style="width:' + pct + '%"></span></div>';
        var label = full
          ? '<strong class="course-capacity-full">Ausgebucht</strong>'
          : '<strong>' + count + " / " + max + " Plätzen belegt</strong> · noch " + free + " frei";
        el.innerHTML = '<span class="course-capacity-label">' + label + "</span>" + bar;
        if (full && cta) {
          cta.classList.add("is-disabled");
          cta.textContent = "Ausgebucht";
          cta.removeAttribute("href");
        }
      } else {
        el.innerHTML = '<span class="course-capacity-label"><strong>' + count + "</strong> Anmeldung" + (count === 1 ? "" : "en") + "</span>";
      }
    });
  }

  function metaItem(label, value) {
    var li = document.createElement("li");
    var b = document.createElement("strong");
    b.textContent = label + ": ";
    li.appendChild(b);
    li.appendChild(document.createTextNode(value));
    return li;
  }

  function formatPlace(c) {
    var line1 = [c.address_street, c.address_number].filter(Boolean).join(" ");
    var line2 = [c.address_zip, c.address_city].filter(Boolean).join(" ");
    var addr = [line1, line2].filter(Boolean).join(", ");
    if (c.location && addr) return c.location + ", " + addr;
    return c.location || addr || "";
  }

  function startSlideshow(container) {
    var slides = container.querySelectorAll(".course-slide");
    var idx = 0;
    setInterval(function () {
      slides[idx].classList.remove("active");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("active");
    }, 5000);
  }

  /* ---------- Vergangene Kurse ---------- */
  function renderPast(courses, imagesByCourse) {
    if (!pastEl) return;
    pastEl.innerHTML = "";
    if (!courses.length) return;

    var title = document.createElement("h2");
    title.className = "section-title";
    title.textContent = "Vergangene Kurse";
    pastEl.appendChild(title);

    var grid = document.createElement("div");
    grid.className = "past-courses-grid";

    courses.forEach(function (course) {
      var images = imagesByCourse[course.id] || [];
      var card = document.createElement("div");
      card.className = "past-course-card" + (course._activeMarker ? " is-active" : "");

      var thumb = document.createElement("div");
      thumb.className = "past-course-thumb";
      if (course._activeMarker) {
        var marker = document.createElement("span");
        marker.className = "past-course-active-badge";
        marker.textContent = "Aktiv, Anmeldung geschlossen";
        thumb.appendChild(marker);
      }
      if (images.length) {
        var im = document.createElement("img");
        im.src = window.SB.imgUrl(images[0]);
        im.alt = course.name || "";
        im.loading = "lazy";
        thumb.appendChild(im);
        if (images.length > 1) {
          var count = document.createElement("span");
          count.className = "past-course-count";
          count.textContent = images.length + " Bilder";
          thumb.appendChild(count);
        }
        thumb.style.cursor = "pointer";
        thumb.addEventListener("click", function () { openLightbox(images, 0); });
      } else {
        thumb.classList.add("is-empty");
      }
      card.appendChild(thumb);

      var info = document.createElement("div");
      info.className = "past-course-info";
      var h3 = document.createElement("h3");
      h3.textContent = course.name || "";
      info.appendChild(h3);
      if (course.event_date || course.event_end_date) {
        var date = document.createElement("span");
        date.className = "past-course-date";
        date.textContent = formatWhen(course);
        info.appendChild(date);
      }
      if (course.location) {
        var loc = document.createElement("span");
        loc.className = "past-course-loc";
        loc.textContent = course.location;
        info.appendChild(loc);
      }
      card.appendChild(info);

      grid.appendChild(card);
    });

    pastEl.appendChild(grid);
  }

  /* ---------- Bewertungs-Laufband ---------- */
  function wordCount(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }

  function starString(n) {
    n = n || 0;
    var out = "";
    for (var i = 1; i <= 5; i++) out += i <= n ? "★" : "☆";
    return out;
  }

  function loadMarquee() {
    if (!marqueeTrack || !marqueeSection) return;
    sb.from("reviews").select("id,text,stars,show_in_marquee,author_name").or("show_in_marquee.eq.true,stars.eq.5")
      .then(function (r) {
        if (r.error) return;
        var reviews = (r.data || []).filter(function (rv) {
          if (rv.show_in_marquee) return true;
          return rv.stars === 5 && rv.text && wordCount(rv.text) < 15;
        });
        if (!reviews.length) return;

        marqueeTrack.innerHTML = "";
        // Karten zweimal einfügen für nahtlose Endlosschleife
        [0, 1].forEach(function () {
          reviews.forEach(function (rv) {
            marqueeTrack.appendChild(buildReviewCard(rv));
          });
        });
        marqueeSection.style.display = "";
      });
  }

  function buildReviewCard(rv) {
    var card = document.createElement("div");
    card.className = "review-card";
    if (rv.stars) {
      var stars = document.createElement("div");
      stars.className = "review-stars";
      stars.textContent = starString(rv.stars);
      card.appendChild(stars);
    }
    var text = document.createElement("p");
    text.className = "review-text";
    text.textContent = rv.text || "";
    card.appendChild(text);
    var meta = document.createElement("span");
    meta.className = "review-meta";
    meta.textContent = rv.author_name ? "– " + rv.author_name : "– Teilnehmer/in";
    card.appendChild(meta);
    return card;
  }

  loadMarquee();

  /* ---------- Website-Quiz ---------- */
  var siteQuizSection = document.querySelector("[data-site-quiz-section]");
  var siteQuizList = document.querySelector("[data-site-quiz-list]");
  var siteQuizDone = document.querySelector("[data-site-quiz-done]");

  function loadSiteQuiz() {
    if (!siteQuizSection || !siteQuizList) return;
    sb.rpc("get_site_quiz").then(function (res) {
      if (res.error || !res.data || !res.data.enabled) return;
      var questions = res.data.questions || [];
      if (!questions.length) return;
      renderSiteQuiz(questions);
      siteQuizSection.style.display = "";
    });
  }

  var SITE_QUIZ_STORE = "site_quiz_answered";
  function getAnsweredSet() {
    try { return JSON.parse(localStorage.getItem(SITE_QUIZ_STORE) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function markAnswered(qid) {
    var s = getAnsweredSet();
    s[qid] = true;
    try { localStorage.setItem(SITE_QUIZ_STORE, JSON.stringify(s)); } catch (e) { /* ignorieren */ }
  }

  function revealSiteQuizAnswers(optionsWrap, answers) {
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

  function renderSiteQuiz(questions) {
    siteQuizList.innerHTML = "";
    var answeredSet = getAnsweredSet();
    var answeredCount = 0;
    questions.forEach(function (q, index) {
      var card = document.createElement("div");
      card.className = "quiz-card site-quiz-card";

      var num = document.createElement("span");
      num.className = "quiz-number";
      num.textContent = "Frage " + (index + 1) + " / " + questions.length;
      card.appendChild(num);

      if (q.media_type && q.media_type !== "none" && q.media_url) {
        card.appendChild(buildQuizMedia(q));
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
          revealSiteQuizAnswers(optionsWrap, answers);
          card.classList.add("revealed");
          btn.style.display = "none";
          markAnswered(q.id);
          answeredCount++;
          if (answeredCount >= questions.length && siteQuizDone) siteQuizDone.hidden = false;
        });
      });
      card.appendChild(btn);

      // Bereits auf diesem Gerät beantwortet: nur Lösungen anzeigen (kein erneutes Absenden)
      if (answeredSet[q.id]) {
        revealSiteQuizAnswers(optionsWrap, answers);
        card.classList.add("revealed");
        btn.style.display = "none";
        answeredCount++;
      }

      siteQuizList.appendChild(card);
    });

    if (answeredCount >= questions.length && siteQuizDone) siteQuizDone.hidden = false;
  }

  function buildQuizMedia(q) {
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

  loadSiteQuiz();

  /* ---------- Lightbox ---------- */
  var lb = document.querySelector("[data-lightbox]");
  var lbImg = document.querySelector("[data-lightbox-img]");
  var lbImages = [];
  var lbIndex = 0;

  function openLightbox(images, start) {
    if (!lb || !images.length) return;
    lbImages = images;
    lbIndex = start || 0;
    updateLightbox();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = "";
  }
  function updateLightbox() {
    if (lbImg) lbImg.src = window.SB.imgUrl(lbImages[lbIndex]);
  }
  function step(dir) {
    lbIndex = (lbIndex + dir + lbImages.length) % lbImages.length;
    updateLightbox();
  }

  if (lb) {
    document.querySelector("[data-lightbox-close]").addEventListener("click", closeLightbox);
    document.querySelector("[data-lightbox-prev]").addEventListener("click", function () { step(-1); });
    document.querySelector("[data-lightbox-next]").addEventListener("click", function () { step(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }
})();
