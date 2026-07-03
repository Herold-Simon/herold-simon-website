/* Admin-Bereich: Login, Mitarbeiterverwaltung, Galerie, Passwort ändern. */
(function () {
  var ADMIN_EMAIL = "admin@herold-simon.de";
  var sb = window.SB.get();

  var loginView = document.querySelector("[data-login-view]");
  var adminView = document.querySelector("[data-admin-view]");
  var logoutLink = document.querySelector("[data-logout]");

  var teamCache = [];
  var galleryCache = [];
  var editingMember = null;
  var dragRow = null;
  var dragCell = null;

  /* ---------- Toast-Benachrichtigung ---------- */
  var toastEl = document.querySelector("[data-toast]");
  var toastTimer = null;
  function toast(msg, type) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "admin-toast show" + (type ? " " + type : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.className = "admin-toast";
    }, 3000);
  }

  /* ---------- Rich-Text-Editor (Quill) ---------- */
  var quill = new Quill("#cv-editor", {
    theme: "snow",
    placeholder: "Lebenslauf-Text hier eingeben …",
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    },
  });

  var titleQuill = new Quill("#detail-title-editor", {
    theme: "snow",
    placeholder: "z. B. prakt. Tierarzt, Fachbuchautor …",
    modules: {
      toolbar: [["bold", "italic", "underline"], ["clean"]],
    },
  });

  var promoQuill = new Quill("#course-promo-editor", {
    theme: "snow",
    placeholder: "Werbetext für die Kurse-Seite …",
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    },
  });

  function setPromo(html) {
    promoQuill.setText("");
    if (html) promoQuill.clipboard.dangerouslyPasteHTML(html);
  }
  function getPromo() {
    var html = promoQuill.root.innerHTML;
    if (html === "<p><br></p>" || html === "<p></p>") return "";
    return html;
  }

  function setCv(html) {
    quill.setText("");
    if (html) quill.clipboard.dangerouslyPasteHTML(html);
  }

  function getCv() {
    var html = quill.root.innerHTML;
    if (html === "<p><br></p>" || html === "<p></p>") return "";
    return html;
  }

  function setDetailTitle(html) {
    titleQuill.setText("");
    if (html) titleQuill.clipboard.dangerouslyPasteHTML(html);
  }

  function getDetailTitle() {
    var html = titleQuill.root.innerHTML;
    if (html === "<p><br></p>" || html === "<p></p>") return "";
    return html;
  }

  /* ---------- Lebenslauf-Editor ein-/ausklappen ---------- */
  var cvWrap = document.querySelector("[data-cv-wrap]");
  var cvToggle = document.querySelector("[data-cv-toggle]");
  if (cvToggle) {
    cvToggle.addEventListener("click", function () {
      var collapsed = cvWrap.classList.toggle("collapsed");
      cvToggle.textContent = collapsed ? "Mehr anzeigen" : "Weniger anzeigen";
    });
  }

  function updateCvCollapse() {
    if (!cvWrap || !cvToggle) return;
    var container = cvWrap.querySelector(".ql-container");
    var full = container ? container.scrollHeight : 0;
    if (full > 240) {
      cvWrap.classList.add("collapsed");
      cvToggle.style.display = "";
      cvToggle.textContent = "Mehr anzeigen";
    } else {
      cvWrap.classList.remove("collapsed");
      cvToggle.style.display = "none";
    }
  }

  /* ---------- Hilfsfunktionen ---------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function uniqueSlug(base) {
    var slug = base || "mitarbeiter";
    var taken = teamCache.map(function (m) { return m.slug; });
    if (editingMember) {
      taken = taken.filter(function (s) { return s !== editingMember.slug; });
    }
    if (taken.indexOf(slug) === -1) return slug;
    var i = 2;
    while (taken.indexOf(slug + "-" + i) !== -1) i++;
    return slug + "-" + i;
  }

  async function uploadImage(bucket, file) {
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    var name = Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext;
    var up = await sb.storage.from(bucket).upload(name, file, { cacheControl: "3600", upsert: false });
    if (up.error) throw up.error;
    return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }

  /* ---------- Sitzung ---------- */
  async function init() {
    var session = (await sb.auth.getSession()).data.session;
    if (session) {
      showAdmin();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginView.style.display = "";
    adminView.style.display = "none";
    logoutLink.style.display = "none";
  }

  async function showAdmin() {
    loginView.style.display = "none";
    adminView.style.display = "";
    logoutLink.style.display = "";
    await loadTeam();
    await loadLayout();
    loadGallery();
    loadCourseSettings();
  }

  /* ---------- Login / Logout ---------- */
  qs("[data-login-form]").addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = qs("[data-login-error]");
    err.textContent = "";
    var password = e.target.password.value;
    var res = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: password });
    if (res.error) {
      err.textContent = "Anmeldung fehlgeschlagen. Bitte Passwort prüfen.";
      return;
    }
    showAdmin();
  });

  logoutLink.addEventListener("click", async function (e) {
    e.preventDefault();
    await sb.auth.signOut();
    showLogin();
  });

  /* ---------- Mitarbeiter ---------- */
  var teamListEl = qs("[data-team-list]");
  var memberForm = qs("[data-member-form]");
  var layoutListEl = qs("[data-layout-list]");
  var teamLayout = [];

  async function loadTeam() {
    var res = await sb.from("team_members").select("*").order("sort_order", { ascending: true });
    if (res.error) { teamListEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    teamCache = res.data || [];
    teamListEl.innerHTML = "";
    teamCache.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "admin-list-row";
      row.setAttribute("data-id", m.id);
      row.draggable = true;

      var handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.title = "Zum Sortieren ziehen";
      handle.textContent = "⠿";
      row.appendChild(handle);

      var thumb = document.createElement("img");
      thumb.className = "admin-thumb-sm";
      thumb.src = window.SB.imgUrl(m.image1_url);
      thumb.alt = "";
      row.appendChild(thumb);

      var label = document.createElement("span");
      label.className = "admin-list-name";
      label.textContent = m.name;
      row.appendChild(label);

      var order = document.createElement("span");
      order.className = "admin-list-order";
      order.textContent = "#" + m.sort_order;
      row.appendChild(order);

      var editBtn = document.createElement("button");
      editBtn.className = "btn btn-small";
      editBtn.textContent = "Bearbeiten";
      editBtn.addEventListener("click", function () { startEdit(m); });
      row.appendChild(editBtn);

      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-small btn-danger";
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", function () { deleteMember(m); });
      row.appendChild(delBtn);

      row.addEventListener("dragstart", function () {
        dragRow = row;
        setTimeout(function () { row.classList.add("dragging"); }, 0);
      });
      row.addEventListener("dragend", function () {
        row.classList.remove("dragging");
        dragRow = null;
        persistOrder();
      });

      teamListEl.appendChild(row);
    });
  }

  // Reihenfolge per Drag & Drop
  teamListEl.addEventListener("dragover", function (e) {
    e.preventDefault();
    if (!dragRow) return;
    var after = getDragAfterElement(teamListEl, e.clientY);
    if (after == null) teamListEl.appendChild(dragRow);
    else teamListEl.insertBefore(dragRow, after);
  });

  function getDragAfterElement(container, y) {
    var els = Array.prototype.slice.call(
      container.querySelectorAll(".admin-list-row:not(.dragging)")
    );
    var closest = { offset: -Infinity, element: null };
    els.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, element: child };
      }
    });
    return closest.element;
  }

  async function persistOrder() {
    var rows = Array.prototype.slice.call(teamListEl.querySelectorAll(".admin-list-row"));
    var updates = [];
    rows.forEach(function (row, idx) {
      var id = row.getAttribute("data-id");
      var member = teamCache.find(function (m) { return m.id === id; });
      var newOrder = idx + 1;
      if (member) {
        var orderEl = row.querySelector(".admin-list-order");
        if (orderEl) orderEl.textContent = "#" + newOrder;
        if (member.sort_order !== newOrder) {
          member.sort_order = newOrder;
          updates.push(sb.from("team_members").update({ sort_order: newOrder }).eq("id", id));
        }
      }
    });
    if (updates.length) {
      var results = await Promise.all(updates);
      var failed = results.find(function (r) { return r.error; });
      if (failed) toast("Reihenfolge konnte nicht gespeichert werden.", "error");
      else toast("Reihenfolge gespeichert.", "success");
    }
  }

  function fillForm(m) {
    memberForm.id.value = m.id || "";
    memberForm.name.value = m.name || "";
    memberForm.title.value = m.title || "";
    setDetailTitle(m.detail_title || "");
    memberForm.phone.value = m.phone || "";
    memberForm.image1_url.value = m.image1_url || "";
    memberForm.image2_url.value = m.image2_url || "";
    setCv(m.cv_text || "");
    memberForm.sort_order.value = m.sort_order != null ? m.sort_order : 0;
    memberForm.image1_file.value = "";
    memberForm.image2_file.value = "";
    setPreview("[data-preview1]", m.image1_url);
    setPreview("[data-preview2]", m.image2_url);
  }

  function setPreview(sel, url) {
    var img = qs(sel);
    if (url) { img.src = window.SB.imgUrl(url); img.style.display = ""; }
    else { img.removeAttribute("src"); img.style.display = "none"; }
  }

  function startEdit(m) {
    editingMember = m;
    qs("[data-form-title]").textContent = "Mitarbeiter bearbeiten";
    fillForm(m);
    memberForm.style.display = "";
    updateCvCollapse();
    memberForm.scrollIntoView({ behavior: "smooth" });
  }

  qs("[data-new-member]").addEventListener("click", function () {
    editingMember = null;
    qs("[data-form-title]").textContent = "Mitarbeiter hinzufügen";
    fillForm({ sort_order: teamCache.length + 1 });
    memberForm.style.display = "";
    updateCvCollapse();
    memberForm.scrollIntoView({ behavior: "smooth" });
  });

  qs("[data-cancel-member]").addEventListener("click", function () {
    memberForm.style.display = "none";
    editingMember = null;
  });

  // Live-Vorschau bei Dateiauswahl
  memberForm.image1_file.addEventListener("change", function (e) {
    previewFile(e.target.files[0], "[data-preview1]");
  });
  memberForm.image2_file.addEventListener("change", function (e) {
    previewFile(e.target.files[0], "[data-preview2]");
  });
  function previewFile(file, sel) {
    if (!file) return;
    var img = qs(sel);
    img.src = URL.createObjectURL(file);
    img.style.display = "";
  }

  memberForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = qs("[data-member-error]");
    err.textContent = "";
    var submitBtn = memberForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Speichern …";

    try {
      var image1_url = memberForm.image1_url.value;
      var image2_url = memberForm.image2_url.value;

      if (memberForm.image1_file.files[0]) {
        image1_url = await uploadImage("team", memberForm.image1_file.files[0]);
      }
      if (memberForm.image2_file.files[0]) {
        image2_url = await uploadImage("team", memberForm.image2_file.files[0]);
      }

      var name = memberForm.name.value.trim();
      var slug = editingMember ? editingMember.slug : uniqueSlug(slugify(name));

      var row = {
        name: name,
        title: memberForm.title.value.trim(),
        detail_title: getDetailTitle(),
        phone: memberForm.phone.value.trim(),
        image1_url: image1_url,
        image2_url: image2_url,
        cv_text: getCv(),
        sort_order: parseInt(memberForm.sort_order.value, 10) || 0,
        slug: slug,
      };

      var res;
      if (editingMember) {
        res = await sb.from("team_members").update(row).eq("id", editingMember.id);
      } else {
        res = await sb.from("team_members").insert(row);
      }
      if (res.error) throw res.error;

      memberForm.style.display = "none";
      var wasEditing = !!editingMember;
      editingMember = null;
      await loadTeam();
      await refreshLayout();
      toast(wasEditing ? "Mitarbeiter aktualisiert." : "Mitarbeiter hinzugefügt.", "success");
    } catch (ex) {
      err.textContent = "Fehler beim Speichern: " + (ex.message || ex);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Speichern";
    }
  });

  async function deleteMember(m) {
    if (!window.confirm('Mitarbeiter "' + m.name + '" wirklich löschen?')) return;
    var res = await sb.from("team_members").delete().eq("id", m.id);
    if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
    await loadTeam();
    await refreshLayout();
    toast("Mitarbeiter gelöscht.", "success");
  }

  /* ---------- Reihen-Aufteilung ---------- */
  // Layout an die Mitarbeiterzahl angleichen: gespeicherte Reihengrößen
  // anwenden, letzte Reihe ggf. kürzen, Rest in neue Reihen (Standard 3) füllen.
  function normalizeLayout(layout, total) {
    var rows = [];
    var used = 0;
    for (var i = 0; i < layout.length && used < total; i++) {
      var size = parseInt(layout[i], 10) || 0;
      if (size < 1) size = 1;
      if (used + size > total) size = total - used;
      if (size > 0) { rows.push(size); used += size; }
    }
    while (used < total) {
      var rest = Math.min(3, total - used);
      rows.push(rest);
      used += rest;
    }
    return rows;
  }

  async function loadLayout() {
    var res = await sb.from("site_settings").select("value").eq("key", "team_row_layout").maybeSingle();
    var val = res && res.data && Array.isArray(res.data.value) ? res.data.value : [];
    teamLayout = val;
    await refreshLayout();
  }

  // Normalisiert das Layout, rendert die Eingaben und speichert bei Änderung.
  async function refreshLayout() {
    var before = JSON.stringify(teamLayout);
    teamLayout = normalizeLayout(teamLayout, teamCache.length);
    renderLayout();
    if (JSON.stringify(teamLayout) !== before) {
      await saveLayout(true);
    }
  }

  function renderLayout() {
    if (!layoutListEl) return;
    layoutListEl.innerHTML = "";
    var total = teamCache.length;
    if (total === 0) {
      layoutListEl.innerHTML = "<p class=\"admin-block-sub\">Noch keine Mitarbeiter vorhanden.</p>";
      return;
    }

    teamLayout.forEach(function (count, idx) {
      var rowEl = document.createElement("div");
      rowEl.className = "admin-layout-row";

      var label = document.createElement("span");
      label.className = "admin-layout-label";
      label.textContent = "Reihe " + (idx + 1);
      rowEl.appendChild(label);

      var input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = String(total);
      input.value = String(count);
      input.className = "admin-layout-input";
      input.addEventListener("change", function () {
        var v = parseInt(input.value, 10) || 1;
        if (v < 1) v = 1;
        if (v > total) v = total;
        teamLayout[idx] = v;
        // Nachfolgende Reihen verwerfen – Rest wird automatisch neu verteilt.
        teamLayout = normalizeLayout(teamLayout.slice(0, idx + 1), total);
        renderLayout();
        saveLayout(true);
      });
      rowEl.appendChild(input);

      var suffix = document.createElement("span");
      suffix.className = "admin-layout-suffix";
      suffix.textContent = "Mitarbeiter";
      rowEl.appendChild(suffix);

      layoutListEl.appendChild(rowEl);
    });
  }

  async function saveLayout(showToast) {
    var res = await sb.from("site_settings").upsert(
      { key: "team_row_layout", value: teamLayout, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (res.error) {
      toast("Reihen-Aufteilung konnte nicht gespeichert werden.", "error");
    } else if (showToast) {
      toast("Reihen-Aufteilung gespeichert.", "success");
    }
  }

  /* ---------- Galerie ---------- */
  var galleryListEl = qs("[data-gallery-list]");
  var galleryForm = qs("[data-gallery-form]");

  async function loadGallery() {
    var res = await sb.from("gallery_images").select("*").order("sort_order", { ascending: true });
    if (res.error) { galleryListEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    galleryCache = res.data || [];
    galleryListEl.innerHTML = "";
    galleryCache.forEach(function (g) {
      var cell = document.createElement("div");
      cell.className = "admin-gallery-cell";
      cell.setAttribute("data-id", g.id);
      cell.draggable = true;

      var img = document.createElement("img");
      img.src = window.SB.imgUrl(g.image_url);
      img.alt = g.alt || "";
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
      del.addEventListener("click", function (ev) {
        ev.stopPropagation();
        deleteGallery(g);
      });
      cell.appendChild(del);

      cell.addEventListener("dragstart", function () {
        dragCell = cell;
        setTimeout(function () { cell.classList.add("dragging"); }, 0);
      });
      cell.addEventListener("dragend", function () {
        cell.classList.remove("dragging");
        dragCell = null;
        galleryListEl.querySelectorAll(".admin-gallery-cell").forEach(function (c) {
          c.classList.remove("drag-over");
        });
        persistGalleryOrder();
      });

      galleryListEl.appendChild(cell);
    });
  }

  // Reihenfolge der Galerie per Drag & Drop (2D-Gitter)
  galleryListEl.addEventListener("dragover", function (e) {
    e.preventDefault();
    if (!dragCell) return;
    var after = getGalleryAfterElement(galleryListEl, e.clientX, e.clientY);
    if (after == null) galleryListEl.appendChild(dragCell);
    else galleryListEl.insertBefore(dragCell, after);
  });

  function getGalleryAfterElement(container, x, y) {
    var cells = Array.prototype.slice.call(
      container.querySelectorAll(".admin-gallery-cell:not(.dragging)")
    );
    var closest = null;
    var closestDist = Infinity;
    cells.forEach(function (cell) {
      var box = cell.getBoundingClientRect();
      var cx = box.left + box.width / 2;
      var cy = box.top + box.height / 2;
      var dist = Math.hypot(x - cx, y - cy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = { el: cell, cx: cx };
      }
    });
    if (!closest) return null;
    return x < closest.cx ? closest.el : closest.el.nextElementSibling;
  }

  async function persistGalleryOrder() {
    var cells = Array.prototype.slice.call(galleryListEl.querySelectorAll(".admin-gallery-cell"));
    var updates = [];
    cells.forEach(function (cell, idx) {
      var id = cell.getAttribute("data-id");
      var g = galleryCache.find(function (x) { return String(x.id) === String(id); });
      if (g && g.sort_order !== idx) {
        g.sort_order = idx;
        updates.push(sb.from("gallery_images").update({ sort_order: idx }).eq("id", id));
      }
    });
    if (updates.length) {
      var results = await Promise.all(updates);
      var failed = results.find(function (r) { return r.error; });
      if (failed) toast("Reihenfolge konnte nicht gespeichert werden.", "error");
      else toast("Reihenfolge gespeichert.", "success");
    }
  }

  // Anzeige der Anzahl ausgewählter Dateien
  galleryForm.gallery_files.addEventListener("change", function () {
    var n = galleryForm.gallery_files.files.length;
    var hint = qs("[data-gallery-filecount]");
    if (hint) hint.textContent = n ? n + " Bild(er) ausgewählt" : "mehrere möglich";
  });

  galleryForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = qs("[data-gallery-error]");
    err.textContent = "";
    var files = galleryForm.gallery_files.files;
    if (!files.length) { err.textContent = "Bitte mindestens ein Bild auswählen."; return; }

    var submitBtn = galleryForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Lädt hoch …";

    try {
      var maxSort = teamCache.length; // egal, neue ans Ende
      var existing = await sb.from("gallery_images").select("sort_order").order("sort_order", { ascending: false }).limit(1);
      var start = (existing.data && existing.data[0]) ? existing.data[0].sort_order + 1 : 0;

      for (var i = 0; i < files.length; i++) {
        var url = await uploadImage("gallery", files[i]);
        var res = await sb.from("gallery_images").insert({
          image_url: url,
          alt: "Impression aus der Pferdepraxis",
          sort_order: start + i,
        });
        if (res.error) throw res.error;
      }
      galleryForm.reset();
      var hint = qs("[data-gallery-filecount]");
      if (hint) hint.textContent = "mehrere möglich";
      await loadGallery();
      toast(files.length + " Bild(er) hochgeladen.", "success");
    } catch (ex) {
      err.textContent = "Fehler beim Hochladen: " + (ex.message || ex);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Hochladen";
    }
  });

  async function deleteGallery(g) {
    if (!window.confirm("Dieses Bild wirklich löschen?")) return;
    var res = await sb.from("gallery_images").delete().eq("id", g.id);
    if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
    // Falls in Supabase Storage gespeichert: Datei ebenfalls entfernen
    try {
      var marker = "/storage/v1/object/public/gallery/";
      var idx = (g.image_url || "").indexOf(marker);
      if (idx !== -1) {
        var path = decodeURIComponent(g.image_url.slice(idx + marker.length));
        await sb.storage.from("gallery").remove([path]);
      }
    } catch (e) { /* ignorieren */ }
    await loadGallery();
    toast("Bild gelöscht.", "success");
  }

  /* ---------- Kurse: globale Einstellungen (Video + Werbetext) ---------- */
  var courseSettingsForm = qs("[data-course-settings-form]");

  function updateVideoFields() {
    if (!courseSettingsForm) return;
    var type = courseSettingsForm.video_type.value;
    qs("[data-video-url-field]").style.display = type === "file" ? "none" : "";
    qs("[data-video-file-field]").style.display = type === "file" ? "" : "none";
  }

  if (courseSettingsForm) {
    courseSettingsForm.video_type.addEventListener("change", updateVideoFields);

    courseSettingsForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = qs("[data-course-settings-msg]");
      msg.textContent = "";
      var btn = courseSettingsForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Speichern …";
      try {
        var type = courseSettingsForm.video_type.value;
        var url = courseSettingsForm.video_url.value.trim();
        if (type === "file") {
          var file = courseSettingsForm.video_file.files[0];
          if (file) {
            url = await uploadImage("courses", file);
          } else {
            // vorhandenen Wert beibehalten
            url = courseSettingsForm.getAttribute("data-current-file-url") || "";
          }
        }
        var video = url ? { type: type, url: url } : null;

        await Promise.all([
          sb.from("site_settings").upsert(
            { key: "courses_video", value: video, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          ),
          sb.from("site_settings").upsert(
            { key: "courses_promo_text", value: { html: getPromo() }, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          ),
          sb.from("site_settings").upsert(
            { key: "show_courses_nav", value: courseSettingsForm.show_courses_nav.checked, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          ),
        ]);
        await loadCourseSettings();
        toast("Kurse-Einstellungen gespeichert.", "success");
      } catch (ex) {
        msg.textContent = "Fehler beim Speichern: " + (ex.message || ex);
      } finally {
        btn.disabled = false;
        btn.textContent = "Speichern";
      }
    });
  }

  async function loadCourseSettings() {
    if (!courseSettingsForm) return;
    var res = await sb.from("site_settings").select("key,value").in("key", ["courses_video", "courses_promo_text", "show_courses_nav"]);
    var map = {};
    (res.data || []).forEach(function (r) { map[r.key] = r.value; });

    // Standard: Button anzeigen, außer es ist ausdrücklich auf false gesetzt
    courseSettingsForm.show_courses_nav.checked = map.show_courses_nav !== false;

    var video = map.courses_video || {};
    courseSettingsForm.video_type.value = video.type === "file" ? "file" : "embed";
    courseSettingsForm.video_url.value = video.type === "file" ? "" : (video.url || "");
    courseSettingsForm.setAttribute("data-current-file-url", video.type === "file" ? (video.url || "") : "");
    var cur = qs("[data-video-current]");
    if (cur) cur.textContent = video.type === "file" && video.url ? "Aktuelles Video ist hochgeladen." : "";
    courseSettingsForm.video_file.value = "";
    updateVideoFields();

    var promo = map.courses_promo_text;
    setPromo(promo && promo.html ? promo.html : "");
  }

  /* ---------- Passwort ändern ---------- */
  qs("[data-password-form]").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = qs("[data-password-msg]");
    msg.textContent = "";
    msg.classList.remove("admin-success");
    var p1 = e.target.new_password.value;
    var p2 = e.target.new_password2.value;
    if (p1 !== p2) { msg.textContent = "Die Passwörter stimmen nicht überein."; return; }
    var res = await sb.auth.updateUser({ password: p1 });
    if (res.error) { msg.textContent = "Fehler: " + res.error.message; return; }
    msg.textContent = "Passwort erfolgreich geändert.";
    msg.classList.add("admin-success");
    toast("Passwort geändert.", "success");
    e.target.reset();
  });

  init();
})();
