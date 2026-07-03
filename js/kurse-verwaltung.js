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

    // Aktiv-Umschalter
    var actionRow = document.createElement("div");
    actionRow.className = "course-card-actions";

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
    swText.textContent = "Aktiv";
    sw.appendChild(swText);
    actionRow.appendChild(sw);

    var edit = document.createElement("a");
    edit.className = "btn btn-small";
    edit.textContent = "Bearbeiten";
    edit.href = "kurs-admin.html?id=" + encodeURIComponent(c.id);
    actionRow.appendChild(edit);

    var del = document.createElement("button");
    del.className = "btn btn-small btn-danger";
    del.textContent = "Löschen";
    del.addEventListener("click", function () { deleteCourse(c); });
    actionRow.appendChild(del);

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

  async function deleteCourse(c) {
    if (!window.confirm('Kurs "' + (c.name || "") + '" mit allen Bildern, Anmeldungen und Quiz wirklich löschen?\n\nDie Bewertungen dieses Kurses bleiben erhalten.')) return;
    var res = await sb.from("courses").delete().eq("id", c.id);
    if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
    loadCourses();
    toast("Kurs gelöscht.", "success");
  }
})();
