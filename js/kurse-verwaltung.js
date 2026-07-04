/* Kursübersicht (Admin): große Karten mit Bildern, Aktiv-Umschalter,
   Bearbeiten und Löschen. */
(function () {
  var sb = window.SB.get();

  var gate = document.querySelector("[data-gate]");
  var adminView = document.querySelector("[data-admin-view]");
  var logoutLink = document.querySelector("[data-logout]");
  var cardsEl = document.querySelector("[data-course-cards]");

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

  function statusLabel(s) {
    if (s === "active") return "Aktiv";
    if (s === "past") return "Vergangen";
    return "Entwurf";
  }
  function formatDate(d) {
    if (!d) return "";
    var dt = new Date(d + "T00:00:00");
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }

  /* ---------- Init / Auth ---------- */
  (async function init() {
    var session = (await sb.auth.getSession()).data.session;
    if (!session) { window.location.href = "admin.html"; return; }
    if (gate) gate.style.display = "none";
    adminView.style.display = "";
    if (logoutLink) logoutLink.style.display = "";
    loadCourses();
  })();

  if (logoutLink) {
    logoutLink.addEventListener("click", async function (e) {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = "admin.html";
    });
  }

  async function loadCourses() {
    var res = await sb.from("courses").select("*")
      .order("status", { ascending: true })
      .order("event_date", { ascending: false });
    if (res.error) { cardsEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    var courses = res.data || [];
    if (!courses.length) {
      cardsEl.innerHTML = "<div class=\"course-card-empty\"><p>Noch keine Kurse angelegt.</p><a class=\"btn\" href=\"kurs-admin.html\">+ Ersten Kurs anlegen</a></div>";
      return;
    }

    var ids = courses.map(function (c) { return c.id; });
    var imgRes = await sb.from("course_images").select("course_id,image_url,sort_order").in("course_id", ids).order("sort_order", { ascending: true });
    var imgs = {};
    (imgRes.data || []).forEach(function (im) { (imgs[im.course_id] = imgs[im.course_id] || []).push(im.image_url); });

    cardsEl.innerHTML = "";
    courses.forEach(function (c) { cardsEl.appendChild(buildCard(c, imgs[c.id] || [])); });
  }

  function buildCard(c, images) {
    var card = document.createElement("div");
    card.className = "course-card status-" + (c.status || "draft");

    // Bild-Vorschau
    var media = document.createElement("div");
    media.className = "course-card-media";
    if (images.length) {
      var big = document.createElement("img");
      big.className = "course-card-cover";
      big.src = window.SB.imgUrl(images[0]);
      big.alt = c.name || "";
      big.loading = "lazy";
      media.appendChild(big);
      if (images.length > 1) {
        var strip = document.createElement("div");
        strip.className = "course-card-strip";
        images.slice(1, 5).forEach(function (u) {
          var t = document.createElement("img");
          t.src = window.SB.imgUrl(u);
          t.alt = "";
          t.loading = "lazy";
          strip.appendChild(t);
        });
        media.appendChild(strip);
      }
    } else {
      media.classList.add("is-empty");
      media.innerHTML = "<span>Keine Bilder</span>";
    }
    card.appendChild(media);

    // Inhalt
    var body = document.createElement("div");
    body.className = "course-card-body";

    var badge = document.createElement("span");
    badge.className = "course-status-badge status-" + (c.status || "draft");
    badge.textContent = statusLabel(c.status);
    body.appendChild(badge);

    var h = document.createElement("h3");
    h.textContent = c.name || "(ohne Namen)";
    body.appendChild(h);

    var meta = document.createElement("p");
    meta.className = "course-card-meta";
    var parts = [];
    if (c.event_date) parts.push(formatDate(c.event_date) + (c.event_time ? ", " + c.event_time + " Uhr" : ""));
    if (c.location) parts.push(c.location);
    if (c.max_participants) parts.push("max. " + c.max_participants + " Teilnehmer");
    meta.textContent = parts.join(" · ");
    body.appendChild(meta);

    var actionRow = document.createElement("div");
    actionRow.className = "course-card-actions";

    // Status-Zeile mit Aktiv-Umschalter
    var statusRow = document.createElement("div");
    statusRow.className = "course-card-status-row";
    var sw = document.createElement("label");
    sw.className = "switch";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = c.status === "active";
    cb.addEventListener("change", function () { toggleActive(c, cb); });
    sw.appendChild(cb);
    var slider = document.createElement("span");
    slider.className = "switch-slider";
    sw.appendChild(slider);
    var swText = document.createElement("span");
    swText.className = "switch-label";
    swText.textContent = c.status === "active" ? "Aktiv" : "Als aktiv setzen";
    sw.appendChild(swText);
    statusRow.appendChild(sw);
    actionRow.appendChild(statusRow);

    // Anmeldung offen/geschlossen (nur bei aktiven Kursen sinnvoll)
    if (c.status === "active") {
      var signupRow = document.createElement("div");
      signupRow.className = "course-card-status-row";
      var ssw = document.createElement("label");
      ssw.className = "switch";
      var scb = document.createElement("input");
      scb.type = "checkbox";
      scb.checked = c.signup_open !== false;
      scb.addEventListener("change", function () { toggleSignup(c, scb); });
      ssw.appendChild(scb);
      var sslider = document.createElement("span");
      sslider.className = "switch-slider";
      ssw.appendChild(sslider);
      var sswText = document.createElement("span");
      sswText.className = "switch-label";
      sswText.textContent = c.signup_open !== false ? "Anmeldung offen" : "Anmeldung geschlossen";
      ssw.appendChild(sswText);
      signupRow.appendChild(ssw);
      actionRow.appendChild(signupRow);
    }

    // Button-Raster
    var btns = document.createElement("div");
    btns.className = "course-card-btns";

    var edit = document.createElement("a");
    edit.className = "btn btn-small";
    edit.textContent = "Bearbeiten";
    edit.href = "kurs-admin.html?id=" + encodeURIComponent(c.id);
    btns.appendChild(edit);

    var dup = document.createElement("button");
    dup.className = "btn btn-small";
    dup.textContent = "Duplizieren";
    dup.addEventListener("click", function () { duplicateCourse(c, dup); });
    btns.appendChild(dup);

    if (c.status !== "past") {
      var past = document.createElement("button");
      past.className = "btn btn-small btn-outline-danger";
      past.textContent = "Vergangen";
      past.addEventListener("click", function () { markPast(c, past); });
      btns.appendChild(past);
    }

    var del = document.createElement("button");
    del.className = "btn btn-small btn-danger";
    del.textContent = "Löschen";
    del.addEventListener("click", function () { deleteCourse(c); });
    btns.appendChild(del);

    actionRow.appendChild(btns);

    body.appendChild(actionRow);
    card.appendChild(body);
    return card;
  }

  async function toggleActive(c, cb) {
    try {
      if (cb.checked) {
        var clear = await sb.from("courses").update({ status: "draft" }).eq("status", "active").neq("id", c.id);
        if (clear.error) throw clear.error;
        var res = await sb.from("courses").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", c.id);
        if (res.error) throw res.error;
        toast("Kurs ist jetzt aktiv.", "success");
      } else {
        var res2 = await sb.from("courses").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", c.id);
        if (res2.error) throw res2.error;
        toast("Kurs auf Entwurf gesetzt.", "success");
      }
      loadCourses();
    } catch (ex) {
      toast("Fehler: " + (ex.message || ex), "error");
      cb.checked = !cb.checked;
    }
  }

  async function toggleSignup(c, cb) {
    try {
      var res = await sb.from("courses").update({ signup_open: cb.checked, updated_at: new Date().toISOString() }).eq("id", c.id);
      if (res.error) throw res.error;
      c.signup_open = cb.checked;
      toast(cb.checked ? "Anmeldung geöffnet." : "Anmeldung geschlossen.", "success");
      loadCourses();
    } catch (ex) {
      toast("Fehler: " + (ex.message || ex), "error");
      cb.checked = !cb.checked;
    }
  }

  /* ---------- Kurs als vergangen markieren ---------- */
  async function deleteQuizMedia(cId) {
    var res = await sb.from("quiz_questions").select("id,media_type,media_url").eq("course_id", cId);
    if (res.error) return;
    var paths = [];
    (res.data || []).forEach(function (q) {
      if ((q.media_type === "image" || q.media_type === "video_file") && q.media_url) {
        var p = storagePath(q.media_url);
        if (p) paths.push(p);
      }
    });
    if (paths.length) {
      try { await sb.storage.from("courses").remove(paths); } catch (e) { /* ignorieren */ }
    }
    await sb.from("quiz_questions").update({ media_type: "none", media_url: null }).eq("course_id", cId).in("media_type", ["image", "video_file"]);
  }

  async function markPast(c, btn) {
    if (!window.confirm('Kurs "' + (c.name || "") + '" als vergangen markieren?\n\nDie Quiz-Bilder/Videos dieses Kurses werden dabei gelöscht.')) return;
    if (btn) { btn.disabled = true; btn.textContent = "Wird gesetzt …"; }
    try {
      await deleteQuizMedia(c.id);
      var res = await sb.from("courses").update({ status: "past", updated_at: new Date().toISOString() }).eq("id", c.id);
      if (res.error) throw res.error;
      loadCourses();
      toast("Kurs als vergangen markiert.", "success");
    } catch (ex) {
      toast("Fehler: " + (ex.message || ex), "error");
      if (btn) { btn.disabled = false; btn.textContent = "Vergangen"; }
    }
  }

  /* ---------- Kurs duplizieren ---------- */
  function storagePath(url) {
    var marker = "/storage/v1/object/public/courses/";
    var idx = (url || "").indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  async function copyStorageFile(url) {
    var p = storagePath(url);
    if (!p) return url; // externe URL (z. B. YouTube-Embed) unverändert lassen
    var ext = (p.split(".").pop() || "jpg").toLowerCase();
    var dest = Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext;
    var cp = await sb.storage.from("courses").copy(p, dest);
    if (cp.error) return url; // Fallback: gleiche Datei referenzieren
    return sb.storage.from("courses").getPublicUrl(dest).data.publicUrl;
  }

  async function duplicateCourse(c, btn) {
    if (!window.confirm('Kurs "' + (c.name || "") + '" duplizieren?\n\nEigenschaften, Bilder sowie Quiz- und Bewertungsfragen werden kopiert (ohne Anmeldungen und abgegebene Antworten/Bewertungen).')) return;
    if (btn) { btn.disabled = true; btn.textContent = "Kopiere …"; }
    try {
      // 1) Kurs-Eigenschaften kopieren
      var src = await sb.from("courses").select("*").eq("id", c.id).single();
      if (src.error) throw src.error;
      var copy = Object.assign({}, src.data);
      delete copy.id;
      delete copy.created_at;
      delete copy.updated_at;
      copy.status = "draft";
      copy.name = (copy.name || "Kurs") + " (Kopie)";
      var ins = await sb.from("courses").insert(copy).select("id").single();
      if (ins.error) throw ins.error;
      var newId = ins.data.id;

      // 2) Bilder kopieren (eigene Datei-Kopien)
      var imgs = await sb.from("course_images").select("image_url,sort_order").eq("course_id", c.id).order("sort_order", { ascending: true });
      var newImgs = await Promise.all((imgs.data || []).map(async function (im) {
        return { course_id: newId, image_url: await copyStorageFile(im.image_url), sort_order: im.sort_order };
      }));
      if (newImgs.length) {
        var iRes = await sb.from("course_images").insert(newImgs);
        if (iRes.error) throw iRes.error;
      }

      // 3) Quizfragen kopieren (Medien als eigene Kopien)
      var qs = await sb.from("quiz_questions").select("question_text,media_type,media_url,answers,sort_order").eq("course_id", c.id).order("sort_order", { ascending: true });
      var newQs = await Promise.all((qs.data || []).map(async function (q) {
        var mu = q.media_url;
        if ((q.media_type === "image" || q.media_type === "video_file") && mu) mu = await copyStorageFile(mu);
        return { course_id: newId, question_text: q.question_text, media_type: q.media_type, media_url: mu, answers: q.answers, sort_order: q.sort_order };
      }));
      if (newQs.length) {
        var qRes = await sb.from("quiz_questions").insert(newQs);
        if (qRes.error) throw qRes.error;
      }

      // 4) Bewertungsfragen kopieren
      var rq = await sb.from("review_questions").select("question_text,allow_stars,sort_order").eq("course_id", c.id).order("sort_order", { ascending: true });
      if (rq.data && rq.data.length) {
        var rRes = await sb.from("review_questions").insert(rq.data.map(function (x) {
          return { course_id: newId, question_text: x.question_text, allow_stars: x.allow_stars, sort_order: x.sort_order };
        }));
        if (rRes.error) throw rRes.error;
      }

      loadCourses();
      toast("Kurs dupliziert.", "success");
    } catch (ex) {
      toast("Fehler beim Duplizieren: " + (ex.message || ex), "error");
      if (btn) { btn.disabled = false; btn.textContent = "Duplizieren"; }
    }
  }

  async function deleteCourse(c) {
    if (!window.confirm('Kurs "' + (c.name || "") + '" mit allen Bildern, Anmeldungen und Quiz wirklich löschen?\n\nDie Bewertungen dieses Kurses bleiben erhalten.')) return;
    var res = await sb.from("courses").delete().eq("id", c.id);
    if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
    loadCourses();
    toast("Kurs gelöscht.", "success");
  }
})();
