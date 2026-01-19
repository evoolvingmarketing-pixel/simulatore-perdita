/* =========================
  MARKSELLING — REPORT + SHARE ENGINE (PEZZO 1/3)
  - View mode da URL: ?msr=...
  - Share link univoco (base64url JSON)
  - Report dettagliato (3 aree) + checklist professionale
  NOTE: Questo pezzo NON tocca i tuoi step/questionario.
========================= */

(function(){
  // Se nel tuo app.js esiste già un IIFE (function(){...})();,
  // NON inserirne un altro. In quel caso, incolla SOLO il contenuto
  // e rimuovi la riga sopra e l'ultima riga di chiusura.
  // Se invece il tuo file è già strutturato con (function(){ ... })();,
  // allora incolla questo pezzo DENTRO a quello.

  // --- helpers base ---
  function $(id){ return document.getElementById(id); }
  function isFiniteNum(n){ return typeof n === "number" && isFinite(n); }
  function safeNum(n){ n = +n; return isFinite(n) ? n : 0; }
  function esc(s){
    return String(s||"")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function money(x){
    x = safeNum(x);
    return x.toLocaleString("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
  }

  // =========================
  // SHARE LINK (msr=payload)
  // =========================
  var SHARE_PARAM = "msr";

  function b64urlEncode(str){
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlDecode(b64url){
    var b64 = (b64url||"").replace(/-/g,'+').replace(/_/g,'/');
    while(b64.length % 4) b64 += "=";
    try{ return decodeURIComponent(escape(atob(b64))); }catch(e){ return null; }
  }
  function getSharedPayloadFromUrl(){
    try{
      var sp = new URLSearchParams(window.location.search);
      var v = sp.get(SHARE_PARAM);
      if(!v) return null;
      var json = b64urlDecode(v);
      if(!json) return null;
      return JSON.parse(json);
    }catch(e){
      return null;
    }
  }
  function buildShareLink(payload){
    var url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM, b64urlEncode(JSON.stringify(payload)));
    url.hash = "";
    return url.toString();
  }
  async function copyToClipboard(text){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(e){}
    try{
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
    }catch(e2){
      return false;
    }
  }

  // =========================
  // CHECKLIST — motivi perdita (tag)
  // =========================
  var REASONS = [
    {key:"fuori_target",  label:"Fuori target", desc:"Mismatch con pubblico ideale"},
    {key:"fuori_budget",  label:"Fuori budget", desc:"Capacità di spesa non compatibile"},
    {key:"non_idoneo",    label:"Non idoneo", desc:"Non rientra nei requisiti"},
    {key:"non_pronto",    label:"Non pronto", desc:"Timing e priorità"},
    {key:"fid_brand",     label:"Blocco fiducia brand", desc:"Autorità percepita"},
    {key:"fid_prod",      label:"Blocco fiducia prodotto/servizio", desc:"Scetticismo / prova"},
    {key:"prezzo_valore", label:"Blocco prezzo/valore", desc:"Percezione valore"},
    {key:"competitor",    label:"Ha scelto competitor", desc:"Alternativa preferita"},
    {key:"non_qual",      label:"Non qualificato (bad data / no risposta)", desc:"Reperibilità e qualità contatto"}
  ];

  function coverage(obj){
    obj = obj || {};
    var total = REASONS.length;
    var ok = 0;
    REASONS.forEach(function(r){ if(!!obj[r.key]) ok++; });
    return { total: total, ok: ok, miss: Math.max(0,total-ok) };
  }

  // =========================
  // REPORT ENGINE — 3 aree + checklist super completa
  // =========================
  function mkItem(area, title, impactEur, why, implement, kpiMacro, kpiMicro, alerts){
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

  function generateDetailedReport(state, result){
    // result atteso: { wastePct, lossPct, wasteEur, lossEur }
    var waste = safeNum(result && result.wasteEur);
    var loss  = safeNum(result && result.lossEur);

    // ripartizioni (puoi affinarle dopo)
    var area1Pool = waste * 0.60; // setup/tracciamento impatta più spreco
    var area2Pool = loss  * 0.55; // vendite impatta più fatturato perso
    var area3Pool = (waste * 0.40) + (loss * 0.45); // sinergia tocca entrambi

    // base struttura
    var rep = {
      meta: { v:"MSR-2", created_at: new Date().toISOString() },
      summary: {
        wasteEur: waste, lossEur: loss,
        wastePct: safeNum(result && result.wastePct),
        lossPct:  safeNum(result && result.lossPct),
        totalEur: waste + loss
      },
      areas: {
        a1: { title:"Area 1 — Setup & Tracciamento", items: [] },
        a2: { title:"Area 2 — Controllo operativo vendite", items: [] },
        a3: { title:"Area 3 — Sinergia Marketing ↔ Vendite (feedback & attribuzione)", items: [] }
      }
    };

    // ---------- AREA 1 ----------
    // UTM & attribuzione: se manca CRM o se mancano attributi per camp/adset
    var hasCRM = (state && state.crmOk === true);
    var crmMissing = (state && state.crmOk === false);

    if(crmMissing){
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
    }else{
      // CRM presente: funzioni chiave
      var f = (state && state.crmFeat) || {};
      if(!f.score){
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
      if(!f.wf){
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
      if(!ch.wa){
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

    // Tag obbligatori (motivazioni)
    var fbCov = coverage((state && state.fb) || {});
    if(fbCov.ok < REASONS.length){
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

    // ---------- AREA 2 ----------
    // Controllo vendite (10min / 5 tentativi / script / quality)
    var seller = state && state.seller;
    var sc = (state && state.salesControls) || {};

    // Script
    if(!(sc && sc.script)){
      rep.areas.a2.items.push(mkItem(
        "a2",
        "Script di setting e closing + controllo qualità chiamate",
        area2Pool * 0.28,
        "Senza script standard, le performance oscillano e i feedback sono inutilizzabili dal marketing.",
        [
          "Script setting: prequalifica (budget/need/timing), promessa, prossimi step.",
          "Script closing: obiezioni principali (prezzo/valore, fiducia, competitor) + prova sociale.",
          "Quality check: checklist call (aderenza script, domande chiave, next step) + campionamento settimanale."
        ],
        ["% appuntamenti→show", "% show→chiusura", "conversione per venditore"],
        ["aderenza script (score qualità)", "obiezioni per venditore", "durata call per fase"],
        ["Alert se conversione venditore scende", "Alert se qualità call scende sotto soglia"]
      ));
    }
    // Contatto entro 10 minuti
    if(!(sc && sc.c10)){
      rep.areas.a2.items.push(mkItem(
        "a2",
        "SLA: contatto entro 10 minuti (misurato e obbligatorio)",
        area2Pool * 0.26,
        "Il tempo di risposta è determinante: oltre i primi minuti, la probabilità di conversione crolla.",
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
    // 5 tentativi
    if(!(sc && sc.c5)){
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

    // Profilazione su etichette (sempre consigliata)
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

    // ---------- AREA 3 ----------
    // Attribuzione per campagna e adset (stato: camp/adset)
    var campCov = coverage((state && state.camp) || {});
    var adsetCov = coverage((state && state.adset) || {});

    if(campCov.ok < REASONS.length){
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

    if(adsetCov.ok < REASONS.length){
      rep.areas.a3.items.push(mkItem(
        "a3",
        "Attribuzione per targeting (adset): qualità lead per PUBBLICO",
        area3Pool * 0.18,
        "Il vero spreco spesso è nel targeting: senza lettura per pubblico, bruci budget sui segmenti sbagliati.",
        [
          "UTM + parametro adset/pubblico nel CRM.",
          "Report: Pubblico → motivi perdita + conversioni.",
          "Spegni pubblici con motivi critici ricorrenti e scale i migliori."
        ],
        ["CPA per pubblico", "% chiusura per pubblico", "show rate per pubblico"],
        ["Motivo perdita per pubblico", "obiezioni per pubblico"],
        ["Alert se pubblico degrada su qualità", "Alert se competitor cresce su pubblico"]
      ));
    }

    // KPI macro/micro + alert sistemici (sempre)
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

  // =========================
  // RENDER REPORT (HTML)
  // =========================
  function renderReportHTML(payload){
    var rep = payload.report;
    var sum = rep.summary;

    function pill(text){
      return "<span style=\"display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(11,18,32,.12);background:#fff;font-size:12px;font-weight:900;color:rgba(11,18,32,.78);\">" + esc(text) + "</span>";
    }

    function blockTitle(t){
      return "<div style=\"font-size:14px;font-weight:900;color:#0b1220;margin:14px 0 10px;\">" + esc(t) + "</div>";
    }

    function listBlock(title, arr){
      if(!arr || !arr.length) return "";
      var li = arr.map(function(x){
        return "<li style=\"margin:0 0 6px 0;line-height:1.45;\">" + esc(x) + "</li>";
      }).join("");
      return "" +
        "<div style=\"margin-top:10px;\">" +
          "<div style=\"font-size:12px;font-weight:900;color:rgba(11,18,32,.82);margin-bottom:8px;\">" + esc(title) + "</div>" +
          "<ul style=\"margin:0;padding-left:18px;font-size:12px;color:rgba(11,18,32,.82);\">" + li + "</ul>" +
        "</div>";
    }

    function itemCard(it){
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

    function sumArea(items){
      var s = 0; (items||[]).forEach(function(it){ s += safeNum(it.impact); });
      return s;
    }

    function areaBox(areaKey){
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

    // SHARE BOX
    var shareBox = "" +
      "<div style=\"border:1px solid rgba(11,18,32,.12);background:#ffffff;border-radius:18px;padding:14px;margin-top:12px;\">" +
        "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">Condividi questa analisi con il tuo marketing</div>" +
        "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.5;\">" +
          "Copia il link univoco del report e inoltralo al team marketing/agenzia. È la base per un confronto oggettivo (niente scaricabarile)." +
        "</div>" +
        "<div style=\"display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;\">" +
          "<button type=\"button\" onclick=\"MS_TF.copyShare()\" style=\"cursor:pointer;border:1px solid rgba(11,18,32,.14);background:#ffffff;color:#0b1220;padding:13px 14px;border-radius:14px;font-weight:900;flex:1 1 220px;\">" +
            "Copia link report" +
          "</button>" +
          "<button type=\"button\" onclick=\"MS_TF.openShare()\" style=\"cursor:pointer;border:1px solid rgba(11,18,32,.14);background:#ffffff;color:#0b1220;padding:13px 14px;border-radius:14px;font-weight:900;flex:1 1 180px;\">" +
            "Apri link" +
          "</button>" +
        "</div>" +
        "<div id=\"ms_copy_ok\" style=\"display:none;margin-top:10px;font-size:12px;font-weight:900;color:#065f46;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.10);padding:10px 12px;border-radius:14px;\">✓ Link copiato. Incollalo su WhatsApp o email.</div>" +
      "</div>";

    // EXEC
    var exec = "" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" +
        pill("Spreco ADV: " + money(sum.wasteEur)) +
        pill("Fatturato perso: " + money(sum.lossEur)) +
        pill("Totale stimato: " + money(sum.totalEur)) +
      "</div>" +
      "<div style=\"margin-top:10px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">" +
        "Questa è una checklist operativa MarkSelling: indica cosa implementare nello specifico, quali KPI monitorare e quali alert attivare per correggere subito rotta." +
      "</div>";

    // FINAL
    var html = "";
    html += exec;
    html += areaBox("a1");
    html += areaBox("a2");
    html += areaBox("a3");
    html += shareBox;

    // CTA Audit (tienila pure uguale a quella attuale se vuoi)
    html += "" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;\">" +
        "<a href=\"https://www.markselling.it/booking-audit/\" style=\"flex:1 1 220px;text-decoration:none;text-align:center;background:#DC2626;color:#fff;padding:13px 14px;border-radius:14px;font-weight:900;border:1px solid rgba(0,0,0,.25);\">" +
          "Prenota Audit" +
        "</a>" +
        "<button type=\"button\" onclick=\"MS_TF.backToAnswers()\" style=\"flex:1 1 160px;cursor:pointer;border:1px solid rgba(11,18,32,.14);background:#ffffff;color:#0b1220;padding:13px 14px;border-radius:14px;font-weight:900;\">" +
          "Torna alle risposte" +
        "</button>" +
      "</div>";

    return html;
  }

  function makeSharePayload(state, result, report){
    return {
      meta: { v:"MSR-2", created_at: new Date().toISOString() },
      input: state,
      result: result,
      report: report
    };
  }

  // =========================
  // PUBLIC API HOOKS (agganci a MS_TF)
  // =========================
  // Qui non definiamo MS_TF (lo fai già nel tuo codice).
  // Aggiungiamo SOLO funzioni se esiste già MS_TF.
  function attachShareAPI(){
    if(!window.MS_TF) return;

    // expose utils
    window.MS_TF._report = {
      generateDetailedReport: generateDetailedReport,
      renderReportHTML: renderReportHTML,
      makeSharePayload: makeSharePayload,
      buildShareLink: buildShareLink,
      getSharedPayloadFromUrl: getSharedPayloadFromUrl
    };

    window.MS_TF.copyShare = async function(){
      try{
        var payload = window.MS_TF._lastSharePayload;
        if(!payload) return;
        var link = buildShareLink(payload);
        var ok = await copyToClipboard(link);
        var box = $("ms_copy_ok");
        if(ok && box){
          box.style.display = "block";
          setTimeout(function(){ box.style.display = "none"; }, 2200);
        }
      }catch(e){}
    };

    window.MS_TF.openShare = function(){
      try{
        var payload = window.MS_TF._lastSharePayload;
        if(!payload) return;
        var link = buildShareLink(payload);
        window.open(link, "_blank");
      }catch(e){}
    };

    // helper per tornare alle risposte (il tuo back esiste già: MS_TF.back())
    window.MS_TF.backToAnswers = function(){
      // In molti flussi basta un "back()" dall'ultimo step
      if(window.MS_TF && typeof window.MS_TF.back === "function"){
        window.MS_TF.back();
      }
    };
  }

  // =========================
  // VIEW MODE: se apri un link condiviso, mostra SOLO report
  // =========================
  function tryRenderSharedViewMode(){
    var shared = getSharedPayloadFromUrl();
    if(!shared || !shared.report) return false;

    // Nascondi progress/step UI e rendi pagina "report only"
    var stepQ = $("ms_step_question");
    var stepS = $("ms_step_sub");
    var body  = $("ms_step_body");
    var nav   = $("ms_nav"); // se il tuo HTML ha un wrapper nav con id, altrimenti ignora
    var backBtn = $("ms_back_btn");
    var nextBtn = $("ms_next_btn");
    var err = $("ms_err");

    if(stepQ) stepQ.textContent = "Report MarkSelling (condiviso)";
    if(stepS) stepS.textContent = "Questa vista mostra solo il report generato dall’analisi. Puoi inoltrarlo al marketing/agenzia.";
    if(body)  body.innerHTML = renderReportHTML(shared);

    if(backBtn) backBtn.style.display = "none";
    if(nextBtn) nextBtn.style.display = "none";
    if(err) err.style.display = "none";

    // Prova a nascondere la progress bar se vuoi
    // Se hai id ms_progress_wrap, lo nascondiamo
    var prog = $("ms_progress_wrap");
    if(prog) prog.style.display = "none";

    return true;
  }

  // =========================
  // INIT
  // =========================
  // 1) se link condiviso → view mode
  // 2) altrimenti → aggancia share api (quando MS_TF è pronto)
  function init(){
    // view-only
    if(tryRenderSharedViewMode()) return;

    // attacca api quando MS_TF esiste
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if(window.MS_TF){
        clearInterval(t);
        attachShareAPI();
      }
      if(tries > 120) clearInterval(t); // ~6s
    }, 50);
  }

  // Avvio quando DOM pronto
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }

  // Expose (debug)
  window.__MSR = {
    buildShareLink: buildShareLink,
    getSharedPayloadFromUrl: getSharedPayloadFromUrl
  };

})();
addStep("result",
  "Risposta",
  "Risultati mensili — ecco la stima prudenziale e la reportistica MarkSelling dettagliata.",
  function(){

    // 1) calcolo base (il tuo calc rimane invariato)
    var r = calc();

    // 2) genero report dettagliato (dal PEZZO 1/3)
    var report = (window.MS_TF && window.MS_TF._report && window.MS_TF._report.generateDetailedReport)
      ? window.MS_TF._report.generateDetailedReport(S, r)
      : null;

    // fallback sicurezza: se per qualche motivo non carica il motore report
    if(!report){
      var wastePctTxt = (r.wastePct*100).toFixed(0) + "% (cap 35%)";
      var lossPctTxt  = (r.lossPct*100).toFixed(0) + "% (cap 55%)";

      function lossBox(title, amount, pctText, desc){
        return "" +
          "<div style=\"border-radius:16px; padding:14px; border:1px solid rgba(239,68,68,.28); background:rgba(239,68,68,.08); margin-bottom:12px;\">" +
            "<div style=\"font-size:12px; font-weight:900; color:rgba(11,18,32,.92);\">" + title + "</div>" +
            "<div style=\"display:flex; justify-content:space-between; gap:12px; align-items:baseline; margin-top:8px;\">" +
              "<div style=\"font-size:28px; font-weight:900; color:#b91c1c;\">" + money(r.wasteEur) + "</div>" +
              "<div style=\"font-size:13px; font-weight:900; color:#b91c1c;\">" + pctText + "</div>" +
            "</div>" +
            "<div style=\"font-size:12px; color:rgba(11,18,32,.74); line-height:1.5; margin-top:8px;\">" + desc + "</div>" +
          "</div>";
      }

      var out = "";
      out += lossBox("Budget ADV sprecato (mensile)", money(r.wasteEur), wastePctTxt,
        "Stima prudenziale della quota di budget che, nel mese, non produce miglioramento misurabile (allocazione/targeting/messaggio)."
      );
      out += lossBox("Fatturato perso (mensile)", money(r.lossEur), lossPctTxt,
        "Stima prudenziale della quota di fatturato potenziale che, nel mese, non viene catturata per mancanza di processo e controllo operativo."
      );

      // CTA base
      out += "" +
        "<div style=\"display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;\">" +
          "<a href=\"https://www.markselling.it/booking-audit/\" style=\"flex:1 1 220px; text-decoration:none; text-align:center; " +
          "background:#DC2626; color:#fff; padding:13px 14px; border-radius:14px; font-weight:900; border:1px solid rgba(0,0,0,.25);\">" +
            "Prenota Audit" +
          "</a>" +
          "<button type=\"button\" onclick=\"MS_TF.back()\" style=\"flex:1 1 160px; cursor:pointer; " +
          "border:1px solid rgba(11,18,32,.14); background:#ffffff; color:#0b1220; " +
          "padding:13px 14px; border-radius:14px; font-weight:900;\">" +
            "Torna alle risposte" +
          "</button>" +
        "</div>";

      return out;
    }

    // 3) preparo payload condivisibile (include input + risultati + report)
    var payload = window.MS_TF._report.makeSharePayload(S, r, report);

    // 4) salvo il payload in memoria (così i bottoni Copia/Apri funzionano)
    window.MS_TF._lastSharePayload = payload;

    // 5) renderizzo HTML completo del report (con share box e checklist)
    return window.MS_TF._report.renderReportHTML(payload);
  },
  function(){ return true; }
);
/* =========================================================
   MARKSELLING — REPORT ENGINE + SHARE LINK + VIEW MODE
   - Checklist super completa
   - 3 aree: Setup/Tracciamento, Operativo Vendite, Vendite→Marketing
   - Share URL: ?msr=...
   - View mode: se msr presente -> mostra solo report
========================================================= */

(function(){
  // Assumo che nel tuo app.js esistano già:
  // - S (state)
  // - money()
  // - b64urlEncode / b64urlDecode
  // - buildShareLink(payload)
  // - copyToClipboard(text)
  // - getSharedPayloadFromUrl()
  // - $ (document.getElementById)
  // Se alcuni nomi differiscono, dimmelo e li riallineo.

  function esc(str){
    return String(str || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  function safeNum(n){ return (isFinite(n) ? n : 0); }

  function sumImpact(items){
    var t = 0;
    (items||[]).forEach(function(it){ t += safeNum(it.impact); });
    return t;
  }

  function mkItem(area, id, title, impact, why, checklist){
    return {
      area: area,
      id: id,
      title: title,
      impact: safeNum(impact),
      why: why || "",
      checklist: Array.isArray(checklist) ? checklist : []
    };
  }

  // ✅ Etichette / Tag ufficiali (da te richiesti)
  var TAGS = [
    {k:"fuori_target",   t:"Fuori target",                         d:"Mismatch con pubblico ideale"},
    {k:"fuori_budget",   t:"Fuori budget",                         d:"Capacità di spesa non compatibile"},
    {k:"non_idoneo",     t:"Non idoneo",                           d:"Non rientra nei requisiti"},
    {k:"non_pronto",     t:"Non pronto",                           d:"Timing e priorità"},
    {k:"fid_brand",      t:"Blocco fiducia brand",                 d:"Autorità percepita"},
    {k:"fid_prod",       t:"Blocco fiducia prodotto/servizio",     d:"Scetticismo / prova"},
    {k:"prezzo_valore",  t:"Blocco prezzo/valore",                 d:"Percezione valore"},
    {k:"competitor",     t:"Ha scelto competitor",                 d:"Alternativa preferita"},
    {k:"non_qual",       t:"Non qualificato (bad data / no risposta)", d:"Reperibilità e qualità contatto"}
  ];

  // KPI consigliati (Macro/Micro)
  var KPI = {
    macro: [
      "CPL reale per campagna/adset",
      "% Lead → Contatto (contact rate)",
      "Tempo medio primo contatto",
      "% Contatto → Appuntamento",
      "% Appuntamento → Show",
      "% Show → Vendita",
      "CPA reale (costo per acquisizione)",
      "Ricavo medio per vendita (ticket medio)",
      "ROAS / MER (se eCommerce o multi-canale)"
    ],
    micro: [
      "Motivo mancata vendita per annuncio (tag obbligatorio)",
      "Obiezioni ricorrenti per segmento",
      "Qualità lead per pubblico (score medio, show rate, close rate)",
      "No-show rate per fonte e per venditore",
      "Lead “persi” / non ricontattati (SLA violati)",
      "Tentativi medi per contatto",
      "Tempo tra tentativi (sequenza follow-up)",
      "Conversione per fascia di lead scoring",
      "Distribuzione pipeline: quanti lead per stato",
      "Tempo medio di permanenza in ogni stato pipeline"
    ]
  };

  function checklistBlock(list){
    return (list||[]).map(function(x){
      return "<li style=\"margin:0 0 6px 0; line-height:1.45;\">" + esc(x) + "</li>";
    }).join("");
  }

  function tagTable(){
    var rows = TAGS.map(function(t){
      return "" +
        "<tr>" +
          "<td style=\"padding:10px 10px; border-top:1px solid rgba(11,18,32,.10); font-weight:900;\">" + esc(t.t) + "</td>" +
          "<td style=\"padding:10px 10px; border-top:1px solid rgba(11,18,32,.10); color:rgba(11,18,32,.75); font-size:12px;\">" + esc(t.d) + "</td>" +
        "</tr>";
    }).join("");

    return "" +
      "<div style=\"margin-top:10px; border:1px solid rgba(11,18,32,.12); border-radius:14px; overflow:hidden;\">" +
        "<table style=\"width:100%; border-collapse:collapse; font-size:12px;\">" +
          "<thead>" +
            "<tr style=\"background:rgba(11,18,32,.04);\">" +
              "<th style=\"text-align:left; padding:10px 10px; font-size:12px; letter-spacing:.08em; text-transform:uppercase;\">Tag obbligatori</th>" +
              "<th style=\"text-align:left; padding:10px 10px; font-size:12px; letter-spacing:.08em; text-transform:uppercase;\">Significato</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" + rows + "</tbody>" +
        "</table>" +
      "</div>";
  }

  // ✅ Generatore report “super completo”
  function generateDetailedReport(S, r){
    var waste = safeNum(r.wasteEur);
    var loss  = safeNum(r.lossEur);

    var rep = {
      meta: { created_at: new Date().toISOString(), v:"MSR-2" },
      summary: {
        wasteEur: waste,
        lossEur: loss,
        wastePct: safeNum(r.wastePct),
        lossPct: safeNum(r.lossPct),
        totalEur: waste + loss
      },
      areas: {
        a1: { title:"Area 1 — Setup & Tracciamento", items: [] },
        a2: { title:"Area 2 — Controllo operativo vendite", items: [] },
        a3: { title:"Area 3 — Vendite → Marketing (feedback, KPI, alert)", items: [] }
      }
    };

    /* ---------------------------
       AREA 1 — SETUP/TRACCIAMENTO
    --------------------------- */
    // UTM + attribuzione (sempre fondamentale)
    rep.areas.a1.items.push(mkItem(
      "a1",
      "utm_crm",
      "UTM obbligatori e attribuzione annuncio → CRM",
      waste * 0.10,
      "Senza collegamento certo tra annuncio e CRM non puoi sapere cosa genera vendite e cosa genera solo lead. Qui nasce lo spreco.",
      [
        "Aggiungi UTM su ogni annuncio (campaign, adset, ad, creative).",
        "Salva UTM nel CRM su campi dedicati (non nelle note).",
        "Crea report: UTM → contatto → appuntamento → show → vendita.",
        "Blocca (o segnala) lead senza UTM: è un dato incompleto."
      ]
    ));

    // Tag obbligatori in CRM
    rep.areas.a1.items.push(mkItem(
      "a1",
      "tags_mandatory",
      "Tag di esito obbligatori (mancata vendita / opportunità)",
      waste * 0.08,
      "Se i motivi di perdita non sono misurati, il marketing ottimizza “a sensazione” e le agenzie restano protette da KPI parziali.",
      [
        "Rendi obbligatoria la selezione di 1 tag tra quelli standardizzati.",
        "Aggancia i tag a report per annuncio/UTM.",
        "Esegui revisione settimanale dei top-3 motivi + azioni correttive.",
        "Dividi tag per: contatto, appuntamento, show, chiusura."
      ]
    ));

    // Lead scoring + timing contatto
    rep.areas.a1.items.push(mkItem(
      "a1",
      "lead_scoring",
      "Sistema di Lead Scoring (contatto nel momento giusto)",
      loss * 0.12,
      "Senza scoring tratti tutti allo stesso modo: perdi i lead caldi e sprechi tempo sui freddi. È perdita diretta di fatturato.",
      [
        "Definisci segnali: reply, click, apertura, visita pagina prezzo, richiesta info, call.",
        "Assegna punteggi e soglie: Freddo / Tiepido / Caldo.",
        "Trigger automatico: lead caldo → alert immediato al setter + WA istantaneo.",
        "Score tiepido → nurturing; score freddo → recupero programmato."
      ]
    ));

    // Automazioni WhatsApp + workflow
    rep.areas.a1.items.push(mkItem(
      "a1",
      "wa_workflows",
      "Automazioni WhatsApp + Workflow follow-up basati su azioni",
      loss * 0.10,
      "Il lead va ‘tenuto caldo’ e guidato. Senza workflow perdi velocità, show rate e conversione.",
      [
        "Messaggio immediato post-lead (0–2 min) con promessa + next step.",
        "Workflow 24h/72h/7d: valore + prova sociale + CTA appuntamento.",
        "Diramazioni basate su azioni: click → follow-up; no click → reminder; reply → presa appuntamento.",
        "Logga ogni interazione nel CRM (timeline)."
      ]
    ));

    /* ---------------------------
       AREA 2 — CONTROLLO VENDITE
    --------------------------- */
    rep.areas.a2.items.push(mkItem(
      "a2",
      "sales_sla_10min",
      "SLA: contatto entro 10 minuti (standard non negoziabile)",
      loss * 0.18,
      "Il tempo di contatto è uno dei driver principali della conversione. Ogni ritardo abbassa la probabilità di chiusura.",
      [
        "Crea alert immediato al venditore/setter alla creazione del lead.",
        "Regola interna: se >10 min → segnalazione automatica al manager.",
        "Dashboard giornaliera: tempo medio primo contatto per venditore e per UTM.",
        "In caso di picchi lead: rotazione / assegnazione automatica."
      ]
    ));

    rep.areas.a2.items.push(mkItem(
      "a2",
      "sales_5_attempts",
      "Regola: 5 tentativi minimi se non risponde (no abbandono)",
      loss * 0.12,
      "La maggior parte delle vendite si perde perché il lead viene abbandonato al primo no o alla prima mancata risposta.",
      [
        "Sequenza consigliata: 0h call + WA, 2h WA, 24h call, 72h WA, 7d call/WA.",
        "Registra esito tentativi nel CRM (non in testa al venditore).",
        "Tagga: ‘No risposta’ solo dopo sequenza completa.",
        "Report: tasso contatto e tentativi medi per fonte/annuncio."
      ]
    ));

    rep.areas.a2.items.push(mkItem(
      "a2",
      "scripts_qc",
      "Script setting + closing + controllo qualità chiamate",
      loss * 0.14,
      "Senza script il processo è casuale: conversione instabile e feedback inutilizzabile. Il MarkSelling richiede standard e QA.",
      [
        "Scrivi script per: prequalifica, valore, obiezioni, chiusura.",
        "Allinea script al lead scoring (domande diverse per caldo/tiepido).",
        "Registra campioni call e fai QA settimanale (score qualità).",
        "Crea biblioteca obiezioni: 10 obiezioni top + risposte standard."
      ]
    ));

    rep.areas.a2.items.push(mkItem(
      "a2",
      "recovery",
      "Recupero lead: nurturing + riattivazione (pipeline dedicata)",
      loss * 0.10,
      "I lead non pronti sono fatturato in attesa. Senza recupero li stai regalando al competitor.",
      [
        "Crea pipeline dedicata: Non pronto → Nurture → Riattiva → Appuntamento.",
        "Workflow contenuti: case study, prove sociali, garanzie, FAQ.",
        "Riattivazione programmata su segnali: click, reply, visita pagina.",
        "Report: conversione dei recuperati (extra revenue)."
      ]
    ));

    /* ---------------------------
       AREA 3 — VENDITE → MARKETING
    --------------------------- */
    rep.areas.a3.items.push(mkItem(
      "a3",
      "daily_reports",
      "Reportistica quotidiana per annuncio (vendite → marketing)",
      waste * 0.10,
      "Qui avviene il cambio di paradigma: i MarkSeller guidano il marketing con micro-dati reali, non con impression e CTR.",
      [
        "Report giornaliero: per UTM/campagna/adset -> contatti, app, show, vendite.",
        "Tag motivi perdita obbligatori su ogni opportunità chiusa/persa.",
        "Top-3 motivi per annuncio: creare task di modifica messaggio/target/offerta.",
        "Decisioni entro 24 ore: spegni, rialloca, riscrivi."
      ]
    ));

    rep.areas.a3.items.push(mkItem(
      "a3",
      "kpi_framework",
      "Monitoraggio KPI: macro + micro (dashboard unica)",
      waste * 0.06,
      "Le agenzie si misurano su KPI facili. Tu devi misurare ciò che conta: il ponte tra marketing e vendite.",
      [
        "Dashboard MACRO KPI (marketing→vendite): " + KPI.macro.slice(0,4).join(" | "),
        "Dashboard MICRO KPI (vendite→marketing): " + KPI.micro.slice(0,4).join(" | "),
        "Obiettivo: avere una lettura ‘da processo’ (non solo ‘da ads’).",
        "Ogni KPI deve avere soglia + alert."
      ]
    ));

    rep.areas.a3.items.push(mkItem(
      "a3",
      "alerts",
      "Alert automatici quando le metriche peggiorano",
      loss * 0.08,
      "Se scopri il problema a fine mese, hai già bruciato budget e vendite. Gli alert trasformano il controllo in azione immediata.",
      [
        "Alert se tempo primo contatto > 10 min (per venditore).",
        "Alert se contact rate scende sotto soglia (per campagna/adset).",
        "Alert se no-show sale (per fonte/annuncio).",
        "Alert se close rate cala (per segmento/score)."
      ]
    ));

    return rep;
  }

  function makeSharePayload(S, r, report){
    return {
      meta: { v:"MSR-2", created_at: new Date().toISOString() },
      input: S,
      result: r,
      report: report
    };
  }

  function renderReportHTML(payload){
    var rep = payload.report;
    var sum = rep.summary;

    function pill(text){
      return "<span style=\"display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid rgba(11,18,32,.12); background:#fff; font-size:12px; font-weight:900; color:rgba(11,18,32,.78);\">" + esc(text) + "</span>";
    }

    function itemCard(it){
      var checklist = it.checklist && it.checklist.length
        ? "<ul style=\"margin:10px 0 0 0; padding-left:18px; font-size:12px; color:rgba(11,18,32,.82);\">" + checklistBlock(it.checklist) + "</ul>"
        : "";

      return "" +
        "<div style=\"border:1px solid rgba(11,18,32,.12); background:#fff; border-radius:16px; padding:14px; margin-bottom:12px;\">" +
          "<div style=\"display:flex; gap:10px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap;\">" +
            "<div style=\"min-width:240px; flex:1 1 auto;\">" +
              "<div style=\"font-size:13px; font-weight:900; color:#0b1220;\">" + esc(it.title) + "</div>" +
              (it.why ? "<div style=\"margin-top:6px; font-size:12px; color:rgba(11,18,32,.72); line-height:1.5;\">" + esc(it.why) + "</div>" : "") +
            "</div>" +
            "<div style=\"flex:0 0 auto; text-align:right;\">" +
              "<div style=\"font-size:11px; font-weight:900; color:rgba(11,18,32,.62);\">Impatto stimato</div>" +
              "<div style=\"font-size:18px; font-weight:900; color:#b91c1c; margin-top:2px;\">" + money(it.impact) + "</div>" +
            "</div>" +
          "</div>" +
          checklist +
        "</div>";
    }

    function areaBox(areaKey){
      var area = rep.areas[areaKey];
      var items = area.items || [];
      var tot = sumImpact(items);

      var body = items.length
        ? items.map(itemCard).join("")
        : "<div style=\"margin-top:10px; font-size:12px; font-weight:900; color:#065f46; border:1px solid rgba(34,197,94,.30); background:rgba(34,197,94,.10); padding:10px 12px; border-radius:14px;\">✓ Nessuna criticità evidente in questa area (ottimo).</div>";

      return "" +
        "<div style=\"border:1px solid rgba(11,18,32,.12); background:#fff; border-radius:18px; padding:14px; margin-top:12px;\">" +
          "<div style=\"display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap;\">" +
            "<div>" +
              "<div style=\"font-size:14px; font-weight:900; color:#0b1220;\">" + esc(area.title) + "</div>" +
              "<div style=\"margin-top:6px; font-size:12px; color:rgba(11,18,32,.72); line-height:1.5;\">" +
                "Checklist operativa per implementare il Protocollo MarkSelling in modo misurabile e senza scaricabarile." +
              "</div>" +
            "</div>" +
            "<div style=\"text-align:right;\">" +
              "<div style=\"font-size:11px; font-weight:900; color:rgba(11,18,32,.62);\">Perdita stimata area</div>" +
              "<div style=\"font-size:18px; font-weight:900; color:#b91c1c; margin-top:2px;\">" + money(tot) + "</div>" +
            "</div>" +
          "</div>" +
          "<div style=\"margin-top:12px;\">" + body + "</div>" +
        "</div>";
    }

    // Share Box (usa MS_TF.copyShare / openShare)
    var shareBox = "" +
      "<div style=\"border:1px solid rgba(11,18,32,.12); background:#ffffff; border-radius:18px; padding:14px; margin-top:12px;\">" +
        "<div style=\"font-size:14px; font-weight:900; color:#0b1220;\">Condividi questa analisi con il tuo marketing</div>" +
        "<div style=\"margin-top:6px; font-size:12px; color:rgba(11,18,32,.72); line-height:1.5;\">" +
          "Copia il link univoco del report e inoltralo al team marketing/agenzia. " +
          "Chiedi una risposta tecnica: cosa implementano, in quanto tempo, e con quali KPI." +
        "</div>" +
        "<div style=\"display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;\">" +
          "<button type=\"button\" onclick=\"MS_TF.copyShare()\" style=\"cursor:pointer; border:1px solid rgba(11,18,32,.14); background:#ffffff; color:#0b1220; padding:13px 14px; border-radius:14px; font-weight:900; flex:1 1 220px;\">" +
            "Copia link report" +
          "</button>" +
          "<button type=\"button\" onclick=\"MS_TF.openShare()\" style=\"cursor:pointer; border:1px solid rgba(11,18,32,.14); background:#ffffff; color:#0b1220; padding:13px 14px; border-radius:14px; font-weight:900; flex:1 1 180px;\">" +
            "Apri link" +
          "</button>" +
        "</div>" +
        "<div id=\"ms_copy_ok\" style=\"display:none; margin-top:10px; font-size:12px; font-weight:900; color:#065f46; border:1px solid rgba(34,197,94,.30); background:rgba(34,197,94,.10); padding:10px 12px; border-radius:14px;\">✓ Link copiato. Incollalo su WhatsApp o email.</div>" +
      "</div>";

    // Executive summary + tag table + KPI list
    var exec = "" +
      "<div style=\"display:flex; gap:10px; flex-wrap:wrap;\">" +
        pill("Spreco ADV: " + money(sum.wasteEur)) +
        pill("Fatturato perso: " + money(sum.lossEur)) +
        pill("Totale stimato: " + money(sum.totalEur)) +
      "</div>" +
      "<div style=\"margin-top:10px; font-size:12px; color:rgba(11,18,32,.72); line-height:1.55;\">" +
        "Questa è una stima prudenziale basata sulle risposte inserite. L’obiettivo è rendere misurabile il punto esatto in cui perdi soldi " +
        "e cosa implementare, step-by-step, per applicare il Protocollo MarkSelling." +
      "</div>" +
      "<div style=\"margin-top:12px;\">" +
        "<div style=\"font-size:13px; font-weight:900; color:#0b1220;\">Tag / Etichette che devi avere nel CRM (obbligatorie)</div>" +
        "<div style=\"margin-top:6px; font-size:12px; color:rgba(11,18,32,.72); line-height:1.5;\">" +
          "Questi tag sono la base del feedback vendite → marketing. Senza, l’ottimizzazione è cieca." +
        "</div>" +
        tagTable() +
      "</div>" +
      "<div style=\"margin-top:12px; border:1px solid rgba(11,18,32,.12); border-radius:16px; padding:12px;\">" +
        "<div style=\"font-size:13px; font-weight:900; color:#0b1220;\">KPI da monitorare (macro + micro)</div>" +
        "<div style=\"margin-top:8px; font-size:12px; font-weight:900; color:rgba(11,18,32,.75);\">Macro KPI</div>" +
        "<ul style=\"margin:6px 0 0 0; padding-left:18px; font-size:12px; color:rgba(11,18,32,.82);\">" + checklistBlock(KPI.macro) + "</ul>" +
        "<div style=\"margin-top:10px; font-size:12px; font-weight:900; color:rgba(11,18,32,.75);\">Micro KPI</div>" +
        "<ul style=\"margin:6px 0 0 0; padding-left:18px; font-size:12px; color:rgba(11,18,32,.82);\">" + checklistBlock(KPI.micro) + "</ul>" +
      "</div>";

    var html = "";
    html += exec;
    html += areaBox("a1");
    html += areaBox("a2");
    html += areaBox("a3");
    html += shareBox;

    // CTA finale
    html += "" +
      "<div style=\"display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;\">" +
        "<a href=\"https://www.markselling.it/booking-audit/\" style=\"flex:1 1 220px; text-decoration:none; text-align:center; " +
        "background:#DC2626; color:#fff; padding:13px 14px; border-radius:14px; font-weight:900; border:1px solid rgba(0,0,0,.18);\">" +
          "Prenota Audit" +
        "</a>" +
        "<button type=\"button\" onclick=\"MS_TF.back()\" style=\"flex:1 1 160px; cursor:pointer; " +
        "border:1px solid rgba(11,18,32,.14); background:#ffffff; color:#0b1220; " +
        "padding:13px 14px; border-radius:14px; font-weight:900;\">" +
          "Torna alle risposte" +
        "</button>" +
      "</div>";

    return html;
  }

  // 🔌 Espongo come modulo su MS_TF
  window.MS_TF = window.MS_TF || {};
  window.MS_TF._report = {
    generateDetailedReport: generateDetailedReport,
    makeSharePayload: makeSharePayload,
    renderReportHTML: renderReportHTML
  };

  /* =========================
     SHARE HANDLERS (Copia/Apri)
  ========================= */
  // Se già esistono, non sovrascrivo.
  if(!window.MS_TF.copyShare){
    window.MS_TF.copyShare = async function(){
      try{
        if(!window.MS_TF._lastSharePayload){
          alert("Nessun report da condividere. Completa il simulatore e torna al risultato.");
          return;
        }
        var link = buildShareLink(window.MS_TF._lastSharePayload);
        var ok = await copyToClipboard(link);
        var box = document.getElementById("ms_copy_ok");
        if(box){
          box.style.display = "block";
          setTimeout(function(){ box.style.display = "none"; }, 2200);
        }
        if(!ok) alert("Non riesco a copiare automaticamente. Copia manualmente questo link:\n\n" + link);
      }catch(e){
        alert("Errore copia link: " + (e && e.message ? e.message : e));
      }
    };
  }

  if(!window.MS_TF.openShare){
    window.MS_TF.openShare = function(){
      if(!window.MS_TF._lastSharePayload){
        alert("Nessun report da aprire. Completa il simulatore e torna al risultato.");
        return;
      }
      var link = buildShareLink(window.MS_TF._lastSharePayload);
      window.open(link, "_blank");
    };
  }

  /* =========================
     VIEW MODE da URL (msr=...)
     - Se apro link condiviso, mostro SOLO report
  ========================= */
  function renderViewOnlyFromUrl(){
    var payload = getSharedPayloadFromUrl && getSharedPayloadFromUrl();
    if(!payload || !payload.report) return false;

    // Nascondo parti “simulatore” se esistono
    var prog = document.getElementById("ms_progress_wrap");
    if(prog) prog.style.display = "none";
    var nav = document.getElementById("ms_nav");
    if(nav) nav.style.display = "none";
    var backBtn = document.getElementById("ms_back_btn");
    if(backBtn) backBtn.style.display = "none";
    var nextBtn = document.getElementById("ms_next_btn");
    if(nextBtn) nextBtn.style.display = "none";
    var err = document.getElementById("ms_err");
    if(err) err.style.display = "none";

    // Titoli
    var q = document.getElementById("ms_step_question");
    var sub = document.getElementById("ms_step_sub");
    if(q) q.textContent = "Report MarkSelling condiviso";
    if(sub) sub.textContent = "Versione sola lettura — analisi operativa + checklist implementazione.";

    // Corpo = report HTML
    var body = document.getElementById("ms_step_body");
    if(body){
      // salvo payload per ripristinare copia/apri anche in view
      window.MS_TF._lastSharePayload = payload;
      body.innerHTML = renderReportHTML(payload);
    }

    // Scroll top
    try{
      var top = document.getElementById("ms_top");
      if(top && top.scrollIntoView) top.scrollIntoView({behavior:"smooth", block:"start"});
    }catch(e){}

    return true;
  }

  // Eseguo in sicurezza dopo il paint
  setTimeout(function(){
    try{ renderViewOnlyFromUrl(); }catch(e){}
  }, 0);

})();
