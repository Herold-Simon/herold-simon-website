/* Erfolgsseite nach Anmeldung: Konfetti + Kursdaten (Ort, Zeit, Preis, Bank). */
(function () {
  /* ---------- Konfetti ---------- */
  function fireConfetti() {
    if (typeof confetti !== "function") return;

    // Startsalven aus der Mitte
    confetti({ particleCount: 220, spread: 100, origin: { y: 0.6 } });
    setTimeout(function () { confetti({ particleCount: 160, spread: 120, startVelocity: 45, origin: { y: 0.55 } }); }, 250);

    // Kontinuierlicher Regen von beiden Seiten (7 Sekunden)
    var end = Date.now() + 7000;
    (function frame() {
      confetti({ particleCount: 8, angle: 60, spread: 75, startVelocity: 55, origin: { x: 0 } });
      confetti({ particleCount: 8, angle: 120, spread: 75, startVelocity: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();

    // Zusätzliche Salven zwischendurch
    [1200, 2600, 4200, 5600].forEach(function (t) {
      setTimeout(function () {
        confetti({ particleCount: 120, spread: 100, origin: { x: Math.random(), y: Math.random() * 0.3 + 0.2 } });
      }, t);
    });
  }
  fireConfetti();

  if (!window.SB) return;
  var sb = window.SB.get();
  var cardEl = document.querySelector("[data-success-card]");

  var signupName = "";
  try { signupName = sessionStorage.getItem("course_signup_name") || ""; } catch (e) { /* ignorieren */ }

  // Ersetzt Platzhalter wie {name} durch den Namen des Teilnehmers.
  function fillPlaceholders(str) {
    if (!str) return str;
    return String(str).replace(/\{\s*name\s*\}/gi, signupName || "Ihr Name");
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }

  function row(label, value) {
    if (!value) return "";
    return '<li><span class="course-success-label">' + label + '</span><span class="course-success-value">' + value + "</span></li>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function addressHtml(c) {
    var line1 = [c.address_street, c.address_number].filter(Boolean).join(" ");
    var line2 = [c.address_zip, c.address_city].filter(Boolean).join(" ");
    var lines = [];
    if (c.location) lines.push("<strong>" + esc(c.location) + "</strong>");
    if (line1) lines.push(esc(line1));
    if (line2) lines.push(esc(line2));
    if (!lines.length) return "";

    var html = '<span class="course-success-address">' + lines.join("<br>") + "</span>";

    var mapQuery = [line1, line2].filter(Boolean).join(", ") || c.location;
    if (mapQuery && (line1 || line2)) {
      html += '<a class="course-success-map" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(mapQuery) + '">Route planen &rarr;</a>';
    }
    return html;
  }

  sb.from("courses").select("*").eq("status", "active").maybeSingle().then(function (res) {
    if (!cardEl) return;
    var c = res.data;
    if (res.error || !c) {
      cardEl.innerHTML = "<p>Ihre Anmeldung ist eingegangen. Wir melden uns mit allen weiteren Informationen bei Ihnen.</p>";
      return;
    }

    var html = '<h2 class="course-success-name">' + (c.name || "Kurs") + "</h2>";
    html += '<ul class="course-success-list">';
    var when = formatDate(c.event_date);
    if (c.event_time) when += (when ? ", " : "") + c.event_time + " Uhr";
    html += row("Wann", when);
    html += row("Wo", addressHtml(c) || c.location);
    html += row("Preis", c.price);
    html += "</ul>";

    var hasBank = c.iban || c.bank_recipient || c.payment_reference;
    if (hasBank) {
      html += '<div class="course-success-pay">';
      html += "<h3>Zahlung per Überweisung</h3>";
      html += '<ul class="course-success-list">';
      html += row("Empfänger", c.bank_recipient);
      html += row("IBAN", c.iban);
      html += row("Verwendungszweck", esc(fillPlaceholders(c.payment_reference)));
      if (c.price) html += row("Betrag", c.price);
      html += "</ul>";
      html += "</div>";
    }

    if (c.extra_note) {
      html += '<div class="course-success-note prose">' + c.extra_note + "</div>";
    }

    cardEl.innerHTML = html;
  });
})();
