/* Gemeinsame Bausteine für die Bewertungs-Verwaltung (Karten, Switches,
   Modal zum Hinzufügen). Wird von kurs-admin.js und bewertungen-admin.js genutzt.
   Kontext (ctx): { sb, toast, reload, courseNames?, courseId?, courseList? } */
(function () {
  window.ReviewCards = {};

  function starString(n) {
    n = n || 0;
    var out = "";
    for (var i = 1; i <= 5; i++) out += i <= n ? "★" : "☆";
    return out;
  }
  window.ReviewCards.starString = starString;

  function switchToggle(label, checked, onChange) {
    var wrap = document.createElement("label");
    wrap.className = "switch switch-sm";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!checked;
    cb.addEventListener("change", async function () {
      var ok = await onChange(cb.checked);
      if (ok === false) cb.checked = !cb.checked;
    });
    wrap.appendChild(cb);
    var sl = document.createElement("span");
    sl.className = "switch-slider";
    wrap.appendChild(sl);
    var t = document.createElement("span");
    t.className = "switch-label";
    t.textContent = label;
    wrap.appendChild(t);
    return wrap;
  }

  async function upd(ctx, id, patch) {
    var up = await ctx.sb.from("reviews").update(patch).eq("id", id);
    if (up.error) { ctx.toast("Fehler: " + up.error.message, "error"); return false; }
    ctx.toast("Gespeichert.", "success");
    return true;
  }

  window.ReviewCards.renderList = function (container, reviews, ctx) {
    container.innerHTML = "";
    if (!reviews.length) {
      container.innerHTML = "<p class=\"admin-block-sub\">Noch keine Bewertungen.</p>";
      return;
    }
    var grid = document.createElement("div");
    grid.className = "review-adm-grid";
    reviews.forEach(function (r) {
      var card = document.createElement("div");
      card.className = "review-adm-card";

      var top = document.createElement("div");
      top.className = "review-adm-top";
      var stars = document.createElement("div");
      stars.className = "review-adm-stars";
      stars.textContent = r.stars ? starString(r.stars) : "";
      top.appendChild(stars);
      var meta = document.createElement("span");
      meta.className = "review-adm-meta";
      var parts = [];
      if (r.author_name) parts.push(r.author_name);
      var cName = (ctx.courseNames && ctx.courseNames[r.course_id]) || r.course_name;
      if (cName) parts.push(cName + (r.course_id ? "" : " (gelöscht)"));
      if (r.created_at) parts.push(new Date(r.created_at).toLocaleDateString("de-DE"));
      meta.textContent = parts.join(" · ");
      top.appendChild(meta);
      card.appendChild(top);

      var qText = (ctx.questionNames && ctx.questionNames[r.question_id]) || null;
      if (qText) {
        var q = document.createElement("p");
        q.className = "review-adm-question";
        q.textContent = qText;
        card.appendChild(q);
      }

      var text = document.createElement("p");
      text.className = "review-adm-text";
      text.textContent = r.text || "(kein Text)";
      card.appendChild(text);

      var ctr = document.createElement("div");
      ctr.className = "review-adm-controls";
      ctr.appendChild(switchToggle("Auf Seite", r.show_on_page, function (v) { return upd(ctx, r.id, { show_on_page: v }); }));
      ctr.appendChild(switchToggle("Laufband", r.show_in_marquee, function (v) { return upd(ctx, r.id, { show_in_marquee: v }); }));
      var del = document.createElement("button");
      del.className = "btn btn-small btn-danger review-adm-del";
      del.textContent = "Löschen";
      del.addEventListener("click", async function () {
        if (!window.confirm("Diese Bewertung löschen?")) return;
        var dr = await ctx.sb.from("reviews").delete().eq("id", r.id);
        if (dr.error) { ctx.toast("Fehler: " + dr.error.message, "error"); return; }
        ctx.reload();
        ctx.toast("Bewertung gelöscht.", "success");
      });
      ctr.appendChild(del);
      card.appendChild(ctr);

      grid.appendChild(card);
    });
    container.appendChild(grid);
  };

  window.ReviewCards.openAddForm = function (ctx) {
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    var modal = document.createElement("div");
    modal.className = "modal-card";

    var header = document.createElement("div");
    header.className = "modal-head";
    var title = document.createElement("h3");
    title.textContent = "Bewertung hinzufügen";
    header.appendChild(title);
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "modal-close";
    closeBtn.setAttribute("aria-label", "Schließen");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var form = document.createElement("form");
    form.className = "admin-form modal-form";

    // Kurs-Auswahl (nur kursübergreifend)
    var courseSelect = null;
    if (ctx.courseList) {
      var cl = document.createElement("label");
      cl.textContent = "Kurs";
      courseSelect = document.createElement("select");
      ctx.courseList.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name + (c.event_date ? " (" + c.event_date + ")" : "");
        courseSelect.appendChild(opt);
      });
      if (ctx.courseId) courseSelect.value = ctx.courseId;
      cl.appendChild(courseSelect);
      form.appendChild(cl);
    }

    var nameLabel = document.createElement("label");
    nameLabel.textContent = "Name (optional)";
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);

    var starLabel = document.createElement("label");
    starLabel.className = "modal-sublabel";
    starLabel.textContent = "Sterne (optional)";
    form.appendChild(starLabel);
    var starWrap = document.createElement("div");
    starWrap.className = "review-stars-input";
    starWrap.setAttribute("data-stars", "0");
    function paintStars(n) {
      Array.prototype.slice.call(starWrap.querySelectorAll(".review-star-btn")).forEach(function (s, i2) {
        s.textContent = i2 < n ? "★" : "☆";
        s.classList.toggle("on", i2 < n);
      });
    }
    for (var i = 1; i <= 5; i++) {
      (function (val) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "review-star-btn";
        b.textContent = "☆";
        b.addEventListener("click", function () {
          var cur = parseInt(starWrap.getAttribute("data-stars"), 10) || 0;
          var next = cur === val ? 0 : val; // erneutes Klicken hebt auf
          starWrap.setAttribute("data-stars", String(next));
          paintStars(next);
        });
        b.addEventListener("mouseenter", function () { paintStars(val); });
        starWrap.appendChild(b);
      })(i);
    }
    starWrap.addEventListener("mouseleave", function () {
      paintStars(parseInt(starWrap.getAttribute("data-stars"), 10) || 0);
    });
    form.appendChild(starWrap);

    var textLabel = document.createElement("label");
    textLabel.textContent = "Text";
    var textArea = document.createElement("textarea");
    textArea.rows = 3;
    textLabel.appendChild(textArea);
    form.appendChild(textLabel);

    var checks = document.createElement("div");
    checks.className = "modal-checks";
    var onPage = document.createElement("label");
    onPage.className = "review-toggle";
    var onPageCb = document.createElement("input");
    onPageCb.type = "checkbox";
    onPageCb.checked = true;
    onPage.appendChild(onPageCb);
    onPage.appendChild(document.createTextNode(" Auf Bewertungsseite anzeigen"));
    checks.appendChild(onPage);
    var inMarquee = document.createElement("label");
    inMarquee.className = "review-toggle";
    var inMarqueeCb = document.createElement("input");
    inMarqueeCb.type = "checkbox";
    inMarquee.appendChild(inMarqueeCb);
    inMarquee.appendChild(document.createTextNode(" Im Laufband anzeigen"));
    checks.appendChild(inMarquee);
    form.appendChild(checks);

    var actions = document.createElement("div");
    actions.className = "admin-actions modal-actions";
    var save = document.createElement("button");
    save.type = "submit";
    save.className = "btn";
    save.textContent = "Hinzufügen";
    actions.appendChild(save);
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline";
    cancel.textContent = "Abbrechen";
    cancel.addEventListener("click", close);
    actions.appendChild(cancel);
    form.appendChild(actions);

    var err = document.createElement("p");
    err.className = "admin-error";
    form.appendChild(err);

    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    function close() {
      overlay.remove();
      document.body.style.overflow = "";
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.textContent = "";
      var courseId = courseSelect ? courseSelect.value : ctx.courseId;
      if (!courseId) { err.textContent = "Bitte einen Kurs wählen."; return; }
      var stars = parseInt(starWrap.getAttribute("data-stars"), 10) || 0;
      var text = textArea.value.trim();
      if (!text && !stars) { err.textContent = "Bitte Text oder Sterne angeben."; return; }
      save.disabled = true;
      save.textContent = "Speichern …";
      var res = await ctx.sb.from("reviews").insert({
        course_id: courseId,
        author_name: nameInput.value.trim() || null,
        text: text || null,
        stars: stars || null,
        show_on_page: onPageCb.checked,
        show_in_marquee: inMarqueeCb.checked,
      });
      if (res.error) { err.textContent = "Fehler: " + res.error.message; save.disabled = false; save.textContent = "Hinzufügen"; return; }
      close();
      ctx.reload();
      ctx.toast("Bewertung hinzugefügt.", "success");
    });
  };
})();
