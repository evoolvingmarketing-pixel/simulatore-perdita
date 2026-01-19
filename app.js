/* =========================
  MARKSELLING — SIMULATORE (app.js) — FULL
  - Questionario completo (non superficiale)
  - Stato S unico
  - Rendering campi (input / radio / multi)
  - Calcolo spreco/perdita (prudenziale) + caps
  - Result step: REPORT COMPLETO (3 aree) INLINE (nessun codice fuori scope)
  - NO share link: rimossi bottoni copia/apri

  Requisiti HTML (già nel tuo index):
  - ms_step_question, ms_step_sub, ms_step_body
  - ms_prog_label, ms_prog_pct, ms_prog_bar
  - ms_err, ms_saved
  - ms_back_btn, ms_next_btn
========================= */

(function(){
  // ============ DOM helpers ============
  function $(id){ return document.getElementById(id); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
  function safeNum(n){ n = +n; return isFinite(n) ? n : 0; }
  function money(x){
    x = safeNum(x);
    return x.toLocaleString("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
  }
  function scrollToTopForm(){
    try{
      var top = $("ms_top");
      if(top && top.scrollIntoView){
        top.scrollIntoView({behavior:"smooth", block:"start"});
      }
    }catch(e){}
  }
  function showErr(show){
    var el = $("ms_err");
    if(!el) return;
    el.style.display = show ? "block" : "none";
  }
  function pulseSaved(){
    var el = $("ms_saved");
    if(!el) return;
    el.style.display = "block";
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    setTimeout(function(){
      el.style.transition = "all .22s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 10);
    setTimeout(function(){
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
    }, 900);
    setTimeout(function(){
      el.style.display = "none";
      el.style.transition = "none";
    }, 1150);
  }
  function esc(s){
    return String(s||"")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ============ STATE ============
  var S = {
    budget: null,
    rev: null,

    crmOk: null,
    crmFeat: {
      tags: null,
      score: null,
      wf: null,
      alerts: null
    },
    crmChan: {
      wa: null,
      email: null
    },

    utm: {
      used: null,
      savedInCrm: null,
      reportByAd: null
    },

    kpi: {
      macro: null,
      micro: null,
      daily: null,
      alerting: null
    },

    align: null,

    salesControls: {
      c10: null,
      c5: null,
      script: null,
      rec: null
    },

    fb: {
      fuori_target:false,
      fuori_budget:false,
      non_idoneo:false,
      non_pronto:false,
      fid_brand:false,
      fid_prod:false,
      prezzo_valore:false,
      competitor:false,
      non_qual:false
    },

    _result: null
  };

  // ============ CAPS / LOGIC ============
  var CAPS = {
    waste: 0.35,
    loss:  0.55
  };

  var WEIGHTS = {
    crmMissing:        { waste: 0.08, loss: 0.10 },
    tagsMissing:       { waste: 0.05, loss: 0.06 },
    scoringMissing:    { waste: 0.03, loss: 0.07 },
    wfMissing:         { waste: 0.04, loss: 0.06 },
    waMissing:         { waste: 0.03, loss: 0.05 },

    utmNotUsed:        { waste: 0.08, loss: 0.05 },
    utmNotSaved:       { waste: 0.06, loss: 0.04 },
    noReportByAd:      { waste: 0.07, loss: 0.05 },
    noMacroKpi:        { waste: 0.05, loss: 0.04 },
    noMicroKpi:        { waste: 0.05, loss: 0.06 },
    noDailyReport:     { waste: 0.05, loss: 0.05 },
    noAlerting:        { waste: 0.04, loss: 0.05 },

    no10min:           { waste: 0.02, loss: 0.08 },
    no5attempts:       { waste: 0.02, loss: 0.06 },
    noScripts:         { waste: 0.02, loss: 0.07 },
    noQA:              { waste: 0.02, loss: 0.05 },

    alignNever:        { waste: 0.06, loss: 0.08 },
    alignMonthly:      { waste: 0.04, loss: 0.06 },
    alignWeekly:       { waste: 0.02, loss: 0.03 },
    alignDaily:        { waste: 0.00, loss: 0.00 }
  };

  function calc(){
    var budget = safeNum(S.budget);
    var rev    = safeNum(S.rev);

    var wastePct = 0.10;
    var lossPct  = 0.12;

    if(S.crmOk === false){ wastePct += WEIGHTS.crmMissing.waste; lossPct += WEIGHTS.crmMissing.loss; }
    if(S.crmFeat.tags === false){ wastePct += WEIGHTS.tagsMissing.waste; lossPct += WEIGHTS.tagsMissing.loss; }
    if(S.crmFeat.score === false){ wastePct += WEIGHTS.scoringMissing.waste; lossPct += WEIGHTS.scoringMissing.loss; }
    if(S.crmFeat.wf === false){ wastePct += WEIGHTS.wfMissing.waste; lossPct += WEIGHTS.wfMissing.loss; }
    if(S.crmChan.wa === false){ wastePct += WEIGHTS.waMissing.waste; lossPct += WEIGHTS.waMissing.loss; }

    if(S.utm.used === false){ wastePct += WEIGHTS.utmNotUsed.waste; lossPct += WEIGHTS.utmNotUsed.loss; }
    if(S.utm.savedInCrm === false){ wastePct += WEIGHTS.utmNotSaved.waste; lossPct += WEIGHTS.utmNotSaved.loss; }
    if(S.utm.reportByAd === false){ wastePct += WEIGHTS.noReportByAd.waste; lossPct += WEIGHTS.noReportByAd.loss; }

    if(S.kpi.macro === false){ wastePct += WEIGHTS.noMacroKpi.waste; lossPct += WEIGHTS.noMacroKpi.loss; }
    if(S.kpi.micro === false){ wastePct += WEIGHTS.noMicroKpi.waste; lossPct += WEIGHTS.noMicroKpi.loss; }
    if(S.kpi.daily === false){ wastePct += WEIGHTS.noDailyReport.waste; lossPct += WEIGHTS.noDailyReport.loss; }
    if(S.kpi.alerting === false){ wastePct += WEIGHTS.noAlerting.waste; lossPct += WEIGHTS.noAlerting.loss; }

    if(S.salesControls.c10 === false){ wastePct += WEIGHTS.no10min.waste; lossPct += WEIGHTS.no10min.loss; }
    if(S.salesControls.c5 === false){ wastePct += WEIGHTS.no5attempts.waste; lossPct += WEIGHTS.no5attempts.loss; }
    if(S.salesControls.script === false){ wastePct += WEIGHTS.noScripts.waste; lossPct += WEIGHTS.noScripts.loss; }
    if(S.salesControls.rec === false){ wastePct += WEIGHTS.noQA.waste; lossPct += WEIGHTS.noQA.loss; }

    if(S.align === "mai"){ wastePct += WEIGHTS.alignNever.waste; lossPct += WEIGHTS.alignNever.loss; }
    else if(S.align === "mensile"){ wastePct += WEIGHTS.alignMonthly.waste; lossPct += WEIGHTS.alignMonthly.loss; }
    else if(S.align === "settimanale"){ wastePct += WEIGHTS.alignWeekly.waste; lossPct += WEIGHTS.alignWeekly.loss; }
    else if(S.align === "giornaliero"){ wastePct += WEIGHTS.alignDaily.waste; lossPct += WEIGHTS.alignDaily.loss; }

    wastePct = clamp(wastePct, 0.05, CAPS.waste);
    lossPct  = clamp(lossPct,  0.06, CAPS.loss);

    var wasteEur = budget * wastePct;
    var lossEur  = rev * lossPct;

    return { budget:budget, rev:rev, wastePct:wastePct, lossPct:lossPct, wasteEur:wasteEur, lossEur:lossEur };
  }

  // ============ PATH GET/SET ============
  function getPath(obj, path){
    var parts = String(path||"").split(".");
    var cur = obj;
    for(var j=0;j<parts.length;j++){
      if(!cur) return undefined;
      cur = cur[parts[j]];
    }
    return cur;
  }
  function setPath(obj, path, value){
    var parts = String(path||"").split(".");
    var cur = obj;
    for(var j=0;j<parts.length-1;j++){
      var p = parts[j];
      if(cur[p] === undefined) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length-1]] = value;
  }

  // ============ INPUT RENDERERS ============
  function inputNumber(key, placeholder, hint, min){
    var val = S[key];
    var v = (val === null || val === undefined) ? "" : String(val);
    var minAttr = (typeof min === "number") ? (" min=\"" + min + "\"") : "";
    return "" +
      "<div>" +
        "<input class=\"ms-field\" type=\"number\" inputmode=\"numeric\" " + minAttr + " " +
          "placeholder=\"" + esc(placeholder) + "\" value=\"" + esc(v) + "\" " +
          "oninput=\"MS_TF.setNumber('" + key + "', this.value)\" />" +
        (hint ? "<div class=\"ms-hint\">" + esc(hint) + "</div>" : "") +
      "</div>";
  }

  function radioBtn(path, val, label, checkedStr){
    return "" +
      "<label style=\"flex:1 1 220px; display:flex; align-items:center; gap:10px; border:1px solid rgba(11,18,32,.14); border-radius:14px; padding:12px 12px; cursor:pointer; font-weight:900;\">" +
        "<input type=\"radio\" name=\"" + esc(path) + "\" " + checkedStr + " " +
          "onchange=\"MS_TF.setBool('" + path + "', " + (val ? "true" : "false") + ")\" />" +
        "<span>" + esc(label) + "</span>" +
      "</label>";
  }

  function radioYesNo(path, yesLabel, noLabel){
    yesLabel = yesLabel || "Sì";
    noLabel  = noLabel  || "No";
    var curr = getPath(S, path);
    var y = (curr === true) ? " checked" : "";
    var n = (curr === false) ? " checked" : "";
    return "" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" +
        radioBtn(path, true,  yesLabel, y) +
        radioBtn(path, false, noLabel,  n) +
      "</div>";
  }

  function radioEnum(path, options){
    var curr = getPath(S, path);
    var html = "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">";
    options.forEach(function(o){
      var ck = (curr === o.v) ? " checked" : "";
      html += "" +
        "<label style=\"flex:1 1 220px; display:flex; align-items:center; gap:10px; border:1px solid rgba(11,18,32,.14); border-radius:14px; padding:12px 12px; cursor:pointer; font-weight:900;\">" +
          "<input type=\"radio\" name=\"" + esc(path) + "\" " + ck + " " +
            "onchange=\"MS_TF.setEnum('" + path + "', '" + esc(o.v) + "')\" />" +
          "<span>" + esc(o.t) + "</span>" +
        "</label>";
    });
    html += "</div>";
    return html;
  }

  function multiTags(path){
    var base = getPath(S, path) || {};
    var rows = [
      {k:"fuori_target",  t:"Fuori target", d:"Mismatch con pubblico ideale"},
      {k:"fuori_budget",  t:"Fuori budget", d:"Capacità di spesa non compatibile"},
      {k:"non_idoneo",    t:"Non idoneo", d:"Non rientra nei requisiti"},
      {k:"non_pronto",    t:"Non pronto", d:"Timing e priorità"},
      {k:"fid_brand",     t:"Blocco fiducia brand", d:"Autorità percepita"},
      {k:"fid_prod",      t:"Blocco fiducia prodotto/servizio", d:"Scetticismo / prova"},
      {k:"prezzo_valore", t:"Blocco prezzo/valore", d:"Percezione valore"},
      {k:"competitor",    t:"Ha scelto competitor", d:"Alternativa preferita"},
      {k:"non_qual",      t:"Non qualificato (bad data / no risposta)", d:"Reperibilità e qualità contatto"}
    ];

    var out = "" +
      "<div style=\"border:1px solid rgba(11,18,32,.12); border-radius:16px; overflow:hidden;\">" +
        "<div style=\"background:rgba(11,18,32,.04); padding:10px 12px; font-weight:900; font-size:12px; letter-spacing:.08em; text-transform:uppercase;\">Motivi perdita tracciati oggi</div>" +
        "<div style=\"padding:12px; display:grid; grid-template-columns:1fr; gap:10px;\">";

    rows.forEach(function(r){
      var checked = base[r.k] ? " checked" : "";
      out += "" +
        "<label style=\"display:flex; gap:10px; align-items:flex-start; border:1px solid rgba(11,18,32,.12); border-radius:14px; padding:10px 12px; cursor:pointer;\">" +
          "<input type=\"checkbox\" " + checked + " onchange=\"MS_TF.toggleTag('" + path + "." + r.k + "', this.checked)\" style=\"margin-top:2px;\" />" +
          "<div style=\"display:flex; flex-direction:column; gap:3px;\">" +
            "<div style=\"font-weight:900;\">" + esc(r.t) + "</div>" +
            "<div style=\"font-size:12px; color:rgba(11,18,32,.72);\">" + esc(r.d) + "</div>" +
          "</div>" +
        "</label>";
    });

    out += "</div></div>";
    out += "<div class=\"ms-hint\" style=\"margin-top:10px;\">Nel MarkSelling questi tag devono essere <b>obbligatori</b> (uno per ogni opportunità chiusa/persa) per guidare il marketing con micro-dati reali.</div>";
    return out;
  }

  // ============ STEPS ============
  var steps = [];
  function addStep(key, q, sub, render, validate){
    steps.push({ key:key, q:q, sub:sub, render:render, validate:validate || function(){return true;} });
  }

  addStep(
    "budget",
    "Quanto investi ogni mese in ADV?",
    "Risultati mensili — inserisci il budget pubblicitario che investi in un mese.",
    function(){
      return inputNumber(
        "budget",
        "Es. 1500",
        "Inserisci solo numeri. Useremo questo dato per stimare la quota di budget che oggi non produce miglioramento misurabile.",
        0
      );
    },
    function(){ return safeNum(S.budget) > 0; }
  );

  addStep(
    "rev",
    "Qual è il tuo fatturato medio mensile?",
    "Risultati mensili — ci serve per stimare la quota di fatturato che non viene catturata a causa di processo e controllo incompleti.",
    function(){
      return inputNumber(
        "rev",
        "Es. 50000",
        "Inserisci solo numeri. È una stima: il report ti dirà cosa implementare per recuperare la perdita.",
        0
      );
    },
    function(){ return safeNum(S.rev) > 0; }
  );

  addStep(
    "crmOk",
    "Hai un CRM usato davvero come centro del processo?",
    "Non “abbiamo un CRM”: intendo che ogni lead entra in pipeline, viene lavorato e tracciato (contatto, tentativi, esiti, motivi).",
    function(){
      return radioYesNo("crmOk", "Sì, è il centro operativo", "No, è marginale / non lo usiamo davvero");
    },
    function(){ return (S.crmOk === true || S.crmOk === false); }
  );

  addStep(
    "utm.used",
    "Tracci UTM su OGNI annuncio (campagna, adset, creatività)?",
    "Se non sai esattamente da quale annuncio arriva ogni opportunità, stai ottimizzando al buio.",
    function(){
      return radioYesNo("utm.used", "Sì, sempre", "No / non sempre / non so");
    },
    function(){ return (S.utm.used === true || S.utm.used === false); }
  );

  addStep(
    "utm.savedInCrm",
    "Le UTM vengono salvate nel CRM come CAMPI (non nelle note)?",
    "Servono per report automatici: CPL/CPA e motivi perdita per singolo annuncio e pubblico.",
    function(){
      return radioYesNo("utm.savedInCrm", "Sì, campi dedicati", "No / finiscono in note / non vengono salvate");
    },
    function(){ return (S.utm.savedInCrm === true || S.utm.savedInCrm === false); }
  );

  addStep(
    "utm.reportByAd",
    "Riesci a vedere KPI e motivi di perdita per SINGOLO annuncio?",
    "Nel MarkSelling non basta il costo lead: devi vedere contatto, appuntamenti, show, chiusure e tag per annuncio.",
    function(){
      return radioYesNo("utm.reportByAd", "Sì, per annuncio e pubblico", "No, vedo solo KPI generici");
    },
    function(){ return (S.utm.reportByAd === true || S.utm.reportByAd === false); }
  );

  addStep(
    "crmFeat.tags",
    "Hai tag obbligatori di esito (motivi mancata vendita) su ogni opportunità?",
    "Questa è la verità che nessuna agenzia ti dirà: senza questi tag non esiste responsabilità oggettiva.",
    function(){
      return radioYesNo("crmFeat.tags", "Sì, obbligatori", "No / non sono standard / non obbligatori");
    },
    function(){ return (S.crmFeat.tags === true || S.crmFeat.tags === false); }
  );

  addStep(
    "fb",
    "Quali motivi di perdita tracci oggi in modo consistente?",
    "Spunta quelli che hai già in CRM. Nel report ti dico cosa manca e come implementarlo (obbligatorio).",
    function(){ return multiTags("fb"); },
    function(){ return true; }
  );

  addStep(
    "crmFeat.score",
    "Hai un sistema di Lead Scoring per contattare nel momento giusto?",
    "Il punto non è “chiamare tutti”: è dare priorità ai caldi e nutrire i tiepidi. Senza scoring perdi i migliori.",
    function(){
      return radioYesNo("crmFeat.score", "Sì, con soglie e trigger", "No");
    },
    function(){ return (S.crmFeat.score === true || S.crmFeat.score === false); }
  );

  addStep(
    "crmFeat.wf",
    "Hai workflow di follow-up basati su azioni tracciate (click, reply, no-show)?",
    "Se non hai workflow, i lead vengono dimenticati e il costo opportunità esplode.",
    function(){
      return radioYesNo("crmFeat.wf", "Sì, con diramazioni", "No / follow-up manuale");
    },
    function(){ return (S.crmFeat.wf === true || S.crmFeat.wf === false); }
  );

  addStep(
    "crmChan.wa",
    "Hai automazioni WhatsApp per contatto immediato + recupero?",
    "Contatto istantaneo, reminder, recupero mancata risposta/no-show: è una leva enorme sul fatturato recuperato.",
    function(){
      return radioYesNo("crmChan.wa", "Sì", "No");
    },
    function(){ return (S.crmChan.wa === true || S.crmChan.wa === false); }
  );

  addStep(
    "salesControls.c10",
    "Il team vendite contatta ogni lead entro 10 minuti (SLA misurabile)?",
    "Se non misuri il tempo di primo contatto, stai pagando per lead che si raffreddano.",
    function(){
      return radioYesNo("salesControls.c10", "Sì, sempre (misurato)", "No / non è misurato");
    },
    function(){ return (S.salesControls.c10 === true || S.salesControls.c10 === false); }
  );

  addStep(
    "salesControls.c5",
    "In caso di mancata risposta, fate almeno 5 tentativi (regola standard)?",
    "La maggior parte delle vendite perse è “silenziosa”: abbandonati troppo presto.",
    function(){
      return radioYesNo("salesControls.c5", "Sì", "No");
    },
    function(){ return (S.salesControls.c5 === true || S.salesControls.c5 === false); }
  );

  addStep(
    "salesControls.script",
    "Avete script di setting/closing + controllo qualità delle chiamate?",
    "Senza script e QA, i feedback al marketing sono rumore. Con MarkSelling diventano dati utilizzabili.",
    function(){
      return radioYesNo("salesControls.script", "Sì, script + QA", "No");
    },
    function(){ return (S.salesControls.script === true || S.salesControls.script === false); }
  );

  addStep(
    "align",
    "Quanto spesso marketing e vendite si allineano sui DATI (non sulle opinioni)?",
    "Nel MarkSelling le vendite guidano il marketing: l’allineamento è una routine operativa, non una riunione casuale.",
    function(){
      return radioEnum("align", [
        {v:"mai", t:"Mai / quando va male"},
        {v:"mensile", t:"Mensile"},
        {v:"settimanale", t:"Settimanale"},
        {v:"giornaliero", t:"Giornaliero (o quasi)"}
      ]);
    },
    function(){ return !!S.align; }
  );

  addStep(
    "kpi.macro",
    "Monitorate i KPI macro end-to-end (lead→contatto→app→show→vendite)?",
    "Se misuri solo CPL, stai scegliendo “lead economici”, non vendite.",
    function(){
      return radioYesNo("kpi.macro", "Sì", "No / parzialmente");
    },
    function(){ return (S.kpi.macro === true || S.kpi.macro === false); }
  );

  addStep(
    "kpi.micro",
    "Monitorate KPI micro (motivo perdita per annuncio, tempo contatto, tentativi, obiezioni)?",
    "Sono i micro-dati delle vendite che rendono scalabile l’ADV: qui nasce l’ottimizzazione vera.",
    function(){
      return radioYesNo("kpi.micro", "Sì", "No");
    },
    function(){ return (S.kpi.micro === true || S.kpi.micro === false); }
  );

  addStep(
    "kpi.daily",
    "Avete report giornaliero diviso per annuncio/campagna/pubblico?",
    "Il MarkSelling vive su interventi rapidi: se scopri i problemi a fine mese, è tardi.",
    function(){
      return radioYesNo("kpi.daily", "Sì", "No");
    },
    function(){ return (S.kpi.daily === true || S.kpi.daily === false); }
  );

  addStep(
    "kpi.alerting",
    "Avete alert automatici quando le metriche peggiorano?",
    "Alert = intervento immediato. Senza alert, bruci settimane prima di accorgertene.",
    function(){
      return radioYesNo("kpi.alerting", "Sì", "No");
    },
    function(){ return (S.kpi.alerting === true || S.kpi.alerting === false); }
  );

  // --- RESULT ---
  addStep(
    "result",
    "Risposta",
    "Risultati mensili — ecco la stima prudenziale e la checklist MarkSelling (report dettagliato).",
    function(){
      var r = calc();
      S._result = r;

      var wastePctTxt = Math.round(r.wastePct * 100) + "% (cap 35%)";
      var lossPctTxt  = Math.round(r.lossPct  * 100) + "% (cap 55%)";

      function box(title, amount, pctText, desc){
        return "" +
          "<div style=\"border-radius:16px; padding:14px; border:1px solid rgba(239,68,68,.28); background:rgba(239,68,68,.08); margin-bottom:12px;\">" +
            "<div style=\"font-size:12px; font-weight:900; color:rgba(11,18,32,.92);\">" + esc(title) + "</div>" +
            "<div style=\"display:flex; justify-content:space-between; gap:12px; align-items:baseline; margin-top:8px; flex-wrap:wrap;\">" +
              "<div style=\"font-size:30px; font-weight:900; color:#b91c1c;\">" + money(amount) + "</div>" +
              "<div style=\"font-size:13px; font-weight:900; color:#b91c1c;\">" + esc(pctText) + "</div>" +
            "</div>" +
            "<div style=\"font-size:12px; color:rgba(11,18,32,.74); line-height:1.5; margin-top:8px;\">" + esc(desc) + "</div>" +
          "</div>";
      }

      var out = "";
      out += box(
        "Budget ADV sprecato (mensile)",
        r.wasteEur,
        wastePctTxt,
        "Quota prudenziale di budget che oggi non produce miglioramento misurabile (allocazione/targeting/messaggio/attribuzione)."
      );
      out += box(
        "Fatturato perso (mensile)",
        r.lossEur,
        lossPctTxt,
        "Quota prudenziale di fatturato potenziale non catturata per mancanza di processo, controllo operativo e sinergia vendite→marketing."
      );

      (function(){
        function covFB(){
          var keys = Object.keys(S.fb || {});
          var ok = 0;
          keys.forEach(function(k){ if(S.fb[k]) ok++; });
          return { ok: ok, total: keys.length };
        }

        function badge(text){
          return "<span style=\"display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(11,18,32,.12);background:#fff;font-size:12px;font-weight:900;color:rgba(11,18,32,.78);\">" + esc(text) + "</span>";
        }

        function list(title, arr){
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

        function card(title, why, impact, bullets){
          return "" +
            "<div style=\"border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
              "<div style=\"display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;\">" +
                "<div style=\"min-width:240px;flex:1 1 auto;\">" +
                  "<div style=\"font-size:13px;font-weight:900;color:#0b1220;\">" + esc(title) + "</div>" +
                  (why ? "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.5;\">" + esc(why) + "</div>" : "") +
                "</div>" +
                "<div style=\"flex:0 0 auto;text-align:right;\">" +
                  "<div style=\"font-size:11px;font-weight:900;color:rgba(11,18,32,.62);\">Impatto stimato</div>" +
                  "<div style=\"font-size:18px;font-weight:900;color:#b91c1c;margin-top:2px;\">" + money(impact) + "</div>" +
                "</div>" +
              "</div>" +
              list("Cosa implementare (checklist operativa)", bullets) +
            "</div>";
        }

        function tableTags(){
          var TAGS = [
            ["Fuori target","Mismatch con pubblico ideale"],
            ["Fuori budget","Capacità di spesa non compatibile"],
            ["Non idoneo","Non rientra nei requisiti"],
            ["Non pronto","Timing e priorità"],
            ["Blocco fiducia brand","Autorità percepita"],
            ["Blocco fiducia prodotto/servizio","Scetticismo / prova"],
            ["Blocco prezzo/valore","Percezione valore"],
            ["Ha scelto competitor","Alternativa preferita"],
            ["Non qualificato (bad data / no risposta)","Reperibilità e qualità contatto"]
          ];
          var rows = TAGS.map(function(rr){
            return "<tr>" +
              "<td style=\"padding:10px 10px;border-top:1px solid rgba(11,18,32,.10);font-weight:900;\">" + esc(rr[0]) + "</td>" +
              "<td style=\"padding:10px 10px;border-top:1px solid rgba(11,18,32,.10);color:rgba(11,18,32,.75);font-size:12px;\">" + esc(rr[1]) + "</td>" +
            "</tr>";
          }).join("");

          return "" +
            "<div style=\"margin-top:10px;border:1px solid rgba(11,18,32,.12);border-radius:14px;overflow:hidden;\">" +
              "<table style=\"width:100%;border-collapse:collapse;font-size:12px;\">" +
                "<thead>" +
                  "<tr style=\"background:rgba(11,18,32,.04);\">" +
                    "<th style=\"text-align:left;padding:10px 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;\">Tag obbligatori</th>" +
                    "<th style=\"text-align:left;padding:10px 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;\">Significato</th>" +
                  "</tr>" +
                "</thead>" +
                "<tbody>" + rows + "</tbody>" +
              "</table>" +
            "</div>";
        }

        var KPI_MACRO = [
          "CPL reale (per campagna/adset/annuncio)",
          "% Lead → Contatto (contact rate)",
          "% Contatto → Appuntamento",
          "% Appuntamento → Show (show rate)",
          "% Show → Vendita (close rate)",
          "CPA reale (costo per vendita)",
          "Ticket medio / Ricavo medio",
          "ROAS / MER (se applicabile)"
        ];

        var KPI_MICRO = [
          "Tempo medio primo contatto (SLA 10 min)",
          "Tentativi medi per lead (regola 5 tentativi)",
          "Recovery rate (lead non risponde / no-show recuperati)",
          "Motivo perdita (tag) per annuncio e pubblico",
          "Obiezioni top per segmento (prezzo/valore, fiducia, competitor)",
          "Distribuzione pipeline + tempo per stato",
          "Qualità chiamate (aderenza script / QA score)"
        ];

        var ALERTS = [
          "Alert se tempo primo contatto > 10 min",
          "Alert se contact rate scende sotto soglia",
          "Alert se no-show sale oltre soglia",
          "Alert se close rate cala (per segmento/score)",
          "Alert se cresce 'Fuori target' su una campagna",
          "Alert se aumenta 'Prezzo/valore' (messaggio/offerta da rivedere)"
        ];

        var waste = safeNum(r.wasteEur);
        var loss  = safeNum(r.lossEur);

        var poolA1 = waste * 0.60;
        var poolA2 = loss  * 0.55;
        var poolA3 = (waste * 0.40) + (loss * 0.45);

        var fb = covFB();

        var missing = {
          crm: (S.crmOk === false),
          utm: (S.utm.used === false),
          utmSave: (S.utm.savedInCrm === false),
          byAd: (S.utm.reportByAd === false),
          tags: (S.crmFeat.tags === false),
          score: (S.crmFeat.score === false),
          wf: (S.crmFeat.wf === false),
          wa: (S.crmChan.wa === false),
          c10: (S.salesControls.c10 === false),
          c5: (S.salesControls.c5 === false),
          script: (S.salesControls.script === false),
          align: (S.align === "mai" || S.align === "mensile"),
          macro: (S.kpi.macro === false),
          micro: (S.kpi.micro === false),
          daily: (S.kpi.daily === false),
          alerting: (S.kpi.alerting === false)
        };

        out += "" +
          "<div style=\"margin-top:12px;border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:18px;padding:14px;\">" +
            "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" +
              badge("Tracciamento UTM: " + (missing.utm ? "NO" : "SÌ")) +
              badge("Report per annuncio: " + (missing.byAd ? "NO" : "SÌ")) +
              badge("SLA 10 min: " + (missing.c10 ? "NO" : "SÌ")) +
              badge("Allineamento: " + (S.align ? S.align.toUpperCase() : "—")) +
            "</div>" +
            "<div style=\"margin-top:10px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">" +
              "Questa è una <b>checklist operativa MarkSelling</b>: non ti dice “cosa sarebbe bello avere”, ma cosa devi implementare " +
              "per togliere lo scaricabarile e far guidare il marketing dai micro-dati delle vendite." +
            "</div>" +
          "</div>";

        out += "" +
          "<div style=\"margin-top:12px;border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:18px;padding:14px;\">" +
            "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">Base obbligatoria (senza questa, l’ADV è cieca)</div>" +
            "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">" +
              "Motivi perdita tracciati oggi: <b>" + fb.ok + "</b> su <b>" + fb.total + "</b>. Nel MarkSelling devono essere <b>obbligatori</b> su ogni opportunità persa/chiusa." +
            "</div>" +
            tableTags() +
            "<div style=\"margin-top:12px;border:1px solid rgba(11,18,32,.10);border-radius:16px;padding:12px;\">" +
              "<div style=\"font-size:13px;font-weight:900;color:#0b1220;\">KPI da monitorare (macro + micro)</div>" +
              "<div style=\"margin-top:8px;font-size:12px;font-weight:900;color:rgba(11,18,32,.75);\">Macro KPI</div>" +
              "<ul style=\"margin:6px 0 0 0;padding-left:18px;font-size:12px;color:rgba(11,18,32,.82);\">" +
                KPI_MACRO.map(function(x){ return "<li style='margin:0 0 6px 0;line-height:1.45;'>"+esc(x)+"</li>"; }).join("") +
              "</ul>" +
              "<div style=\"margin-top:10px;font-size:12px;font-weight:900;color:rgba(11,18,32,.75);\">Micro KPI</div>" +
              "<ul style=\"margin:6px 0 0 0;padding-left:18px;font-size:12px;color:rgba(11,18,32,.82);\">" +
                KPI_MICRO.map(function(x){ return "<li style='margin:0 0 6px 0;line-height:1.45;'>"+esc(x)+"</li>"; }).join("") +
              "</ul>" +
            "</div>" +
          "</div>";

        // ==============================
        // AREA 1 — SETUP & TRACCIAMENTO
        // ==============================
        out += "" +
          "<div style=\"margin-top:12px;border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:18px;padding:14px;\">" +
            "<div style=\"display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;\">" +
              "<div>" +
                "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">Area 1 — Setup & Tracciamento</div>" +
                "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">Obiettivo: attribuzione certa e controllo del flusso lead→pipeline→vendita.</div>" +
              "</div>" +
              "<div style=\"text-align:right;\">" +
                "<div style=\"font-size:11px;font-weight:900;color:rgba(11,18,32,.62);\">Impatto stimato area</div>" +
                "<div style=\"font-size:18px;font-weight:900;color:#b91c1c;margin-top:2px;\">" + money(poolA1) + "</div>" +
              "</div>" +
            "</div>" +
            "<div style=\"margin-top:12px;\">" +

              (missing.crm ? card(
                "CRM non usato come centro operativo",
                "Senza CRM operativo non esiste controllo: il marketing ottimizza su KPI parziali e le vendite restano improvvisazione.",
                poolA1 * 0.30,
                [
                  "Centralizza tutti i lead nel CRM (form, WhatsApp, email, chiamate).",
                  "Pipeline con stati chiari + responsabilità (chi fa cosa e quando).",
                  "Ogni lead deve avere: fonte/UTM, stato pipeline, owner, next action."
                ]
              ) : "") +

              (missing.utm ? card(
                "UTM obbligatori su ogni annuncio",
                "Se non sai da quale annuncio nasce ogni opportunità, stai finanziando creatività/pubblici sbagliati senza saperlo.",
                poolA1 * 0.22,
                [
                  "UTM su campagna/adset/annuncio/creativa.",
                  "Parametri salvati in campi dedicati nel CRM.",
                  "Lead senza UTM: segnalazione/flag (dato incompleto)."
                ]
              ) : "") +

              (missing.utmSave ? card(
                "UTM salvate nel CRM come campi (non nelle note)",
                "Senza campi strutturati non puoi fare report automatici e perdi settimane in analisi manuali.",
                poolA1 * 0.16,
                [
                  "Campi CRM: utm_campaign, utm_adset, utm_ad, utm_content/creative.",
                  "Pipeline e report filtrabili per UTM.",
                  "Regola: non si lavora opportunità senza fonte."
                ]
              ) : "") +

              (missing.byAd ? card(
                "KPI + motivi perdita per singolo annuncio",
                "Se vedi solo CPL, stai scegliendo “lead economici” e non vendite. Serve visibilità per annuncio/pubblico.",
                poolA1 * 0.18,
                [
                  "Report: annuncio → contact rate, show rate, close rate, CPA reale.",
                  "Motivi perdita (tag) per annuncio e pubblico.",
                  "Riallocazione budget settimanale sui pubblici migliori."
                ]
              ) : "") +

              (missing.tags ? card(
                "Tag obbligatori su ogni opportunità persa/chiusa",
                "Senza tag obbligatori nasce lo scaricabarile: marketing e vendite non hanno una verità comune.",
                poolA1 * 0.14,
                [
                  "Campo obbligatorio “Motivo esito” con lista standardizzata.",
                  "Report: motivi per campagna/adset/annuncio.",
                  "Revisione settimanale top-3 motivi + azioni correttive."
                ]
              ) : "") +

              (missing.score ? card(
                "Lead Scoring (caldo/tiepido/freddo) + routing",
                "Se tratti tutti i lead uguali perdi i migliori e sprechi tempo sui freddi.",
                poolA1 * 0.12,
                [
                  "Punteggi su: reply, click, visite, richieste info, interazioni WA.",
                  "Trigger: caldo → contatto immediato; tiepido → nurturing; freddo → recupero programmato.",
                  "Report conversione per fascia score."
                ]
              ) : "") +

              (missing.wf ? card(
                "Workflow basati su azioni tracciate",
                "Senza workflow i lead vengono dimenticati e i tempi si allungano: perdi show e chiusure.",
                poolA1 * 0.10,
                [
                  "Post-lead (0–2 min): conferma + micro-domanda + next step.",
                  "Non risponde: sequenza 5 tentativi multicanale.",
                  "No-show: recovery + riprenotazione + reminder."
                ]
              ) : "") +

              (missing.wa ? card(
                "Automazioni WhatsApp per contatto immediato + recupero",
                "WhatsApp aumenta velocità e contact rate: senza, perdi i primi minuti e il lead si raffredda.",
                poolA1 * 0.08,
                [
                  "Messaggio immediato + CTA micro (1 click).",
                  "Reminder appuntamento (24h/2h) + no-show recovery.",
                  "Messaggi dinamici per score/tag."
                ]
              ) : "") +

              ((!missing.crm && !missing.utm && !missing.utmSave && !missing.byAd && !missing.tags && !missing.score && !missing.wf && !missing.wa)
                ? "<div style=\"margin-top:10px;font-size:12px;font-weight:900;color:#065f46;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.10);padding:10px 12px;border-radius:14px;\">✓ Setup & Tracciamento: già molto solido (ottimo).</div>"
                : ""
              ) +

            "</div>" +
          "</div>";

        // ==============================
        // AREA 2 — CONTROLLO TEAM VENDITA
        // ==============================
        out += "" +
          "<div style=\"margin-top:12px;border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:18px;padding:14px;\">" +
            "<div style=\"display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;\">" +
              "<div>" +
                "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">Area 2 — Controllo operativo vendite</div>" +
                "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">Obiettivo: SLA, regole misurabili, qualità chiamate, recupero lead.</div>" +
              "</div>" +
              "<div style=\"text-align:right;\">" +
                "<div style=\"font-size:11px;font-weight:900;color:rgba(11,18,32,.62);\">Impatto stimato area</div>" +
                "<div style=\"font-size:18px;font-weight:900;color:#b91c1c;margin-top:2px;\">" + money(poolA2) + "</div>" +
              "</div>" +
            "</div>" +
            "<div style=\"margin-top:12px;\">" +

              (missing.c10 ? card(
                "SLA: contatto entro 10 minuti (misurato e obbligatorio)",
                "Il tempo di risposta è determinante: superati i primi minuti la probabilità di conversione crolla.",
                poolA2 * 0.30,
                [
                  "Alert immediato al setter/venditore alla creazione del lead.",
                  "Escalation automatica se >10 minuti.",
                  "Dashboard giornaliera: tempo medio primo contatto per venditore e per annuncio."
                ]
              ) : "") +

              (missing.c5 ? card(
                "Regola: 5 tentativi minimi in caso di mancata risposta",
                "La maggior parte delle vendite perse è “silenziosa”: lead abbandonati troppo presto.",
                poolA2 * 0.22,
                [
                  "Sequenza consigliata: 0h (WA), 2h (call), 24h (WA), 72h (call), 7d (email/WA).",
                  "Log nel CRM di ogni tentativo (non in testa al venditore).",
                  "Report: tentativi medi e recovery rate per annuncio."
                ]
              ) : "") +

              (missing.script ? card(
                "Script setting + closing + controllo qualità",
                "Senza script le performance oscillano e i feedback al marketing sono rumore.",
                poolA2 * 0.24,
                [
                  "Script setting: prequalifica (budget/need/timing), promessa, next step.",
                  "Script closing: obiezioni (prezzo/valore, fiducia, competitor) + prova sociale.",
                  "QA settimanale: score qualità chiamate + coaching correttivo."
                ]
              ) : "") +

              "<div style=\"border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:16px;padding:12px;margin-top:10px;\">" +
                "<div style=\"font-size:13px;font-weight:900;color:#0b1220;\">Standard operativo consigliato (MarkSelling)</div>" +
                "<ul style=\"margin:10px 0 0 0;padding-left:18px;font-size:12px;color:rgba(11,18,32,.82);\">" +
                  "<li style=\"margin:0 0 6px 0;line-height:1.45;\">Contatto entro 10 minuti (SLA) + escalation</li>" +
                  "<li style=\"margin:0 0 6px 0;line-height:1.45;\">5 tentativi minimi + recovery (non abbandono)</li>" +
                  "<li style=\"margin:0 0 6px 0;line-height:1.45;\">Profilazione lead (etichette) + routing per priorità</li>" +
                  "<li style=\"margin:0 0 6px 0;line-height:1.45;\">Note post-call standard (obiezione + next step)</li>" +
                  "<li style=\"margin:0 0 6px 0;line-height:1.45;\">Controllo qualità chiamate (campionamento settimanale)</li>" +
                "</ul>" +
              "</div>" +

              ((!missing.c10 && !missing.c5 && !missing.script)
                ? "<div style=\"margin-top:10px;font-size:12px;font-weight:900;color:#065f46;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.10);padding:10px 12px;border-radius:14px;\">✓ Operativo vendite: regole chiave già presenti (ottimo).</div>"
                : ""
              ) +

            "</div>" +
          "</div>";

        // ==============================
        // AREA 3 — SINERGIA MKT ↔ SALES
        // ==============================
        out += "" +
          "<div style=\"margin-top:12px;border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:18px;padding:14px;\">" +
            "<div style=\"display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;\">" +
              "<div>" +
                "<div style=\"font-size:14px;font-weight:900;color:#0b1220;\">Area 3 — Sinergia Marketing ↔ Vendite</div>" +
                "<div style=\"margin-top:6px;font-size:12px;color:rgba(11,18,32,.72);line-height:1.55;\">Obiettivo: le vendite guidano il marketing con micro-dati, report e alert.</div>" +
              "</div>" +
              "<div style=\"text-align:right;\">" +
                "<div style=\"font-size:11px;font-weight:900;color:rgba(11,18,32,.62);\">Impatto stimato area</div>" +
                "<div style=\"font-size:18px;font-weight:900;color:#b91c1c;margin-top:2px;\">" + money(poolA3) + "</div>" +
              "</div>" +
            "</div>" +

            "<div style=\"margin-top:12px;\">" +

              (missing.align ? card(
                "Allineamento dati mkt↔sales troppo raro",
                "Se vi allineate solo “quando va male”, il budget viene bruciato prima che qualcuno intervenga.",
                poolA3 * 0.22,
                [
                  "Rituale settimanale: 30 minuti su dati (non opinioni).",
                  "Agenda fissa: annunci migliori/peggiori + motivi perdita + obiezioni top.",
                  "Decisioni: spegni/scala/riscrivi entro 24–72h."
                ]
              ) : "") +

              (missing.macro ? card(
                "Macro KPI end-to-end non monitorati",
                "Se misuri solo CPL, stai ottimizzando ‘lead’, non vendite.",
                poolA3 * 0.18,
                [
                  "Dashboard unica: lead→contatto→app→show→vendite.",
                  "CPA reale come KPI guida.",
                  "Segmentazione per UTM/campagna/adset/annuncio."
                ]
              ) : "") +

              (missing.micro ? card(
                "Micro KPI non monitorati (motivi perdita per annuncio, tempi, tentativi)",
                "I micro-dati vendite sono il motore della scalabilità ADV. Senza, l’ottimizzazione è cieca.",
                poolA3 * 0.18,
                [
                  "Motivo perdita (tag) per annuncio/pubblico.",
                  "Tempo primo contatto e tentativi medi per annuncio.",
                  "Obiezioni top per segmento e fascia score."
                ]
              ) : "") +

              (missing.daily ? card(
                "Reportistica giornaliera per annuncio/pubblico assente",
                "Se scopri un problema a fine mese, hai già bruciato settimane di budget e vendite.",
                poolA3 * 0.16,
                [
                  "Report giornaliero: annuncio → qualità (contact/show/close).",
                  "Top-3 motivi perdita del giorno + task correttivi.",
                  "Controllo budget: riallocazioni rapide."
                ]
              ) : "") +

              (missing.alerting ? card(
                "Alert automatici quando le metriche peggiorano",
                "Alert = intervento immediato. Senza alert, il degrado passa inosservato.",
                poolA3 * 0.16,
                [
                  "Alert su SLA, contact rate, no-show, close rate.",
                  "Alert su crescita di ‘Fuori target’ o ‘Prezzo/valore’ per campagna.",
                  "Notifica su WhatsApp/email a manager e strategist."
                ]
              ) : "") +

              "<div style=\"border:1px solid rgba(11,18,32,.12);background:#fff;border-radius:16px;padding:12px;margin-top:10px;\">" +
                "<div style=\"font-size:13px;font-weight:900;color:#0b1220;\">Alert consigliati (operativi)</div>" +
                "<ul style=\"margin:10px 0 0 0;padding-left:18px;font-size:12px;color:rgba(11,18,32,.82);\">" +
                  ALERTS.map(function(x){ return "<li style='margin:0 0 6px 0;line-height:1.45;'>"+esc(x)+"</li>"; }).join("") +
                "</ul>" +
              "</div>" +

              ((!missing.align && !missing.macro && !missing.micro && !missing.daily && !missing.alerting)
                ? "<div style=\"margin-top:10px;font-size:12px;font-weight:900;color:#065f46;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.10);padding:10px 12px;border-radius:14px;\">✓ Sinergia marketing↔vendite: struttura già avanzata (ottimo).</div>"
                : ""
              ) +

            "</div>" +
          "</div>";
      })();

      // CTA finale
      out += "" +
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

      return out;
    },
    function(){ return true; }
  );

  // ============ ENGINE ============
  var i = 0;

  function render(){
    var step = steps[i];

    // progress
    var pct = Math.round(((i+1) / steps.length) * 100);
    if($("ms_prog_label")) $("ms_prog_label").textContent = "Domanda " + (i+1) + " di " + steps.length;
    if($("ms_prog_pct")) $("ms_prog_pct").textContent = pct + "%";
    if($("ms_prog_bar")) $("ms_prog_bar").style.width = pct + "%";

    // titles
    if($("ms_step_question")) $("ms_step_question").textContent = step.q;
    if($("ms_step_sub")) $("ms_step_sub").textContent = step.sub;

    // body
    if($("ms_step_body")){
      $("ms_step_body").innerHTML = step.render();
    }

    // buttons
    if($("ms_back_btn")) $("ms_back_btn").style.display = (i === 0) ? "none" : "inline-flex";
    if($("ms_next_btn")) $("ms_next_btn").textContent = (i === steps.length - 1) ? "Fine" : "Avanti →";

    showErr(false);
  }

  function next(){
    var step = steps[i];
    if(step.validate && !step.validate()){
      showErr(true);
      return;
    }
    showErr(false);
    pulseSaved();

    if(i < steps.length - 1){
      i++;
      render();
      scrollToTopForm();
    }
  }

  function back(){
    if(i > 0){
      i--;
      render();
      scrollToTopForm();
    }
  }

  function reset(){
    S.budget = null;
    S.rev = null;

    S.crmOk = null;
    S.crmFeat.tags = null;
    S.crmFeat.score = null;
    S.crmFeat.wf = null;
    S.crmFeat.alerts = null;

    S.crmChan.wa = null;
    S.crmChan.email = null;

    S.utm.used = null;
    S.utm.savedInCrm = null;
    S.utm.reportByAd = null;

    S.kpi.macro = null;
    S.kpi.micro = null;
    S.kpi.daily = null;
    S.kpi.alerting = null;

    S.align = null;

    S.salesControls.c10 = null;
    S.salesControls.c5 = null;
    S.salesControls.script = null;
    S.salesControls.rec = null;

    Object.keys(S.fb).forEach(function(k){ S.fb[k] = false; });

    S._result = null;

    i = 0;
    render();
    scrollToTopForm();
  }

  // ============ PUBLIC API ============
  window.MS_TF = {
    next: next,
    back: back,
    reset: reset,

    setNumber: function(key, value){
      S[key] = safeNum(value);
    },

    setBool: function(path, val){
      setPath(S, path, !!val);
      showErr(false);
    },

    setEnum: function(path, val){
      setPath(S, path, val);
      showErr(false);
    },

    toggleTag: function(path, checked){
      setPath(S, path, !!checked);
      showErr(false);
    },

    _getState: function(){ return JSON.parse(JSON.stringify(S)); },
    _calc: calc
  };

  // ============ INIT ============
  function init(){ render(); }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }

})();
