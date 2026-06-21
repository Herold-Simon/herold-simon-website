/* Zentrale Supabase-Konfiguration für alle Seiten.
   Der Publishable/Anon-Key darf öffentlich im Browser stehen –
   der Schutz erfolgt über die Row-Level-Security-Regeln in Supabase. */
(function () {
  var SUPABASE_URL = "https://whcgamoleidheezrkyau.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoY2dhbW9sZWlkaGVlenJreWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDI3MzMsImV4cCI6MjA5NzYxODczM30.vZr0yocv1aOcf8xAkh8WZ8okIO60dOftpcSF9c1rOl8";

  var client = null;

  function get() {
    if (!client) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  // Bild-URL aufbereiten: volle URLs (Supabase Storage) bleiben unverändert,
  // relative Pfade (z. B. mit Leerzeichen) werden korrekt kodiert.
  function imgUrl(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return u
      .split("/")
      .map(function (part) { return encodeURIComponent(part); })
      .join("/");
  }

  window.SB = { get: get, imgUrl: imgUrl, URL: SUPABASE_URL, ANON_KEY: SUPABASE_ANON_KEY };
})();
