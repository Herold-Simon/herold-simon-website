/* Erfolgsseite nach Anmeldung: Konfetti + Kursdaten (Ort, Zeit, Preis, Bank). */
(function () {
  /* ---------- Konfetti ---------- */
  function fireConfetti() {
    if (typeof confetti !== "function") return;
    var end = Date.now() + 1500;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 } });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
  }
  fireConfetti();

  if (!window.SB) return;
  var sb = window.SB.get();
  var cardEl = document.querySelector("[data-success-card]");

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
    html += row("Wo", c.location);
    html += row("Preis", c.price);
    html += "</ul>";

    var hasBank = c.iban || c.bank_recipient || c.payment_reference;
    if (hasBank) {
      html += '<div class="course-success-pay">';
      html += "<h3>Zahlung per Überweisung</h3>";
      html += '<ul class="course-success-list">';
      html += row("Empfänger", c.bank_recipient);
      html += row("IBAN", c.iban);
      html += row("Verwendungszweck", c.payment_reference);
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
