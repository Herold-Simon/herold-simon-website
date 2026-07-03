/* Kurs-Verwaltung: Eigenschaften, Bilder, angemeldete Teilnehmer.
   Aktiv/Abschließen-Lifecycle. (Quiz & Bewertungen folgen in Phase 2/3.) */
(function () {
  var sb = window.SB.get();

  var gate = document.querySelector("[data-gate]");
  var adminView = document.querySelector("[data-admin-view]");
  var logoutLink = document.querySelector("[data-logout]");

  var titleEl = document.querySelector("[data-course-title]");
  var statusLineEl = document.querySelector("[data-course-status-line]");
  var courseForm = document.querySelector("[data-course-form]");
  var activateBtn = document.querySelector("[data-activate-btn]");
  var finishBtn = document.querySelector("[data-finish-btn]");
  var imagesBlock = document.querySelector("[data-images-block]");
  var imagesForm = document.querySelector("[data-course-images-form]");
  var imagesListEl = document.querySelector("[data-course-images-list]");
  var regsEl = document.querySelector("[data-registrations]");

  var courseId = new URLSearchParams(window.location.search).get("id");
  var currentCourse = null;
  var imagesCache = [];
  var dragCell = null;

  /* ---------- Toast ---------- */
  var toastEl = document.querySelector("[data-toast]");
  var toastTimer = null;
  function toast(msg, type) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "admin-toast show" + (type ? " " + type : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "admin-toast"; }, 3000);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- Platzhalter im Verwendungszweck ---------- */
  var placeholderInput = document.querySelector("[data-placeholder-input]");
  var placeholderPreview = document.querySelector("[data-placeholder-preview]");

  function updatePlaceholderPreview() {
    if (!placeholderInput || !placeholderPreview) return;
    var val = placeholderInput.value;
    if (!val || val.indexOf("{name}") === -1) {
      placeholderPreview.textContent = "";
      return;
    }
    var example = val.replace(/\{\s*name\s*\}/gi, "Max Mustermann");
    placeholderPreview.textContent = "Vorschau: " + example;
  }

  Array.prototype.slice.call(document.querySelectorAll("[data-insert-placeholder]")).forEach(function (chip) {
    chip.addEventListener("click", function () {
      if (!placeholderInput) return;
      var token = chip.getAttribute("data-insert-placeholder");
      var start = placeholderInput.selectionStart;
      var end = placeholderInput.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        var before = placeholderInput.value.slice(0, start);
        var after = placeholderInput.value.slice(end);
        var needSpace = before && !/\s$/.test(before) ? " " : "";
        placeholderInput.value = before + needSpace + token + after;
        var pos = (before + needSpace + token).length;
        placeholderInput.focus();
        placeholderInput.setSelectionRange(pos, pos);
      } else {
        placeholderInput.value += (placeholderInput.value ? " " : "") + token;
        placeholderInput.focus();
      }
      updatePlaceholderPreview();
    });
  });

  if (placeholderInput) placeholderInput.addEventListener("input", updatePlaceholderPreview);

  /* ---------- Quill ---------- */
  var descQuill = new Quill("#course-desc-editor", {
    theme: "snow",
    placeholder: "Kursbeschreibung …",
    modules: { toolbar: [[{ header: [2, 3, false] }], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"], ["clean"]] },
  });
  var noteQuill = new Quill("#course-note-editor", {
    theme: "snow",
    placeholder: "z. B. Bitte bringen Sie … mit.",
    modules: { toolbar: [[{ header: [3, false] }], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"], ["clean"]] },
  });
  function getHtml(q) {
    var html = q.root.innerHTML;
    if (html === "<p><br></p>" || html === "<p></p>") return "";
    return html;
  }
  function setHtml(q, html) { q.setText(""); if (html) q.clipboard.dangerouslyPasteHTML(html); }

  /* ---------- Upload ---------- */
  async function uploadFile(bucket, file) {
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    var name = Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext;
    var up = await sb.storage.from(bucket).upload(name, file, { cacheControl: "3600", upsert: false });
    if (up.error) throw up.error;
    return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }
  function storagePathFromUrl(url) {
    var marker = "/storage/v1/object/public/courses/";
    var idx = (url || "").indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  /* ---------- Init / Auth ---------- */
  (async function init() {
    var session = (await sb.auth.getSession()).data.session;
    if (!session) { window.location.href = "admin.html"; return; }
    if (gate) gate.style.display = "none";
    adminView.style.display = "";
    if (logoutLink) logoutLink.style.display = "";

    if (courseId) {
      await loadCourse();
    } else {
      titleEl.textContent = "Neuer Kurs";
      statusLineEl.textContent = "Speichern, um den Kurs anzulegen.";
      setViewEnabled(false);
    }
  })();

  if (logoutLink) {
    logoutLink.addEventListener("click", async function (e) {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = "admin.html";
    });
  }

  /* ---------- View-Umschaltung ---------- */
  document.querySelectorAll("[data-view-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.hasAttribute("disabled")) return;
      var view = btn.getAttribute("data-view-btn");
      document.querySelectorAll("[data-view-btn]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      document.querySelectorAll("[data-view]").forEach(function (sec) {
        sec.hidden = sec.getAttribute("data-view") !== view;
      });
      if (view === "users") loadRegistrations();
      if (view === "quiz") loadQuiz();
      if (view === "reviews") loadReviewsAdmin();
      if (view === "results") { loadResults(); startResultsAuto(); }
      else stopResultsAuto();
    });
  });

  function setViewEnabled(hasCourse) {
    document.querySelectorAll("[data-needs-course]").forEach(function (btn) {
      if (hasCourse) btn.removeAttribute("disabled");
      else btn.setAttribute("disabled", "disabled");
    });
    if (imagesBlock) imagesBlock.style.display = hasCourse ? "" : "none";
    if (activateBtn) activateBtn.style.display = hasCourse ? "" : "none";
    if (finishBtn) finishBtn.style.display = hasCourse ? "" : "none";
  }

  function statusLabel(s) {
    if (s === "active") return "Aktiv";
    if (s === "past") return "Vergangen";
    return "Entwurf";
  }

  function reflectCourse() {
    titleEl.textContent = currentCourse.name || "Kurs";
    statusLineEl.innerHTML = 'Status: <span class="course-status-badge status-' + (currentCourse.status || "draft") + '">' + statusLabel(currentCourse.status) + "</span>";
    if (activateBtn) {
      activateBtn.style.display = currentCourse.status === "active" ? "none" : "";
    }
    if (finishBtn) {
      finishBtn.style.display = currentCourse.status === "past" ? "none" : "";
    }
  }

  /* ---------- Kurs laden ---------- */
  async function loadCourse() {
    var res = await sb.from("courses").select("*").eq("id", courseId).maybeSingle();
    if (res.error || !res.data) { toast("Kurs nicht gefunden.", "error"); return; }
    currentCourse = res.data;
    fillForm(currentCourse);
    setViewEnabled(true);
    reflectCourse();
    loadImages();
  }

  function fillForm(c) {
    courseForm.name.value = c.name || "";
    setHtml(descQuill, c.description || "");
    courseForm.event_date.value = c.event_date || "";
    courseForm.event_time.value = c.event_time || "";
    courseForm.location.value = c.location || "";
    courseForm.address_street.value = c.address_street || "";
    courseForm.address_number.value = c.address_number || "";
    courseForm.address_zip.value = c.address_zip || "";
    courseForm.address_city.value = c.address_city || "";
    courseForm.price.value = c.price || "";
    courseForm.max_participants.value = c.max_participants != null ? c.max_participants : "";
    courseForm.bank_recipient.value = c.bank_recipient || "";
    courseForm.iban.value = c.iban || "";
    courseForm.payment_reference.value = c.payment_reference || "";
    updatePlaceholderPreview();
    setHtml(noteQuill, c.extra_note || "");
  }

  /* ---------- Speichern ---------- */
  courseForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = document.querySelector("[data-course-error]");
    err.textContent = "";
    var name = courseForm.name.value.trim();
    if (!name) { err.textContent = "Bitte einen Kursnamen angeben."; return; }

    var btn = courseForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Speichern …";

    var row = {
      name: name,
      description: getHtml(descQuill),
      event_date: courseForm.event_date.value || null,
      event_time: courseForm.event_time.value.trim() || null,
      location: courseForm.location.value.trim() || null,
      address_street: courseForm.address_street.value.trim() || null,
      address_number: courseForm.address_number.value.trim() || null,
      address_zip: courseForm.address_zip.value.trim() || null,
      address_city: courseForm.address_city.value.trim() || null,
      price: courseForm.price.value.trim() || null,
      max_participants: courseForm.max_participants.value ? parseInt(courseForm.max_participants.value, 10) : null,
      bank_recipient: courseForm.bank_recipient.value.trim() || null,
      iban: courseForm.iban.value.trim() || null,
      payment_reference: courseForm.payment_reference.value.trim() || null,
      extra_note: getHtml(noteQuill),
      updated_at: new Date().toISOString(),
    };

    try {
      if (currentCourse) {
        var upd = await sb.from("courses").update(row).eq("id", currentCourse.id);
        if (upd.error) throw upd.error;
        currentCourse = Object.assign(currentCourse, row);
        reflectCourse();
        toast("Kurs gespeichert.", "success");
      } else {
        var ins = await sb.from("courses").insert(row).select().single();
        if (ins.error) throw ins.error;
        currentCourse = ins.data;
        courseId = currentCourse.id;
        history.replaceState(null, "", "kurs-admin.html?id=" + encodeURIComponent(courseId));
        setViewEnabled(true);
        reflectCourse();
        loadImages();
        toast("Kurs angelegt.", "success");
      }
    } catch (ex) {
      err.textContent = "Fehler beim Speichern: " + (ex.message || ex);
    } finally {
      btn.disabled = false;
      btn.textContent = "Speichern";
    }
  });

  /* ---------- Aktiv setzen ---------- */
  if (activateBtn) {
    activateBtn.addEventListener("click", async function () {
      if (!currentCourse) return;
      if (!window.confirm("Diesen Kurs als aktiven Kurs setzen? Ein evtl. bisher aktiver Kurs wird zum Entwurf.")) return;
      try {
        var clear = await sb.from("courses").update({ status: "draft" }).eq("status", "active").neq("id", currentCourse.id);
        if (clear.error) throw clear.error;
        var res = await sb.from("courses").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", currentCourse.id);
        if (res.error) throw res.error;
        currentCourse.status = "active";
        reflectCourse();
        toast("Kurs ist jetzt aktiv.", "success");
      } catch (ex) {
        toast("Fehler: " + (ex.message || ex), "error");
      }
    });
  }

  /* ---------- Abschließen ---------- */
  if (finishBtn) {
    finishBtn.addEventListener("click", async function () {
      if (!currentCourse) return;
      if (!window.confirm("Kurs als abgeschlossen markieren? Er wird zu den vergangenen Kursen verschoben und die Quiz-Bilder/-Videos werden gelöscht.")) return;
      try {
        await deleteQuizMedia(currentCourse.id);
        var res = await sb.from("courses").update({ status: "past", updated_at: new Date().toISOString() }).eq("id", currentCourse.id);
        if (res.error) throw res.error;
        currentCourse.status = "past";
        reflectCourse();
        toast("Kurs abgeschlossen.", "success");
      } catch (ex) {
        toast("Fehler: " + (ex.message || ex), "error");
      }
    });
  }

  /* ---------- Bilder ---------- */
  if (imagesForm) {
    imagesForm.images.addEventListener("change", function () {
      var n = imagesForm.images.files.length;
      var hint = document.querySelector("[data-images-filecount]");
      if (hint) hint.textContent = n ? n + " Bild(er) ausgewählt" : "mehrere möglich";
    });

    imagesForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!currentCourse) return;
      var err = document.querySelector("[data-images-error]");
      err.textContent = "";
      var files = imagesForm.images.files;
      if (!files.length) { err.textContent = "Bitte mindestens ein Bild auswählen."; return; }
      var btn = imagesForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Lädt hoch …";
      try {
        var start = imagesCache.length;
        for (var i = 0; i < files.length; i++) {
          var url = await uploadFile("courses", files[i]);
          var res = await sb.from("course_images").insert({ course_id: currentCourse.id, image_url: url, sort_order: start + i });
          if (res.error) throw res.error;
        }
        imagesForm.reset();
        var hint = document.querySelector("[data-images-filecount]");
        if (hint) hint.textContent = "mehrere möglich";
        await loadImages();
        toast(files.length + " Bild(er) hochgeladen.", "success");
      } catch (ex) {
        err.textContent = "Fehler beim Hochladen: " + (ex.message || ex);
      } finally {
        btn.disabled = false; btn.textContent = "Hochladen";
      }
    });
  }

  async function loadImages() {
    if (!currentCourse || !imagesListEl) return;
    var res = await sb.from("course_images").select("*").eq("course_id", currentCourse.id).order("sort_order", { ascending: true });
    if (res.error) { imagesListEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    imagesCache = res.data || [];
    imagesListEl.innerHTML = "";
    imagesCache.forEach(function (g) {
      var cell = document.createElement("div");
      cell.className = "admin-gallery-cell";
      cell.setAttribute("data-id", g.id);
      cell.draggable = true;

      var img = document.createElement("img");
      img.src = window.SB.imgUrl(g.image_url);
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      cell.appendChild(img);

      var handle = document.createElement("span");
      handle.className = "gallery-drag-handle";
      handle.textContent = "⠿";
      cell.appendChild(handle);

      var del = document.createElement("button");
      del.className = "gallery-delete";
      del.type = "button";
      del.title = "Bild löschen";
      del.innerHTML = "&times;";
      del.addEventListener("click", function (ev) { ev.stopPropagation(); deleteImage(g); });
      cell.appendChild(del);

      cell.addEventListener("dragstart", function () {
        dragCell = cell;
        setTimeout(function () { cell.classList.add("dragging"); }, 0);
      });
      cell.addEventListener("dragend", function () {
        cell.classList.remove("dragging");
        dragCell = null;
        persistImageOrder();
      });

      imagesListEl.appendChild(cell);
    });
  }

  if (imagesListEl) {
    imagesListEl.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (!dragCell) return;
      var after = getAfterCell(imagesListEl, e.clientX, e.clientY);
      if (after == null) imagesListEl.appendChild(dragCell);
      else imagesListEl.insertBefore(dragCell, after);
    });
  }

  function getAfterCell(container, x, y) {
    var cells = Array.prototype.slice.call(container.querySelectorAll(".admin-gallery-cell:not(.dragging)"));
    var closest = null, closestDist = Infinity;
    cells.forEach(function (cell) {
      var box = cell.getBoundingClientRect();
      var cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      var dist = Math.hypot(x - cx, y - cy);
      if (dist < closestDist) { closestDist = dist; closest = { el: cell, cx: cx }; }
    });
    if (!closest) return null;
    return x < closest.cx ? closest.el : closest.el.nextElementSibling;
  }

  async function persistImageOrder() {
    var cells = Array.prototype.slice.call(imagesListEl.querySelectorAll(".admin-gallery-cell"));
    var updates = [];
    cells.forEach(function (cell, idx) {
      var id = cell.getAttribute("data-id");
      var g = imagesCache.find(function (x) { return String(x.id) === String(id); });
      if (g && g.sort_order !== idx) {
        g.sort_order = idx;
        updates.push(sb.from("course_images").update({ sort_order: idx }).eq("id", id));
      }
    });
    if (updates.length) {
      var results = await Promise.all(updates);
      var failed = results.find(function (r) { return r.error; });
      toast(failed ? "Reihenfolge konnte nicht gespeichert werden." : "Reihenfolge gespeichert.", failed ? "error" : "success");
    }
  }

  async function deleteImage(g) {
    if (!window.confirm("Dieses Bild wirklich löschen?")) return;
    var res = await sb.from("course_images").delete().eq("id", g.id);
    if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
    try {
      var path = storagePathFromUrl(g.image_url);
      if (path) await sb.storage.from("courses").remove([path]);
    } catch (e) { /* ignorieren */ }
    await loadImages();
    toast("Bild gelöscht.", "success");
  }

  /* ---------- Angemeldete Teilnehmer ---------- */
  async function loadRegistrations() {
    if (!currentCourse || !regsEl) return;
    regsEl.innerHTML = "<p class=\"admin-block-sub\">Wird geladen …</p>";
    var res = await sb.from("course_registrations").select("*").eq("course_id", currentCourse.id).order("created_at", { ascending: true });
    if (res.error) { regsEl.innerHTML = "<p>Fehler beim Laden: " + escapeHtml(res.error.message) + "</p>"; return; }
    var regs = res.data || [];
    if (!regs.length) { regsEl.innerHTML = "<p class=\"admin-block-sub\">Noch keine Anmeldungen.</p>"; return; }

    var table = document.createElement("table");
    table.className = "kurs-users-table";
    var thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Name</th><th>Kontakt</th><th>Angemeldet</th><th>Bezahlt</th><th></th></tr>";
    table.appendChild(thead);
    var tbody = document.createElement("tbody");

    regs.forEach(function (r) {
      var tr = document.createElement("tr");

      var tdName = document.createElement("td");
      tdName.textContent = r.name || "";
      tr.appendChild(tdName);

      var tdContact = document.createElement("td");
      var contact = [];
      if (r.email) contact.push(r.email);
      if (r.phone) contact.push(r.phone);
      tdContact.innerHTML = contact.map(escapeHtml).join("<br>");
      tr.appendChild(tdContact);

      var tdDate = document.createElement("td");
      tdDate.textContent = r.created_at ? new Date(r.created_at).toLocaleDateString("de-DE") : "";
      tr.appendChild(tdDate);

      var tdPaid = document.createElement("td");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!r.paid;
      cb.addEventListener("change", async function () {
        var up = await sb.from("course_registrations").update({ paid: cb.checked }).eq("id", r.id);
        if (up.error) { toast("Fehler: " + up.error.message, "error"); cb.checked = !cb.checked; return; }
        toast(cb.checked ? "Als bezahlt markiert." : "Als unbezahlt markiert.", "success");
      });
      tdPaid.appendChild(cb);
      tr.appendChild(tdPaid);

      var tdDel = document.createElement("td");
      var del = document.createElement("button");
      del.className = "btn btn-small btn-danger";
      del.textContent = "Löschen";
      del.addEventListener("click", async function () {
        if (!window.confirm('Anmeldung von "' + (r.name || "") + '" löschen?')) return;
        var dr = await sb.from("course_registrations").delete().eq("id", r.id);
        if (dr.error) { toast("Fehler: " + dr.error.message, "error"); return; }
        loadRegistrations();
        toast("Anmeldung gelöscht.", "success");
      });
      tdDel.appendChild(del);
      tr.appendChild(tdDel);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    regsEl.innerHTML = "";
    regsEl.appendChild(table);
  }

  /* ============================================================
     Quiz-Builder
     ============================================================ */
  var quizBuilderEl = document.querySelector("[data-quiz-builder]");
  var quizCache = [];
  var dragQ = null;

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  async function loadQuiz() {
    if (!currentCourse || !quizBuilderEl) return;
    var res = await sb.from("quiz_questions").select("*").eq("course_id", currentCourse.id).order("sort_order", { ascending: true });
    if (res.error) { quizBuilderEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    quizCache = res.data || [];
    renderQuiz();
  }

  function renderQuiz() {
    quizBuilderEl.innerHTML = "";
    if (!quizCache.length) {
      quizBuilderEl.innerHTML = "<p class=\"admin-block-sub\">Noch keine Fragen. Mit „+ Frage hinzufügen“ starten.</p>";
      return;
    }
    quizCache.forEach(function (q, idx) {
      quizBuilderEl.appendChild(buildQuestionCard(q, idx));
    });
  }

  function buildQuestionCard(q, idx) {
    var card = document.createElement("div");
    card.className = "quiz-edit-card";
    card.setAttribute("data-id", q.id);
    card.draggable = true;

    var head = document.createElement("div");
    head.className = "quiz-edit-head";
    var handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    head.appendChild(handle);
    var num = document.createElement("strong");
    num.textContent = "Frage " + (idx + 1);
    head.appendChild(num);
    card.appendChild(head);

    // Medien
    var mediaRow = document.createElement("div");
    mediaRow.className = "quiz-edit-media";
    var typeSel = document.createElement("select");
    typeSel.className = "quiz-media-type";
    [["none", "Kein Medium"], ["image", "Bild (Upload)"], ["video_file", "Video (Upload)"], ["video_embed", "Video-Link (YouTube/Vimeo)"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0]; opt.textContent = o[1];
      if (q.media_type === o[0]) opt.selected = true;
      typeSel.appendChild(opt);
    });
    mediaRow.appendChild(typeSel);

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.className = "quiz-media-file";
    fileInput.accept = q.media_type === "video_file" ? "video/*" : "image/*";

    var urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "quiz-media-url";
    urlInput.placeholder = "https://youtu.be/…";
    urlInput.value = q.media_type === "video_embed" ? (q.media_url || "") : "";

    var current = document.createElement("span");
    current.className = "quiz-media-current admin-block-sub";

    function updateMediaInputs() {
      var t = typeSel.value;
      fileInput.style.display = (t === "image" || t === "video_file") ? "" : "none";
      fileInput.accept = t === "video_file" ? "video/*" : "image/*";
      urlInput.style.display = t === "video_embed" ? "" : "none";
      if ((t === "image" || t === "video_file") && q.media_type === t && q.media_url) current.textContent = "Aktuelles Medium vorhanden.";
      else current.textContent = "";
    }
    typeSel.addEventListener("change", updateMediaInputs);
    mediaRow.appendChild(fileInput);
    mediaRow.appendChild(urlInput);
    mediaRow.appendChild(current);
    card.appendChild(mediaRow);
    updateMediaInputs();

    // Fragetext
    var qtext = document.createElement("textarea");
    qtext.className = "quiz-edit-text";
    qtext.rows = 2;
    qtext.placeholder = "Fragetext …";
    qtext.value = q.question_text || "";
    card.appendChild(qtext);

    // Antworten
    var ansLabel = document.createElement("p");
    ansLabel.className = "admin-block-sub";
    ansLabel.textContent = "Antworten (Häkchen = richtig, mehrere möglich):";
    card.appendChild(ansLabel);

    var ansWrap = document.createElement("div");
    ansWrap.className = "quiz-answers";
    card.appendChild(ansWrap);

    (q.answers && q.answers.length ? q.answers : []).forEach(function (a) {
      ansWrap.appendChild(buildAnswerRow(a));
    });

    var addAns = document.createElement("button");
    addAns.type = "button";
    addAns.className = "btn btn-small btn-outline";
    addAns.textContent = "+ Antwort";
    addAns.addEventListener("click", function () {
      ansWrap.appendChild(buildAnswerRow({ id: genId(), text: "", correct: false }));
    });
    card.appendChild(addAns);

    // Aktionen
    var actions = document.createElement("div");
    actions.className = "admin-actions quiz-edit-actions";
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-small";
    saveBtn.textContent = "Frage speichern";
    saveBtn.addEventListener("click", function () {
      saveQuestion(q, { typeSel: typeSel, fileInput: fileInput, urlInput: urlInput, qtext: qtext, ansWrap: ansWrap, saveBtn: saveBtn });
    });
    actions.appendChild(saveBtn);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "Frage löschen";
    delBtn.addEventListener("click", function () { deleteQuestion(q); });
    actions.appendChild(delBtn);
    card.appendChild(actions);

    // DnD
    card.addEventListener("dragstart", function (e) {
      if (e.target !== card) { e.preventDefault(); return; }
      dragQ = card;
      setTimeout(function () { card.classList.add("dragging"); }, 0);
    });
    card.addEventListener("dragend", function () {
      card.classList.remove("dragging");
      dragQ = null;
      persistQuizOrder();
    });

    return card;
  }

  function buildAnswerRow(a) {
    var row = document.createElement("div");
    row.className = "quiz-answer-row";
    row.setAttribute("data-aid", a.id || genId());

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "quiz-answer-correct";
    cb.checked = !!a.correct;
    row.appendChild(cb);

    var txt = document.createElement("input");
    txt.type = "text";
    txt.className = "quiz-answer-text";
    txt.placeholder = "Antworttext";
    txt.value = a.text || "";
    row.appendChild(txt);

    var del = document.createElement("button");
    del.type = "button";
    del.className = "quiz-answer-del";
    del.innerHTML = "&times;";
    del.title = "Antwort entfernen";
    del.addEventListener("click", function () { row.remove(); });
    row.appendChild(del);

    return row;
  }

  function collectAnswers(ansWrap) {
    return Array.prototype.slice.call(ansWrap.querySelectorAll(".quiz-answer-row")).map(function (row) {
      return {
        id: row.getAttribute("data-aid"),
        text: row.querySelector(".quiz-answer-text").value.trim(),
        correct: row.querySelector(".quiz-answer-correct").checked,
      };
    }).filter(function (a) { return a.text !== ""; });
  }

  async function saveQuestion(q, els) {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Speichern …";
    try {
      var mediaType = els.typeSel.value;
      var mediaUrl = q.media_url || null;
      if (mediaType === "video_embed") {
        mediaUrl = els.urlInput.value.trim() || null;
      } else if (mediaType === "image" || mediaType === "video_file") {
        if (els.fileInput.files[0]) {
          mediaUrl = await uploadFile("courses", els.fileInput.files[0]);
        } else if (q.media_type !== mediaType) {
          mediaUrl = q.media_type === "video_embed" ? null : q.media_url || null;
        }
      } else {
        mediaUrl = null;
      }

      var row = {
        question_text: els.qtext.value.trim(),
        media_type: mediaType,
        media_url: mediaUrl,
        answers: collectAnswers(els.ansWrap),
        updated_at: new Date().toISOString(),
      };
      var res = await sb.from("quiz_questions").update(row).eq("id", q.id);
      if (res.error) throw res.error;
      toast("Frage gespeichert.", "success");
      await loadQuiz();
    } catch (ex) {
      toast("Fehler: " + (ex.message || ex), "error");
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = "Frage speichern";
    }
  }

  async function deleteQuestion(q) {
    if (!window.confirm("Diese Frage wirklich löschen?")) return;
    try {
      if ((q.media_type === "image" || q.media_type === "video_file") && q.media_url) {
        var path = storagePathFromUrl(q.media_url);
        if (path) await sb.storage.from("courses").remove([path]);
      }
    } catch (e) { /* ignorieren */ }
    var res = await sb.from("quiz_questions").delete().eq("id", q.id);
    if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
    await loadQuiz();
    toast("Frage gelöscht.", "success");
  }

  if (quizBuilderEl) {
    quizBuilderEl.addEventListener("dragover", function (e) {
      if (!dragQ) return;
      e.preventDefault();
      var after = getAfterQuestion(e.clientY);
      if (after == null) quizBuilderEl.appendChild(dragQ);
      else quizBuilderEl.insertBefore(dragQ, after);
    });
  }
  function getAfterQuestion(y) {
    var cards = Array.prototype.slice.call(quizBuilderEl.querySelectorAll(".quiz-edit-card:not(.dragging)"));
    var closest = { offset: -Infinity, el: null };
    cards.forEach(function (c) {
      var box = c.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset: offset, el: c };
    });
    return closest.el;
  }
  async function persistQuizOrder() {
    var cards = Array.prototype.slice.call(quizBuilderEl.querySelectorAll(".quiz-edit-card"));
    var updates = [];
    cards.forEach(function (card, idx) {
      var id = card.getAttribute("data-id");
      var q = quizCache.find(function (x) { return String(x.id) === String(id); });
      if (q && q.sort_order !== idx) {
        q.sort_order = idx;
        updates.push(sb.from("quiz_questions").update({ sort_order: idx }).eq("id", id));
      }
    });
    if (updates.length) {
      var results = await Promise.all(updates);
      var failed = results.find(function (r) { return r.error; });
      toast(failed ? "Reihenfolge nicht gespeichert." : "Reihenfolge gespeichert.", failed ? "error" : "success");
      await loadQuiz();
    }
  }

  /* ---------- Frage hinzufügen ---------- */
  var quizAddBtn = document.querySelector("[data-quiz-add]");
  if (quizAddBtn) {
    quizAddBtn.addEventListener("click", async function () {
      if (!currentCourse) return;
      var res = await sb.from("quiz_questions").insert({
        course_id: currentCourse.id,
        sort_order: quizCache.length,
        question_text: "",
        media_type: "none",
        answers: [],
      });
      if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
      await loadQuiz();
      var cards = quizBuilderEl.querySelectorAll(".quiz-edit-card");
      if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ---------- Export / Import ---------- */
  var quizExportBtn = document.querySelector("[data-quiz-export]");
  if (quizExportBtn) {
    quizExportBtn.addEventListener("click", function () {
      var data = {
        version: 1,
        course: currentCourse ? currentCourse.name : "",
        questions: quizCache.map(function (q) {
          return {
            question_text: q.question_text,
            media_type: q.media_type,
            media_url: q.media_url,
            answers: (q.answers || []).map(function (a) { return { text: a.text, correct: !!a.correct }; }),
          };
        }),
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "quiz-" + (currentCourse ? currentCourse.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "kurs") + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  var quizImportBtn = document.querySelector("[data-quiz-import-btn]");
  var quizImportFile = document.querySelector("[data-quiz-import-file]");
  if (quizImportBtn && quizImportFile) {
    quizImportBtn.addEventListener("click", function () { quizImportFile.click(); });
    quizImportFile.addEventListener("change", async function () {
      var file = quizImportFile.files[0];
      if (!file || !currentCourse) return;
      try {
        var text = await file.text();
        var data = JSON.parse(text);
        var questions = (data && data.questions) || [];
        if (!Array.isArray(questions) || !questions.length) { toast("Keine Fragen in der Datei.", "error"); return; }
        if (!window.confirm(questions.length + " Frage(n) zu diesem Kurs hinzufügen?")) return;
        var start = quizCache.length;
        var rows = questions.map(function (q, i) {
          return {
            course_id: currentCourse.id,
            sort_order: start + i,
            question_text: q.question_text || "",
            media_type: ["none", "image", "video_file", "video_embed"].indexOf(q.media_type) !== -1 ? q.media_type : "none",
            media_url: q.media_url || null,
            answers: (q.answers || []).map(function (a) { return { id: genId(), text: a.text || "", correct: !!a.correct }; }),
          };
        });
        var res = await sb.from("quiz_questions").insert(rows);
        if (res.error) throw res.error;
        await loadQuiz();
        toast(rows.length + " Frage(n) importiert.", "success");
      } catch (ex) {
        toast("Import fehlgeschlagen: " + (ex.message || ex), "error");
      } finally {
        quizImportFile.value = "";
      }
    });
  }

  /* ---------- QR-Code ---------- */
  // Erzeugt einen QR-Code als PNG und lädt ihn herunter (qrcodejs / davidshimjs)
  function downloadQr(text, filename) {
    if (typeof QRCode === "undefined") { toast("QR-Bibliothek nicht geladen.", "error"); return; }
    var holder = document.createElement("div");
    try {
      new QRCode(holder, {
        text: text,
        width: 600,
        height: 600,
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) { toast("QR-Code Fehler: " + (e.message || e), "error"); return; }
    // Das Canvas wird ggf. minimal verzögert gezeichnet
    setTimeout(function () {
      var url = null;
      var canvas = holder.querySelector("canvas");
      if (canvas) url = canvas.toDataURL("image/png");
      else { var img = holder.querySelector("img"); url = img ? img.src : null; }
      if (!url) { toast("QR-Code konnte nicht erzeugt werden.", "error"); return; }
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    }, 80);
  }

  var quizQrBtn = document.querySelector("[data-quiz-qr]");
  var quizQrHint = document.querySelector("[data-quiz-qrhint]");
  if (quizQrBtn) {
    var quizUrl = window.location.origin + "/quiz";
    if (quizQrHint) quizQrHint.textContent = "QR-Code verweist auf: " + quizUrl + " (zeigt immer das Quiz des aktiven Kurses).";
    quizQrBtn.addEventListener("click", function () {
      downloadQr(quizUrl, "quiz-qr-code.png");
    });
  }

  /* ============================================================
     Quiz-Ergebnisse
     ============================================================ */
  var resultsEl = document.querySelector("[data-quiz-results]");
  var resultsRefresh = document.querySelector("[data-results-refresh]");

  /* Auto-Aktualisierung alle 5 Sekunden mit Countdown-Ring */
  var RESULTS_PERIOD = 5000;
  var resultsTimer = null;
  var ringRAF = null;
  var cycleStart = 0;
  var ringEl = document.querySelector("[data-results-ring]");
  var countNumEl = document.querySelector("[data-results-countdown-num]");
  var RING_C = 2 * Math.PI * 16;
  if (ringEl) { ringEl.style.strokeDasharray = RING_C.toFixed(2); ringEl.style.strokeDashoffset = "0"; }

  function tickRing() {
    var elapsed = Date.now() - cycleStart;
    var frac = Math.min(1, elapsed / RESULTS_PERIOD);
    if (ringEl) ringEl.style.strokeDashoffset = (RING_C * frac).toFixed(2);
    if (countNumEl) countNumEl.textContent = String(Math.max(1, Math.ceil((RESULTS_PERIOD - elapsed) / 1000)));
    ringRAF = requestAnimationFrame(tickRing);
  }

  function resetCycle() { cycleStart = Date.now(); }

  function startResultsAuto() {
    stopResultsAuto();
    resetCycle();
    tickRing();
    resultsTimer = setInterval(function () {
      resetCycle();
      loadResults();
    }, RESULTS_PERIOD);
  }

  function stopResultsAuto() {
    if (resultsTimer) { clearInterval(resultsTimer); resultsTimer = null; }
    if (ringRAF) { cancelAnimationFrame(ringRAF); ringRAF = null; }
  }

  if (resultsRefresh) {
    resultsRefresh.addEventListener("click", function () {
      resetCycle();
      loadResults();
    });
  }

  /* Lösungen (richtig/falsch) ein- und ausblenden */
  var revealBtn = document.querySelector("[data-results-reveal]");
  if (revealBtn) {
    revealBtn.addEventListener("click", function () {
      revealSolutions = !revealSolutions;
      resultsEl.classList.toggle("revealed", revealSolutions);
      revealBtn.textContent = revealSolutions ? "Lösungen verbergen" : "Lösungen anzeigen";
      revealBtn.classList.toggle("btn-outline", !revealSolutions);
    });
  }

  /* Vollbild für die Ergebnisse */
  var resultsFsBtn = document.querySelector("[data-results-fullscreen]");
  var resultsSection = document.querySelector('[data-view="results"]');
  if (resultsFsBtn && resultsSection) {
    resultsFsBtn.addEventListener("click", function () {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (resultsSection.requestFullscreen) {
        resultsSection.requestFullscreen();
      }
    });
    document.addEventListener("fullscreenchange", function () {
      var active = document.fullscreenElement === resultsSection;
      resultsSection.classList.toggle("is-fullscreen", active);
      resultsFsBtn.textContent = active ? "Vollbild beenden" : "Vollbild";
    });
  }

  // Bei verstecktem Tab pausieren, um unnötige Abfragen zu vermeiden
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopResultsAuto();
    } else {
      var rv = document.querySelector('[data-view="results"]');
      if (rv && !rv.hidden) startResultsAuto();
    }
  });

  var resultsRendered = false;
  var resultsSig = "";
  var revealSolutions = false;

  function perfClass(pct, total) {
    if (!total) return "none";
    return pct >= 70 ? "good" : pct >= 40 ? "mid" : "low";
  }

  function computeResults(questions, subs) {
    var byQuestion = {};
    subs.forEach(function (s) { (byQuestion[s.question_id] = byQuestion[s.question_id] || []).push(s); });
    return questions.map(function (q, idx) {
      var qs = byQuestion[q.id] || [];
      var total = qs.length;
      var correctCount = qs.filter(function (s) { return s.is_correct; }).length;
      var pct = total ? Math.round((correctCount / total) * 100) : 0;
      var counts = {};
      qs.forEach(function (s) { (s.selected || []).forEach(function (aid) { counts[aid] = (counts[aid] || 0) + 1; }); });
      var answers = (q.answers || []).map(function (a) {
        var n = counts[a.id] || 0;
        return { id: a.id, text: a.text || "", correct: !!a.correct, n: n, share: total ? Math.round((n / total) * 100) : 0 };
      });
      return {
        id: q.id, idx: idx, text: q.question_text || "(ohne Text)",
        total: total, correctCount: correctCount, pct: pct, answers: answers,
        mediaType: q.media_type || "none", mediaUrl: q.media_url || null,
      };
    });
  }

  function toEmbedUrl(url) {
    if (!url) return "";
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];
    var vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vim) return "https://player.vimeo.com/video/" + vim[1];
    return url;
  }

  function buildMediaCard(d) {
    if (!d.mediaUrl || d.mediaType === "none") return null;
    var square = document.createElement("div");
    square.className = "quiz-result-media";
    if (d.mediaType === "image") {
      var img = document.createElement("img");
      img.src = window.SB.imgUrl(d.mediaUrl);
      img.alt = "";
      img.loading = "lazy";
      square.appendChild(img);
    } else if (d.mediaType === "video_file") {
      var v = document.createElement("video");
      v.src = window.SB.imgUrl(d.mediaUrl);
      v.controls = true;
      v.preload = "metadata";
      square.appendChild(v);
    } else if (d.mediaType === "video_embed") {
      var frame = document.createElement("iframe");
      frame.src = toEmbedUrl(d.mediaUrl);
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("loading", "lazy");
      square.appendChild(frame);
    }
    return square;
  }

  function findByAttr(root, sel, attr, val) {
    return Array.prototype.slice.call(root.querySelectorAll(sel)).filter(function (el) {
      return el.getAttribute(attr) === String(val);
    })[0];
  }

  async function loadResults() {
    if (!currentCourse || !resultsEl) return;
    if (!resultsRendered) resultsEl.innerHTML = "<p class=\"admin-block-sub\">Wird geladen …</p>";
    var qRes = await sb.from("quiz_questions").select("*").eq("course_id", currentCourse.id).order("sort_order", { ascending: true });
    var sRes = await sb.from("quiz_submissions").select("*").eq("course_id", currentCourse.id);
    if (qRes.error || sRes.error) { resultsEl.innerHTML = "<p>Fehler beim Laden.</p>"; resultsRendered = false; return; }
    var questions = qRes.data || [];
    var subs = sRes.data || [];
    if (!questions.length) { resultsEl.innerHTML = "<p class=\"admin-block-sub\">Kein Quiz vorhanden.</p>"; resultsRendered = false; return; }

    var data = computeResults(questions, subs);
    var sig = data.map(function (d) { return d.id + ":" + d.answers.map(function (a) { return a.id; }).join(","); }).join("|");
    var totalAnswers = subs.length;
    var totalCorrect = subs.filter(function (s) { return s.is_correct; }).length;
    var overall = {
      questions: questions.length,
      totalAnswers: totalAnswers,
      overallPct: totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    };

    if (!resultsRendered || sig !== resultsSig) {
      buildResults(data, overall);
      resultsRendered = true;
      resultsSig = sig;
    } else {
      updateResults(data, overall);
    }
  }

  function buildResults(data, overall) {
    resultsEl.innerHTML = "";
    resultsEl.classList.toggle("revealed", revealSolutions);

    var stats = document.createElement("div");
    stats.className = "review-stats";
    stats.setAttribute("data-results-overall", "");
    stats.innerHTML =
      resStat(overall.questions, "Fragen") +
      resStat(overall.totalAnswers, "Antworten gesamt") +
      '<div class="review-stat quiz-result-correct"><strong>' + overall.overallPct + "%</strong><span>richtig gesamt</span></div>";
    resultsEl.appendChild(stats);

    data.forEach(function (d) {
      var row = document.createElement("div");
      row.className = "quiz-result-row";
      row.setAttribute("data-qid", d.id);

      var block = document.createElement("div");
      block.className = "quiz-result-block";

      var head = document.createElement("div");
      head.className = "quiz-result-head";
      var h = document.createElement("h4");
      h.textContent = "Frage " + (d.idx + 1) + ": " + d.text;
      head.appendChild(h);
      var badge = document.createElement("span");
      badge.className = "quiz-result-badge quiz-result-correct " + perfClass(d.pct, d.total);
      badge.setAttribute("data-badge", "");
      badge.textContent = d.total ? d.pct + "% richtig" : "keine Antworten";
      head.appendChild(badge);
      block.appendChild(head);

      var summary = document.createElement("p");
      summary.className = "quiz-result-summary";
      summary.innerHTML =
        '<span data-ans>' + d.total + " Antwort(en)</span>" +
        '<span class="quiz-result-correct" data-correct> · ' + d.correctCount + " richtig</span>";
      block.appendChild(summary);

      var ul = document.createElement("ul");
      ul.className = "quiz-result-answers";
      d.answers.forEach(function (a) {
        var li = document.createElement("li");
        li.className = a.correct ? "is-correct" : "";
        li.setAttribute("data-aid", a.id);
        var bar = document.createElement("div");
        bar.className = "quiz-result-bar";
        bar.style.width = a.share + "%";
        li.appendChild(bar);
        var lbl = document.createElement("span");
        lbl.className = "quiz-result-label";
        lbl.textContent = a.text;
        li.appendChild(lbl);
        var num = document.createElement("span");
        num.className = "quiz-result-num";
        num.setAttribute("data-num", "");
        num.textContent = a.n + " (" + a.share + "%)";
        li.appendChild(num);
        ul.appendChild(li);
      });
      block.appendChild(ul);
      row.appendChild(block);

      var media = buildMediaCard(d);
      if (media) row.appendChild(media);

      resultsEl.appendChild(row);
    });
  }

  function updateResults(data, overall) {
    resultsEl.classList.toggle("revealed", revealSolutions);
    var overallEl = resultsEl.querySelector("[data-results-overall]");
    if (overallEl) {
      var strongs = overallEl.querySelectorAll(".review-stat strong");
      if (strongs[0]) strongs[0].textContent = overall.questions;
      if (strongs[1]) strongs[1].textContent = overall.totalAnswers;
      if (strongs[2]) strongs[2].textContent = overall.overallPct + "%";
    }
    data.forEach(function (d) {
      var block = findByAttr(resultsEl, ".quiz-result-row", "data-qid", d.id);
      if (!block) return;
      var badge = block.querySelector("[data-badge]");
      if (badge) {
        badge.className = "quiz-result-badge quiz-result-correct " + perfClass(d.pct, d.total);
        badge.textContent = d.total ? d.pct + "% richtig" : "keine Antworten";
      }
      var ans = block.querySelector("[data-ans]");
      if (ans) ans.textContent = d.total + " Antwort(en)";
      var corr = block.querySelector("[data-correct]");
      if (corr) corr.textContent = " · " + d.correctCount + " richtig";
      d.answers.forEach(function (a) {
        var li = findByAttr(block, "li", "data-aid", a.id);
        if (!li) return;
        var bar = li.querySelector(".quiz-result-bar");
        if (bar) bar.style.width = a.share + "%";
        var num = li.querySelector("[data-num]");
        if (num) num.textContent = a.n + " (" + a.share + "%)";
      });
    });
  }

  function resStat(value, label) {
    return '<div class="review-stat"><strong>' + value + "</strong><span>" + label + "</span></div>";
  }

  /* ============================================================
     Quiz-Medien beim Abschließen löschen
     ============================================================ */
  async function deleteQuizMedia(cId) {
    var res = await sb.from("quiz_questions").select("id,media_type,media_url").eq("course_id", cId);
    if (res.error) return;
    var paths = [];
    (res.data || []).forEach(function (q) {
      if ((q.media_type === "image" || q.media_type === "video_file") && q.media_url) {
        var p = storagePathFromUrl(q.media_url);
        if (p) paths.push(p);
      }
    });
    if (paths.length) {
      try { await sb.storage.from("courses").remove(paths); } catch (e) { /* ignorieren */ }
    }
    await sb.from("quiz_questions").update({ media_type: "none", media_url: null }).eq("course_id", cId).in("media_type", ["image", "video_file"]);
  }

  /* ============================================================
     Bewertungen (je Kurs)
     ============================================================ */
  var rqBuilderEl = document.querySelector("[data-rq-builder]");
  var courseReviewsEl = document.querySelector("[data-course-reviews]");
  var rqCache = [];

  function loadReviewsAdmin() {
    loadReviewQuestions();
    loadCourseReviews();
  }

  /* ---------- Bewertungsfragen ---------- */
  async function loadReviewQuestions() {
    if (!currentCourse || !rqBuilderEl) return;
    var res = await sb.from("review_questions").select("*").eq("course_id", currentCourse.id).order("sort_order", { ascending: true });
    if (res.error) { rqBuilderEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    rqCache = res.data || [];
    renderReviewQuestions();
  }

  function renderReviewQuestions() {
    rqBuilderEl.innerHTML = "";
    if (!rqCache.length) {
      rqBuilderEl.innerHTML = "<p class=\"admin-block-sub\">Noch keine Bewertungsfragen.</p>";
      return;
    }
    rqCache.forEach(function (q, idx) {
      var card = document.createElement("div");
      card.className = "review-q-edit";

      var num = document.createElement("strong");
      num.textContent = "Frage " + (idx + 1);
      card.appendChild(num);

      var ta = document.createElement("textarea");
      ta.className = "quiz-edit-text";
      ta.rows = 2;
      ta.placeholder = "Fragetext …";
      ta.value = q.question_text || "";
      card.appendChild(ta);

      var starsLabel = document.createElement("label");
      starsLabel.className = "review-q-stars-toggle";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!q.allow_stars;
      starsLabel.appendChild(cb);
      starsLabel.appendChild(document.createTextNode(" Sternebewertung erlauben"));
      card.appendChild(starsLabel);

      var actions = document.createElement("div");
      actions.className = "admin-actions";
      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn btn-small";
      saveBtn.textContent = "Speichern";
      saveBtn.addEventListener("click", async function () {
        var res2 = await sb.from("review_questions").update({
          question_text: ta.value.trim(),
          allow_stars: cb.checked,
        }).eq("id", q.id);
        if (res2.error) { toast("Fehler: " + res2.error.message, "error"); return; }
        toast("Frage gespeichert.", "success");
        loadReviewQuestions();
      });
      actions.appendChild(saveBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-small btn-danger";
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", async function () {
        if (!window.confirm("Diese Bewertungsfrage löschen?")) return;
        var dr = await sb.from("review_questions").delete().eq("id", q.id);
        if (dr.error) { toast("Fehler: " + dr.error.message, "error"); return; }
        loadReviewQuestions();
        toast("Frage gelöscht.", "success");
      });
      actions.appendChild(delBtn);
      card.appendChild(actions);

      rqBuilderEl.appendChild(card);
    });
  }

  var rqAddBtn = document.querySelector("[data-rq-add]");
  if (rqAddBtn) {
    rqAddBtn.addEventListener("click", async function () {
      if (!currentCourse) return;
      var res = await sb.from("review_questions").insert({
        course_id: currentCourse.id,
        sort_order: rqCache.length,
        question_text: "",
        allow_stars: true,
      });
      if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
      loadReviewQuestions();
    });
  }

  var rqQrBtn = document.querySelector("[data-rq-qr]");
  var rqQrHint = document.querySelector("[data-rq-qrhint]");
  if (rqQrBtn) {
    var bewertenUrl = window.location.origin + "/bewerten";
    if (rqQrHint) rqQrHint.textContent = "QR-Code verweist auf: " + bewertenUrl + " (Bewertung des aktiven Kurses).";
    rqQrBtn.addEventListener("click", function () {
      downloadQr(bewertenUrl, "bewertung-qr-code.png");
    });
  }

  /* ---------- Bewertungen dieses Kurses (gemeinsames Modul) ---------- */
  function reviewCtx() {
    return { sb: sb, toast: toast, reload: loadCourseReviews, courseId: currentCourse ? currentCourse.id : null };
  }

  async function loadCourseReviews() {
    if (!currentCourse || !courseReviewsEl) return;
    courseReviewsEl.innerHTML = "<p class=\"admin-block-sub\">Wird geladen …</p>";
    var res = await sb.from("reviews").select("*").eq("course_id", currentCourse.id).order("created_at", { ascending: false });
    if (res.error) { courseReviewsEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    window.ReviewCards.renderList(courseReviewsEl, res.data || [], reviewCtx());
  }

  var reviewAddBtn = document.querySelector("[data-review-add]");
  if (reviewAddBtn) {
    reviewAddBtn.addEventListener("click", function () {
      if (!currentCourse) return;
      window.ReviewCards.openAddForm(reviewCtx());
    });
  }
})();
