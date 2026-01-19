/* =========================================================
   MARKSELLING — SIMULATORE + REPORT + SHARE LINK + VIEW MODE
   Font: Roboto (caricalo in index.html)
   - Share URL: ?msr=...
   - View-only mode: se msr presente -> mostra solo report
   - Report: 3 aree + checklist operativa + KPI + alert
========================================================= */

(function () {
  "use strict";

  /* ---------------------------
     DOM HELPERS
  --------------------------- */
  function $(id) { return document.getElementById(id); }
  function isFiniteNum(n) { return typeof n === "number" && isFinite(n); }
  function safeNum(n) { n = +n; return isFinite(n) ? n : 0; }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function money(x) {
    x = safeNum(x);
    try {
      return x.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    } catch (e) {
      return "€ " + Math.round(x).toString();
    }
  }

  /* ---------------------------
     SHARE LINK (msr=payload)
  --------------------------- */
  var SHARE_PARAM = "msr";

  function b64urlEncode(str) {
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function b64urlDecode(b64url) {
    var b64 = (b64url || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return null; }
  }
  function getSharedPayloadFromUrl() {
    try {
      var sp = new URLSearchParams(window.location.search);
      var v = sp.get(SHARE_PARAM);
      if (!v) return null;
      var json = b64urlDecode(v);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  function buildShareLink(payload) {
    var url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM, b64urlEncode(JSON.stringify(payload)));
    url.hash = "";
    return url.toString();
  }
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e2) {
      return false;
    }
  }

  /* ---------------------------
     STANDARD TAGS (MOTIVI)
  --------------------------- */
  var REASONS = [
    { key: "fuori_target", label: "Fuori target", desc: "Mismatch con pubblico ideale" },
    { key: "fuori_budget", label: "Fuori budget", desc: "Capacità di spesa non compatibile" },
    { key: "non_idoneo", label: "Non idoneo", desc: "Non rientra nei requisiti" },
    { key: "non_pronto", label: "Non pronto", desc: "Timing e priorità" },
    { key: "fid_brand", label: "Blocco fiducia brand", desc: "Autorità percepita" },
    { key: "fid_prod", label: "Blocco fiducia prodotto/servizio", desc: "Scetticismo / prova" },
    { key: "prezzo_valore", label: "Blocco prezzo/valore", desc: "Percezione valore" },
    { key: "competitor", label: "Ha scelto competitor", desc: "Alternativa preferita" },
    { key: "non_qual", label: "Non qualificato (bad data / no risposta)", desc: "Reperibilità e qualità contatto" }
  ];

  function coverage(obj) {
    obj = obj || {};
    var total = REASONS.length;
    var ok = 0;
    REASONS.forEach(function (r) { if (!!obj[r.key]) ok++; });
    return { total: total, ok: ok, miss: Math.max(0, total - ok) };
  }

  /* ---------------------------
     REPORT ENGINE — 3 AREE
  --------------------------- */
  function mkItem(area, title, impactEur, why, implement, kpiMacro, kpiMicro, alerts) {
    return {
      area: area,
      title: title,
      impact: safeNum(impactEur),
      why: why || "",
      implement: implement || [],
      kpi_macro: kpiMacro || [],
      kpi_micro: kpiMicro || [],
      alerts: alerts || []
    };
  }

  function generateDetailedReport(state, result) {
    // result: { wastePct, lossPct, wasteEur, lossEur }
    var waste = safeNum(result && result.wasteEur);
    var loss = safeNum(result && result.lossEur);

    var area1Pool = waste * 0.60;
    var area2Pool = loss * 0.55;
    var area3Pool = (waste * 0.40) + (loss * 0.45);

    var rep = {
      meta: { v: "MSR-2", created_at: new Date().toISOString() },
      summary: {
        wasteEur: waste, lossEur: loss,
        wastePct: safeNum(result && result.wastePct),
        lossPct: safeNum(result && result.lossPct),
        totalEur: waste + loss
      },
      areas: {
        a1: { title: "Area 1 — Setup & Tracciamento", items: [] },
        a2: { title: "Area 2 — Controllo operativo vendite", items: [] },
        a3: { title: "Area 3 — Sinergia Marketing ↔ Vendite (feedback & attribuzione)", items: [] }
      }
    };

    // A1 — CRM / tracciamento / workflow / WA / tags
    var crmOk = (state && state.crmOk === true);
    var crmMissing = (state && state.crmOk === false);

    if (crmMissing) {
      rep.areas.a1.items.push(mkItem(
        "a1",
        "CRM non usato come centro del processo (lead, pipeline, automazioni)",
        area1Pool * 0.35,
        "Senza CRM non esiste controllo: il marketing ottimizza su KPI parziali e le vendite diventano improvvisazione.",
        [
          "Attivare un CRM operativo (lead + pipeline + automazioni).",
          "Centralizzare TUTTI i lead nel CRM (form, WhatsApp, email, chiamate).",
          "Definire pipeline con stati chiari e responsabilità (chi fa cosa, quando)."
        ],
        ["% contatto", "% appuntamenti", "% show", "% chiusura", "CPA reale (costo per vendita)"],
        ["tempo primo contatto", "tentativi medi per lead", "lead persi/abbandonati"],
        ["Alert se tempo primo contatto > 10 min", "Alert se % contatto scende sotto soglia"]
      ));
    } else if (crmOk) {
      var f = (state && state.crmFeat) || {};
      if (!f.score) {
        rep.areas.a1.items.push(mkItem(
          "a1",
          "Integrare Lead Scoring (priorità contatto al momento giusto)",
          area1Pool * 0.22,
          "Senza scoring tratti tutti i lead uguali: perdi i caldi e sprechi tempo sui freddi.",
          [
            "Definire segnali di interesse (reply, click, visita pagina, richiesta info, call).",
            "Assegnare punteggi e soglie: Freddo / Tiepido / Caldo.",
            "Trigger: lead caldo → contatto immediato + notifica vendite; tiepido → nurturing; freddo → recupero programmato."
          ],
          ["% contatto su lead caldi", "% appuntamenti da lead caldi", "% chiusura per fascia score"],
          ["tempo primo contatto per fascia score", "azioni tracciate prima della call"],
          ["Alert se conversione lead caldi→appuntamento cala", "Alert se tempi contatto lead caldi > 5 min"]
        ));
      }
      if (!f.wf) {
        rep.areas.a1.items.push(mkItem(
          "a1",
          "Workflow automatici: follow-up strategici in base alle azioni tracciate",
          area1Pool * 0.18,
          "Senza workflow perdi continuità: i lead vengono dimenticati o ricontattati tardi.",
          [
            "Workflow immediato post-lead (0–10 min): messaggio + instradamento pipeline.",
            "Workflow 'non risponde': sequenza 5 tentativi multicanale (WA/email/call).",
            "Workflow 'non pronto': nurturing con contenuti + micro-CTA + ripresa contatto."
          ],
          ["% contatto", "% risposta", "% recupero lead non risponde", "% conversione nurturing→appuntamento"],
          ["tempo tra tentativi", "n° tentativi per lead", "tasso reply per canale"],
          ["Alert se lead non contattato entro SLA", "Alert se recovery rate scende"]
        ));
      }
      var ch = (state && state.crmChan) || {};
      if (!ch.wa) {
        rep.areas.a1.items.push(mkItem(
          "a1",
          "Automazioni WhatsApp/SMS (contatto istantaneo + recupero)",
          area1Pool * 0.15,
          "WhatsApp aumenta velocità e tasso di contatto: senza, perdi i primi minuti e i lead si raffreddano.",
          [
            "Messaggio immediato post-lead: conferma + micro-domanda (1 click).",
            "Reminder appuntamento (24h/2h) e no-show recovery.",
            "Messaggi dinamici in base a tag/score (caldo/tiepido/freddo)."
          ],
          ["% contatto", "% show", "% no-show", "% recupero no-show"],
          ["tempo prima risposta WA", "reply rate WA", "click rate CTA"],
          ["Alert se no-show sale", "Alert se reply rate WA scende"]
        ));
      }
    }

    var fbCov = coverage((state && state.fb) || {});
    if (fbCov.ok < REASONS.length) {
      rep.areas.a1.items.push(mkItem(
        "a1",
        "Tag obbligatori su ogni lead/opportunità (motivo mancata chiusura)",
        area1Pool * 0.25,
        "Se i motivi NON sono tracciati, il marketing ottimizza su KPI facili e nasce lo scaricabarile.",
        [
          "Creare i tag standard (lista completa) e renderli obbligatori in chiusura opportunità.",
          "Aggiungere campo 'Motivo esito' mandatory: selezione forzata.",
          "Associare motivi → interventi (messaggio/targeting/offerta/prova sociale)."
        ],
        ["Top 3 motivi perdita", "Varianza motivi per fonte", "Chiusura per motivo"],
        ["note call + obiezioni ricorrenti", "tempo in pipeline per motivo"],
        ["Alert se 'Fuori target' supera soglia", "Alert se 'Prezzo/valore' cresce"]
      ));
    }

    // A2 — SLA / tentativi / script / profilazione
    var sc = (state && state.salesControls) || {};

    if (!sc.script) {
      rep.areas.a2.items.push(mkItem(
        "a2",
        "Script di setting e closing + controllo qualità chiamate",
        area2Pool * 0.28,
        "Senza script standard, le performance oscillano e i feedback sono inutilizzabili dal marketing.",
        [
          "Script setting: prequalifica (budget/need/timing), promessa, prossimi step.",
          "Script closing: obiezioni principali (prezzo/valore, fiducia, competitor) + prova sociale.",
          "Quality check: checklist call + campionamento settimanale."
        ],
        ["% appuntamenti→show", "% show→chiusura", "conversione per venditore"],
        ["aderenza script (score qualità)", "obiezioni per venditore", "durata call per fase"],
        ["Alert se conversione venditore scende", "Alert se qualità call scende sotto soglia"]
      ));
    }
    if (!sc.c10) {
      rep.areas.a2.items.push(mkItem(
        "a2",
        "SLA: contatto entro 10 minuti (misurato e obbligatorio)",
        area2Pool * 0.26,
        "Oltre i primi minuti, la probabilità di conversione crolla.",
        [
          "Alert immediato al venditore/setter alla creazione lead.",
          "Regola: se non contatti entro 10 min → escalation al manager.",
          "Dashboard: tempo medio primo contatto per fonte/campagna/venditore."
        ],
        ["% contatto", "% appuntamenti", "% chiusura", "CPA reale"],
        ["tempo primo contatto", "n° lead contattati entro SLA", "lead in backlog"],
        ["Alert se % contatto < soglia", "Alert se tempo medio primo contatto > 10 min"]
      ));
    }
    if (!sc.c5) {
      rep.areas.a2.items.push(mkItem(
        "a2",
        "Gestione corretta mancata risposta: 5 tentativi + recupero",
        area2Pool * 0.20,
        "La maggior parte delle vendite perse è “silenziosa”: lead abbandonati troppo presto.",
        [
          "Sequenza 5 tentativi: 0h (WA), 2h (call), 24h (WA), 72h (call), 7d (email/WA).",
          "Tag 'Non risponde' + motivo (bad data / timing / no interesse).",
          "Recovery: nurturing + ripresa contatto su segnali di interesse."
        ],
        ["% recupero non risponde", "% reply", "% appuntamenti da recovery"],
        ["tentativi medi per lead", "tasso risposta per canale", "tempo tra tentativi"],
        ["Alert se recovery rate scende", "Alert se tentativi medi < 5"]
      ));
    }

    rep.areas.a2.items.push(mkItem(
      "a2",
      "Profilazione lead (etichette) + gestione per priorità",
      area2Pool * 0.12,
      "Senza profilazione i lead vengono trattati uguali: i caldi non ricevono attenzione immediata.",
      [
        "Etichette minime: Tipo richiesta, livello interesse, timing, budget, motivo perdita, fonte annuncio (UTM).",
        "Routing automatico: lead caldo → venditore senior; tiepido → nurturing; freddo → recupero.",
        "Standardizzare note post-call (obiezione + next step)."
      ],
      ["% chiusura per segmento", "% contatto per segmento"],
      ["tempo contatto per segmento", "obiezioni per segmento"],
      ["Alert se segmento 'caldo' non contattato entro SLA"]
    ));

    // A3 — report per campagna/adset + KPI/alert
    var campCov = coverage((state && state.camp) || {});
    var adsetCov = coverage((state && state.adset) || {});

    if (campCov.ok < REASONS.length) {
      rep.areas.a3.items.push(mkItem(
        "a3",
        "Reportistica quotidiana divisa per ANNUNCIO di provenienza (campagna)",
        area3Pool * 0.26,
        "Se non distingui i motivi per campagna, continui a finanziare campagne “che fanno lead” ma non vendono.",
        [
          "UTM obbligatori per ogni campagna → salvati nel CRM.",
          "Report giornaliero: Campagna → (contatto, appuntamenti, show, chiusure, motivi perdita).",
          "Regola: budget riallocato ogni settimana sui pubblici con qualità migliore."
        ],
        ["CPL per campagna", "CPA per campagna", "Appuntamenti per campagna", "Chiusure per campagna"],
        ["Motivo perdita per campagna", "tempo contatto per campagna"],
        ["Alert se CPA campagna peggiora", "Alert se 'Fuori target' cresce su campagna"]
      ));
    }

    if (adsetCov.ok < REASONS.length) {
      rep.areas.a3.items.push(mkItem(
        "a3",
        "Attribuzione per targeting (adset): qualità lead per PUBBLICO",
        area3Pool * 0.18,
        "Il vero spreco spesso è nel targeting: senza lettura per pubblico, bruci budget sui segmenti sbagliati.",
        [
          "UTM + parametro adset/pubblico nel CRM.",
          "Report: Pubblico → motivi perdita + conversioni.",
          "Spegni pubblici con motivi critici ricorrenti e scala i migliori."
        ],
        ["CPA per pubblico", "% chiusura per pubblico", "show rate per pubblico"],
        ["Motivo perdita per pubblico", "obiezioni per pubblico"],
        ["Alert se pubblico degrada su qualità", "Alert se competitor cresce su pubblico"]
      ));
    }

    rep.areas.a3.items.push(mkItem(
      "a3",
      "Monitoraggio KPI (macro + micro) + alert automatici appena peggiorano",
      area3Pool * 0.22,
      "Senza telemetria, scopri il problema quando hai già bruciato settimane di budget.",
      [
        "Dashboard unica: marketing + vendite nello stesso pannello (fine scaricabarile).",
        "Macro KPI: CPL, % contatto, % appuntamenti, % show, % chiusura, CPA reale, ROAS/ROMI.",
        "Micro KPI: tempo primo contatto, tentativi medi, recovery rate, obiezioni top, motivi perdita per annuncio.",
        "Alert automatici quando una metrica scende sotto soglia (email/WA al manager)."
      ],
      ["CPL", "% contatto", "% appuntamenti", "% show", "% chiusura", "CPA reale", "ROAS/ROMI"],
      ["tempo primo contatto", "tentativi medi", "recovery rate", "motivo perdita per annuncio", "obiezioni top"],
      ["Alert se % contatto cala", "Alert se no-show sale", "Alert se chiusure calano", "Alert se 'Fuori target' cresce"]
    ));

    return rep;
  }

  function renderReportHTML(payload) {
    var rep = payload.report;
    var sum = rep.summary;

    function pill(text) {
      return "<span style=\"display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(11,18,32,.12);background:#fff;font-size:12px;font-weight:900;color:rgba(11,18,32,.78);\">" + esc(text) + "</span>";
    }

    function listBlock(title, arr) {
      if (!arr || !arr.length) return "";
      var li = arr.map(function (x) {
        return "<li style=\"margin:0 0 6px 0;line-height:1.45;\">" + esc(x) + "</li>";
      }).join("");
      return "" +
        "<div style=\"margin-top:10px;\">" +
        "<div style=\"font-size:12px;font-weight:900;color:rgba(11,18,32,.82);margin-bottom:8px;\">" + esc(title) + "</div>" +
        "<ul style=\"margin:0;padding-left:18px;font-size:12px;color:rgba(11,18,32,.82);\">" + li + "</ul>" +
        "</div>";
    }

    function itemCard(it) {
      return "" +
        "<div style=\"border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
        "<div style=\"display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;\">" +
        "<div style=\"min-width:240px;flex:1 1 auto;\">" +
        "<div style=\"font-size:13px;font-weight:900;color:#0b1220;\">" + esc(it.title) + "</div>" +
        (it.why ? "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.5;\">" + esc(it.why) + "</div>" : "") +
        "</div>" +
        "<div style=\"flex:0 0 auto;text-align:right;\">" +
        "<div style=\"font-size:11px;font-weight:900;color:rgba(11,18,32,.62);\">Impatto stimato</div>" +
        "<div style=\"font-size:18px;font-weight:900;color:#b91c1c;margin-top:2px;\">" + money(it.impact) + "</div>" +
        "</div>" +
        "</div>" +
        listBlock("Cosa implementare (checklist operativa)", it.implement) +
        listBlock("KPI Macro da monitorare", it.kpi_macro) +
        listBlock("KPI Micro da monitorare", it.kpi_micro) +
        listBlock("Alert consigliati", it.alerts) +
        "</div>";
    }

    function sumArea(items) {
      var s = 0; (items || []).forEach(function (it) { s += safeNum(it.impact); });
      return s;
    }

    function areaBox(areaKey) {
      var area = rep.areas[areaKey];
      var items = area.items || [];
      var tot = sumArea(items);

      var header = "" +
        "<div style=\"display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;\">" +
        "<div>" +
        "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">" + esc(area.title) + "</div>" +
        "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.5;\">" +
        "Checklist completa e professionale: implementazioni specifiche, KPI e alert per portare il processo sotto controllo." +
        "</div>" +
        "</div>" +
        "<div style=\"text-align:right;\">" +
        "<div style=\"font-size:11px;font-weight:900;color:rgba(11,18,32,.62);\">Perdita stimata area</div>" +
        "<div style=\"font-size:18px;font-weight:900;color:#b91c1c;margin-top:2px;\">" + money(tot) + "</div>" +
        "</div>" +
        "</div>";

      var body = items.length ? items.map(itemCard).join("") :
        "<div style=\"margin-top:10px;font-size:12px;font-weight:900;color:#065f46;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.10);padding:10px 12px;border-radius:14px;\">✓ Nessuna criticità evidente in questa area (ottimo).</div>";

      return "" +
        "<div style=\"border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:18px;padding:14px;margin-top:12px;\">" +
        header +
        "<div style=\"margin-top:12px;\">" + body + "</div>" +
        "</div>";
    }

    var shareBox = "" +
      "<div style=\"border:1px solid rgba(11,18,32,.12);background:#ffffff;border-radius:18px;padding:14px;margin-top:12px;\">" +
      "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">Condividi questa analisi con il tuo marketing</div>" +
      "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.5;\">" +
      "Copia il link univoco del report e inoltralo al team marketing/agenzia. È la base per un confronto oggettivo (niente scaricabarile)." +
      "</div>" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;\">" +
      "<button type=\"button\" onclick=\"MS_TF.copyShare()\" style=\"cursor:pointer;border:1px solid rgba(11,18,32,.14);background:#ffffff;color:#0b1220;padding:13px 14px;border-radius:14px;font-weight:900;flex:1 1 220px;\">Copia link report</button>" +
      "<button type=\"button\" onclick=\"MS_TF.openShare()\" style=\"cursor:pointer;border:1px solid rgba(11,18,32,.14);background:#ffffff;color:#0b1220;padding:13px 14px;border-radius:14px;font-weight:900;flex:1 1 180px;\">Apri link</button>" +
      "</div>" +
      "<div id=\"ms_copy_ok\" style=\"display:none;margin-top:10px;font-size:12px;font-weight:900;color:#065f46;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.10);padding:10px 12px;border-radius:14px;\">✓ Link copiato. Incollalo su WhatsApp o email.</div>" +
      "</div>";

    var exec = "" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" +
      pill("Spreco ADV: " + money(sum.wasteEur)) +
      pill("Fatturato perso: " + money(sum.lossEur)) +
      pill("Totale stimato: " + money(sum.totalEur)) +
      "</div>" +
      "<div style=\"margin-top:10px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">" +
      "Questa è una checklist operativa MarkSelling: indica cosa implementare nello specifico, quali KPI monitorare e quali alert attivare per correggere subito rotta." +
      "</div>";

    var html = "";
    html += exec;
    html += areaBox("a1");
    html += areaBox("a2");
    html += areaBox("a3");
    html += shareBox;

    html += "" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;\">" +
      "<a href=\"https://www.markselling.it/booking-audit/\" style=\"flex:1 1 220px;text-decoration:none;text-align:center;background:#DC2626;color:#fff;padding:13px 14px;border-radius:14px;font-weight:900;border:1px solid rgba(0,0,0,.25);\">Prenota Audit</a>" +
      "<button type=\"button\" onclick=\"MS_TF.backToAnswers()\" style=\"flex:1 1 160px;cursor:pointer;border:1px solid rgba(11,18,32,.14);background:#ffffff;color:#0b1220;padding:13px 14px;border-radius:14px;font-weight:900;\">Torna alle risposte</button>" +
      "</div>";

    return html;
  }

  function makeSharePayload(state, result, report) {
    return {
      meta: { v: "MSR-2", created_at: new Date().toISOString() },
      input: state,
      result: result,
      report: report
    };
  }

  /* ---------------------------
     MS_TF PUBLIC API
  --------------------------- */
  window.MS_TF = window.MS_TF || {};
  window.MS_TF._report = {
    generateDetailedReport: generateDetailedReport,
    renderReportHTML: renderReportHTML,
    makeSharePayload: makeSharePayload,
    buildShareLink: buildShareLink,
    getSharedPayloadFromUrl: getSharedPayloadFromUrl
  };

  window.MS_TF.copyShare = async function () {
    try {
      var payload = window.MS_TF._lastSharePayload;
      if (!payload) return;
      var link = buildShareLink(payload);
      var ok = await copyToClipboard(link);
      var box = $("ms_copy_ok");
      if (ok && box) {
        box.style.display = "block";
        setTimeout(function () { box.style.display = "none"; }, 2200);
      }
      if (!ok) alert("Copia manualmente questo link:\n\n" + link);
    } catch (e) { }
  };

  window.MS_TF.openShare = function () {
    try {
      var payload = window.MS_TF._lastSharePayload;
      if (!payload) return;
      var link = buildShareLink(payload);
      window.open(link, "_blank");
    } catch (e) { }
  };

  window.MS_TF.backToAnswers = function () {
    if (window.MS_TF && typeof window.MS_TF.back === "function") window.MS_TF.back();
  };

  /* ---------------------------
     TYPEFORM-LIKE ENGINE
  --------------------------- */

  // State (risposte)
  var S = {};

  // Steps
  var STEPS = [];
  function addStep(id, q, sub, renderFn, validateFn) {
    STEPS.push({
      id: id,
      q: q,
      sub: sub || "",
      render: renderFn,
      validate: validateFn || function () { return true; }
    });
  }

  var idx = 0;

  function setErr(msg) {
    var el = $("ms_err");
    if (!el) return;
    if (!msg) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = msg;
  }

  function setProgress() {
    var wrap = $("ms_progress_wrap");
    var bar = $("ms_progress_bar");
    if (!wrap || !bar) return;
    var p = STEPS.length ? ((idx + 1) / STEPS.length) * 100 : 0;
    bar.style.width = Math.max(2, Math.min(100, p)).toFixed(2) + "%";
  }

  function renderCurrent() {
    setErr("");
    setProgress();

    var step = STEPS[idx];
    if (!step) return;

    var q = $("ms_step_question");
    var sub = $("ms_step_sub");
    var body = $("ms_step_body");

    if (q) q.textContent = step.q;
    if (sub) sub.textContent = step.sub;
    if (body) body.innerHTML = step.render();

    var backBtn = $("ms_back_btn");
    var nextBtn = $("ms_next_btn");

    if (backBtn) backBtn.style.display = idx === 0 ? "none" : "inline-flex";
    if (nextBtn) nextBtn.textContent = (step.id === "result") ? "Fine" : "Avanti";
  }

  function next() {
    var step = STEPS[idx];
    if (!step) return;

    try {
      var ok = step.validate ? step.validate() : true;
      if (!ok) return;
    } catch (e) {
      setErr("Controlla i campi e riprova.");
      return;
    }

    if (idx < STEPS.length - 1) {
      idx++;
      renderCurrent();
      scrollTopSafe();
    }
  }

  function back() {
    if (idx > 0) {
      idx--;
      renderCurrent();
      scrollTopSafe();
    }
  }

  function scrollTopSafe() {
    try {
      var top = $("ms_top");
      if (top && top.scrollIntoView) top.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { }
  }

  window.MS_TF.next = next;
  window.MS_TF.back = back;

  /* ---------------------------
     CALC (prudenziale)
     - wastePct cap 35%
     - lossPct cap 55%
  --------------------------- */
  function calc() {
    var adv = safeNum(S.advSpend);
    var rev = safeNum(S.monthRevenue);

    // base
    var wastePct = 0.12; // 12% base
    var lossPct = 0.18;  // 18% base

    // penalità per assenza controllo
    if (S.crmOk === false) wastePct += 0.10;
    if (!S.salesControls || S.salesControls.c10 !== true) lossPct += 0.10;
    if (!S.salesControls || S.salesControls.c5 !== true) lossPct += 0.07;
    if (!S.salesControls || S.salesControls.script !== true) lossPct += 0.06;

    // se manca WA/workflow/score => spreco e perdita
    if (!S.crmFeat || S.crmFeat.wf !== true) { wastePct += 0.04; lossPct += 0.03; }
    if (!S.crmFeat || S.crmFeat.score !== true) { wastePct += 0.02; lossPct += 0.04; }
    if (!S.crmChan || S.crmChan.wa !== true) { wastePct += 0.03; lossPct += 0.02; }

    // cap
    wastePct = Math.min(0.35, Math.max(0.05, wastePct));
    lossPct = Math.min(0.55, Math.max(0.08, lossPct));

    var wasteEur = adv * wastePct;
    var lossEur = rev * lossPct;

    return {
      wastePct: wastePct,
      lossPct: lossPct,
      wasteEur: wasteEur,
      lossEur: lossEur
    };
  }

  /* ---------------------------
     UI COMPONENTS (HTML)
  --------------------------- */
  function inputRow(label, html) {
    return "" +
      "<div style=\"margin:0 0 12px 0;\">" +
      "<div style=\"font-size:12px;font-weight:900;color:rgba(11,18,32,.80);margin-bottom:6px;\">" + esc(label) + "</div>" +
      html +
      "</div>";
  }

  function numInput(id, placeholder) {
    return "<input id=\"" + esc(id) + "\" inputmode=\"numeric\" style=\"width:100%;padding:14px;border-radius:14px;border:1px solid rgba(11,18,32,.14);font-size:14px;font-weight:800;outline:none;\" placeholder=\"" + esc(placeholder || "") + "\" />";
  }

  function yesNo(id, yesLabel, noLabel, val) {
    var y = (val === true), n = (val === false);
    return "" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" +
      "<button type=\"button\" data-yn=\"" + esc(id) + "\" data-v=\"1\" style=\"flex:1 1 160px;cursor:pointer;padding:14px;border-radius:14px;border:1px solid rgba(11,18,32,.14);font-weight:900;background:" + (y ? "#0b1220" : "#fff") + ";color:" + (y ? "#fff" : "#0b1220") + ";\">"+esc(yesLabel||"Sì")+"</button>" +
      "<button type=\"button\" data-yn=\"" + esc(id) + "\" data-v=\"0\" style=\"flex:1 1 160px;cursor:pointer;padding:14px;border-radius:14px;border:1px solid rgba(11,18,32,.14);font-weight:900;background:" + (n ? "#0b1220" : "#fff") + ";color:" + (n ? "#fff" : "#0b1220") + ";\">"+esc(noLabel||"No")+"</button>" +
      "</div>";
  }

  function bindYesNo() {
    var body = $("ms_step_body");
    if (!body) return;
    body.querySelectorAll("button[data-yn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-yn");
        var v = btn.getAttribute("data-v") === "1";
        // support nested keys like "crmFeat.score"
        setByPath(S, key, v);
        renderCurrent();
      });
    });
  }

  function setByPath(obj, path, value) {
    if (!path) return;
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }
  function getByPath(obj, path) {
    if (!path) return undefined;
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /* ---------------------------
     STEPS (base demo solido)
     -> puoi cambiarli, ma il risultato resta stabile
  --------------------------- */

  addStep(
    "start",
    "Calcola quanto stai perdendo ogni mese",
    "Stima prudenziale: spreco ADV + fatturato perso per assenza di controllo tra marketing e vendite.",
    function () {
      var html = "";
      html += inputRow("Budget ADV mensile", numInput("advSpend", "Es. 3000"));
      html += inputRow("Fatturato medio mensile", numInput("monthRevenue", "Es. 25000"));
      html += "<div style=\"margin-top:10px;font-size:12px;color:rgba(11,18,32,.70);line-height:1.55;\">Inserisci numeri realistici. Se non li sai precisi, usa una media prudenziale.</div>";
      return html;
    },
    function () {
      var advEl = $("advSpend");
      var revEl = $("monthRevenue");
      var adv = safeNum(advEl && advEl.value);
      var rev = safeNum(revEl && revEl.value);
      if (adv <= 0) { setErr("Inserisci un budget ADV mensile valido."); return false; }
      if (rev <= 0) { setErr("Inserisci un fatturato medio mensile valido."); return false; }
      S.advSpend = adv;
      S.monthRevenue = rev;
      return true;
    }
  );

  addStep(
    "crm",
    "Hai un CRM usato davvero come centro del processo?",
    "Non “un foglio Excel”: intendo pipeline, automazioni, stato lead, responsabilità e follow-up misurato.",
    function () {
      return yesNo("crmOk", "Sì, CRM operativo", "No, non operativo", getByPath(S, "crmOk"));
    },
    function () { return (S.crmOk === true || S.crmOk === false) || (setErr("Seleziona una risposta."), false); }
  );

  addStep(
    "automation",
    "Hai automazioni e WhatsApp per contatto immediato + recupero?",
    "Qui si decide la velocità: se non contatti subito, il lead si raffredda.",
    function () {
      var html = "";
      html += inputRow("Workflow automatici (follow-up, nurturing, recupero)", yesNo("crmFeat.wf", "Sì", "No", getByPath(S, "crmFeat.wf")));
      html += "<div style=\"height:10px\"></div>";
      html += inputRow("Lead Scoring (caldo/tiepido/freddo)", yesNo("crmFeat.score", "Sì", "No", getByPath(S, "crmFeat.score")));
      html += "<div style=\"height:10px\"></div>";
      html += inputRow("WhatsApp/SMS automatico post-lead", yesNo("crmChan.wa", "Sì", "No", getByPath(S, "crmChan.wa")));
      return html;
    },
    function () {
      // non blocco: se non risponde a tutti, ok. Ma almeno 1 selezione fatta:
      var wf = getByPath(S, "crmFeat.wf");
      var sc = getByPath(S, "crmFeat.score");
      var wa = getByPath(S, "crmChan.wa");
      if (wf === undefined && sc === undefined && wa === undefined) { setErr("Seleziona almeno una risposta."); return false; }
      return true;
    }
  );

  addStep(
    "sales",
    "Il team vendite rispetta regole operative misurabili?",
    "Contatto entro 10 minuti, 5 tentativi se non risponde, script e controllo qualità.",
    function () {
      var html = "";
      html += inputRow("Contatto entro 10 minuti (SLA)", yesNo("salesControls.c10", "Sì", "No", getByPath(S, "salesControls.c10")));
      html += "<div style=\"height:10px\"></div>";
      html += inputRow("5 tentativi minimi se non risponde", yesNo("salesControls.c5", "Sì", "No", getByPath(S, "salesControls.c5")));
      html += "<div style=\"height:10px\"></div>";
      html += inputRow("Script + controllo qualità chiamate", yesNo("salesControls.script", "Sì", "No", getByPath(S, "salesControls.script")));
      return html;
    },
    function () {
      var c10 = getByPath(S, "salesControls.c10");
      var c5 = getByPath(S, "salesControls.c5");
      var script = getByPath(S, "salesControls.script");
      if (c10 === undefined && c5 === undefined && script === undefined) { setErr("Seleziona almeno una risposta."); return false; }
      return true;
    }
  );

  addStep(
    "result",
    "Risultati",
    "Risultati mensili — ecco la stima prudenziale e la reportistica MarkSelling dettagliata.",
    function () {
      var r = calc();
      var report = generateDetailedReport(S, r);
      var payload = makeSharePayload(S, r, report);
      window.MS_TF._lastSharePayload = payload;
      return renderReportHTML(payload);
    },
    function () { return true; }
  );

  /* ---------------------------
     VIEW MODE: ?msr=...
  --------------------------- */
  function tryRenderSharedViewMode() {
    var shared = getSharedPayloadFromUrl();
    if (!shared || !shared.report) return false;

    var stepQ = $("ms_step_question");
    var stepS = $("ms_step_sub");
    var body = $("ms_step_body");
    var backBtn = $("ms_back_btn");
    var nextBtn = $("ms_next_btn");
    var err = $("ms_err");
    var prog = $("ms_progress_wrap");
    var nav = $("ms_nav");

    if (stepQ) stepQ.textContent = "Report MarkSelling (condiviso)";
    if (stepS) stepS.textContent = "Vista sola lettura: analisi operativa + checklist implementazione.";
    if (body) body.innerHTML = renderReportHTML(shared);

    if (backBtn) backBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
    if (err) err.style.display = "none";
    if (prog) prog.style.display = "none";
    if (nav) nav.style.display = "none";

    window.MS_TF._lastSharePayload = shared;
    return true;
  }

  /* ---------------------------
     INIT
  --------------------------- */
  function wireNav() {
    var backBtn = $("ms_back_btn");
    var nextBtn = $("ms_next_btn");
    if (backBtn) backBtn.addEventListener("click", back);
    if (nextBtn) nextBtn.addEventListener("click", next);
  }

  function init() {
    // view-only
    if (tryRenderSharedViewMode()) return;

    wireNav();
    renderCurrent();

    // bind yes/no click handlers after render
    // (rebind ad ogni renderCurrent)
    var _origRender = renderCurrent;
    renderCurrent = function () {
      _origRender();
      bindYesNo();
    };
    renderCurrent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
