(function(){
  function $(id){ return document.getElementById(id); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function money(x){
    if(!isFinite(x)) return "—";
    return x.toLocaleString("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
  }
  function scrollTopForm(){
    var top = $("ms_top");
    if(top && top.scrollIntoView) top.scrollIntoView({behavior:"smooth", block:"start"});
  }
  function showErr(show){
    var el = $("ms_err");
    if(el) el.style.display = show ? "block" : "none";
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
      el.style.opacity = "1";
      el.style.transform = "none";
    }, 1150);
  }

  // ===== SHARE =====
  var SHARE_PARAM = "msr";
  function b64urlEncode(str){
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlDecode(b64url){
    var b64 = b64url.replace(/-/g,'+').replace(/_/g,'/');
    while(b64.length % 4) b64 += "=";
    try{ return decodeURIComponent(escape(atob(b64))); }catch(e){ return null; }
  }
  function getSharedPayloadFromUrl(){
    var sp = new URLSearchParams(window.location.search);
    var v = sp.get(SHARE_PARAM);
    if(!v) return null;
    var json = b64urlDecode(v);
    if(!json) return null;
    try{ return JSON.parse(json); }catch(e){ return null; }
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
      ta.focus(); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    }catch(e2){ return false; }
  }

  // ===== STATE =====
  var S = {
    budget:null, lead:null, sales:null, rev:null,
    seller:null,
    salesControls:{ c10:false, c5:false, script:false },
    crmOk:null,
    crmFeat:{ cal:false, rem:false, wf:false, score:false, pipe:false, flow:false },
    crmChan:{ email:false, wa:false },
    align:null,
    fb:{ fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false, fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false },
    camp:{ fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false, fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false },
    adset:{ fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false, fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false }
  };

  var CAPS = { waste:0.35, loss:0.55 };

  function calc(){
    var budget = +S.budget || 0;
    var rev    = +S.rev    || 0;

    var lossPct = 0;
    if(S.seller === "io") lossPct += 5;
    if(S.seller === "interno") lossPct += 0;
    if(S.seller === "esterni") lossPct += 8;

    if(S.seller === "interno" || S.seller === "esterni"){
      if(!S.salesControls.c10) lossPct += 5;
      if(!S.salesControls.c5)  lossPct += 2;
      if(!S.salesControls.script) lossPct += 2;
    }

    if(S.crmOk === false){
      lossPct += 30;
    }else if(S.crmOk === true){
      if(!S.crmFeat.cal)   lossPct += 2;
      if(!S.crmFeat.rem)   lossPct += 2;
      if(!S.crmFeat.wf)    lossPct += 5;
      if(!S.crmFeat.score) lossPct += 5;
      if(!S.crmFeat.pipe)  lossPct += 5;
      if(!S.crmFeat.flow)  lossPct += 5;
      if(!S.crmChan.email) lossPct += 2;
      if(!S.crmChan.wa)    lossPct += 4;
    }
    lossPct = Math.min(lossPct/100, CAPS.loss);

    var wastePct = 0;
    if(S.align === "mai") wastePct += 15;
    if(S.align === "30")  wastePct += 8;
    if(S.align === "7")   wastePct += 3;

    var fbWeights = { fuori_target:5, fuori_budget:5, non_idoneo:5, non_pronto:2, fid_brand:2, fid_prod:2, prezzo_valore:2, competitor:2, non_qual:2 };
    Object.keys(fbWeights).forEach(function(k){ if(!S.fb[k]) wastePct += fbWeights[k]; });

    var campWeights = { fuori_target:10, fuori_budget:10, non_idoneo:10, non_pronto:8, fid_brand:8, fid_prod:8, prezzo_valore:8, competitor:8, non_qual:8 };
    Object.keys(campWeights).forEach(function(k){ if(!S.camp[k]) wastePct += campWeights[k]; });

    var adsetWeights = { fuori_target:5, fuori_budget:5, non_idoneo:4, non_pronto:4, fid_brand:4, fid_prod:4, prezzo_valore:4, competitor:4, non_qual:4 };
    Object.keys(adsetWeights).forEach(function(k){ if(!S.adset[k]) wastePct += adsetWeights[k]; });

    wastePct = Math.min((wastePct/100), CAPS.waste);

    return { wastePct:wastePct, lossPct:lossPct, wasteEur:budget*wastePct, lossEur:rev*lossPct };
  }

  // ===== INPUT RENDERERS =====
  function inputNumber(key, placeholder){
    var v = (S[key]===null || S[key]===undefined) ? "" : S[key];
    return "<input type=\"number\" inputmode=\"decimal\" min=\"0\" step=\"1\" value=\"" + String(v).replace(/\"/g,'&quot;') + "\" " +
      "oninput=\"MS_TF.setNum('" + key + "', this.value)\" " +
      "placeholder=\"" + placeholder + "\" " +
      "style=\"width:100%; padding:14px 14px; border-radius:14px; border:1px solid rgba(11,18,32,.14); background:#fff; color:#0b1220; outline:none; font-weight:900; font-size:16px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">";
  }
  function choiceRadio(stateKey, options, current){
    var html = "<div style=\"display:flex; flex-direction:column; gap:10px;\">";
    options.forEach(function(o){
      var checked = (current===o.value) ? "checked" : "";
      html += "<label style=\"display:flex; gap:12px; align-items:flex-start; cursor:pointer; border:1px solid rgba(11,18,32,.12); background:#fff; padding:12px; border-radius:14px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
        "<input type=\"radio\" name=\"ms_" + stateKey + "\" value=\"" + o.value + "\" " + checked +
        " onchange=\"MS_TF.setRadio('" + stateKey + "', '" + o.value + "')\" style=\"margin-top:3px;\">" +
        "<div style=\"display:flex; flex-direction:column; gap:4px;\">" +
          "<div style=\"font-weight:900; color:#0b1220;\">" + o.label + "</div>" +
          (o.desc ? "<div style=\"font-size:12px; color:rgba(11,18,32,.72); line-height:1.4;\">" + o.desc + "</div>" : "") +
        "</div></label>";
    });
    return html + "</div>";
  }
  function checklist(items, path){
    var html = "<div style=\"display:flex; flex-direction:column; gap:10px;\">";
    items.forEach(function(it){
      var checked = (S[path] && S[path][it.key]) ? "checked" : "";
      html += "<label style=\"display:flex; gap:12px; align-items:flex-start; cursor:pointer; border:1px solid rgba(11,18,32,.12); background:#fff; padding:12px; border-radius:14px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
        "<input type=\"checkbox\" " + checked + " onchange=\"MS_TF.toggle('" + path + "', '" + it.key + "', this.checked)\" style=\"margin-top:3px;\">" +
        "<div style=\"display:flex; flex-direction:column; gap:4px;\">" +
          "<div style=\"font-weight:900; color:#0b1220;\">" + it.label + "</div>" +
          (it.desc ? "<div style=\"font-size:12px; color:rgba(11,18,32,.72); line-height:1.4;\">" + it.desc + "</div>" : "") +
        "</div></label>";
    });
    return html + "</div>";
  }

  // ===== REPORT (semplificato ma funzionante) =====
  function safeNum(n){ return (isFinite(n) ? n : 0); }
  function esc(str){
    return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
  }
  function mkItem(title, impact, steps){
    return { title:title, impact:safeNum(impact), steps:steps||[] };
  }
  function sumItems(items){
    var s=0; (items||[]).forEach(function(it){ s += safeNum(it.impact); }); return s;
  }
  function generateReport(S, r){
    var waste = safeNum(r.wasteEur), loss = safeNum(r.lossEur);
    var area1 = [], area2 = [], area3 = [];

    if(S.crmOk === false) area1.push(mkItem("CRM non utilizzato come centro del processo", waste*0.28, [
      "Scegliere un CRM operativo (lead, pipeline, automazioni).",
      "Centralizzare tutti i lead nel CRM.",
      "Definire pipeline e responsabilità."
    ]));
    if(S.align === "mai") area1.push(mkItem("Nessun allineamento marketing-vendite", waste*0.12, [
      "Introdurre call congiunta settimanale (30 min).",
      "Portare dati: qualità lead, obiezioni, conversioni.",
      "Azioni correttive entro 24h."
    ]));

    if(S.seller === "esterni") area2.push(mkItem("Vendite esterne: rischio dispersione e poco controllo", loss*0.10, [
      "Definire SLA (tempi e tentativi) contrattuali.",
      "Tracciare tutto su CRM.",
      "Report giornaliero standardizzato."
    ]));
    if(S.seller === "interno" || S.seller === "esterni"){
      if(!S.salesControls.c10) area2.push(mkItem("Primo contatto non garantito entro 10 minuti", loss*0.18, [
        "Alert immediato al venditore/setter.",
        "Messaggio istantaneo al lead.",
        "Misurare tempo primo contatto per fonte."
      ]));
      if(!S.salesControls.c5) area2.push(mkItem("Follow-up non strutturato (meno di 5 tentativi)", loss*0.12, [
        "Sequenza 5 tentativi (call + WA/email).",
        "Intervalli: 0h, 2h, 24h, 72h, 7d.",
        "Taggare motivo mancata risposta."
      ]));
      if(!S.salesControls.script) area2.push(mkItem("Script setting/closing non standardizzati", loss*0.14, [
        "Scrivere script per prequalifica, valore, obiezioni, chiusura.",
        "Collegare script a lead scoring.",
        "Allenare e registrare call campione."
      ]));
    }

    // feedback base
    var fbOk = 0; Object.keys(S.fb||{}).forEach(function(k){ if(S.fb[k]) fbOk++; });
    if(fbOk < 4) area3.push(mkItem("Motivi di mancata chiusura non misurati con dati certi", waste*0.12, [
      "Motivo obbligatorio in CRM (mandatory).",
      "Standardizzare motivi (target, budget, fiducia, prezzo/valore, competitor).",
      "Revisione settimanale + interventi su ADV/script."
    ]));

    return {
      summary:{ wasteEur:waste, lossEur:loss, totalEur:waste+loss, wastePct:r.wastePct, lossPct:r.lossPct },
      areas:[
        { title:"Area 1 — Setup & Tracciamento", items:area1 },
        { title:"Area 2 — Struttura operativa vendite", items:area2 },
        { title:"Area 3 — Vendite → Marketing (feedback & attribuzione)", items:area3 }
      ]
    };
  }

  function renderReportHTML(payload){
    var rep = payload.report;
    var sum = rep.summary;

    function itemCard(it){
      var steps = (it.steps||[]).map(function(s,i){
        return "<li style=\"margin:0 0 6px 0; line-height:1.45;\"><span style=\"font-weight:900;\">Step " + (i+1) + ":</span> " + esc(s) + "</li>";
      }).join("");
      return "<div style=\"border:1px solid rgba(11,18,32,.12); background:#fff; border-radius:16px; padding:14px; margin-bottom:12px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
        "<div style=\"display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;\">" +
          "<div style=\"flex:1 1 auto; min-width:240px;\">" +
            "<div style=\"font-size:13px; font-weight:900; color:#0b1220;\">" + esc(it.title) + "</div>" +
          "</div>" +
          "<div style=\"text-align:right;\">" +
            "<div style=\"font-size:11px; font-weight:900; color:rgba(11,18,32,.62);\">Impatto stimato</div>" +
            "<div style=\"font-size:18px; font-weight:900; color:#b91c1c;\">" + money(it.impact) + "</div>" +
          "</div>" +
        "</div>" +
        (steps ? "<div style=\"margin-top:10px; border-top:1px solid rgba(11,18,32,.10); padding-top:10px;\"><div style=\"font-size:12px; font-weight:900; margin-bottom:8px;\">Cosa fare (step-by-step)</div><ul style=\"margin:0; padding-left:18px; font-size:12px; color:rgba(11,18,32,.82);\">" + steps + "</ul></div>" : "") +
      "</div>";
    }

    var html = "";
    html += "<div style=\"display:flex; gap:10px; flex-wrap:wrap;\">" +
      "<span style=\"display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid rgba(11,18,32,.12); background:#fff; font-size:12px; font-weight:900; color:rgba(11,18,32,.78);\">Spreco ADV: " + money(sum.wasteEur) + "</span>" +
      "<span style=\"display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid rgba(11,18,32,.12); background:#fff; font-size:12px; font-weight:900; color:rgba(11,18,32,.78);\">Fatturato perso: " + money(sum.lossEur) + "</span>" +
      "<span style=\"display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid rgba(11,18,32,.12); background:#fff; font-size:12px; font-weight:900; color:rgba(11,18,32,.78);\">Totale: " + money(sum.totalEur) + "</span>" +
    "</div>";

    rep.areas.forEach(function(a){
      var tot = sumItems(a.items);
      html += "<div style=\"border:1px solid rgba(11,18,32,.12); background:#fff; border-radius:18px; padding:14px; margin-top:12px;\">" +
        "<div style=\"display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;\">" +
          "<div style=\"font-size:14px; font-weight:900;\">" + esc(a.title) + "</div>" +
          "<div style=\"text-align:right;\"><div style=\"font-size:11px; font-weight:900; color:rgba(11,18,32,.62);\">Perdita stimata area</div><div style=\"font-size:18px; font-weight:900; color:#b91c1c;\">" + money(tot) + "</div></div>" +
        "</div>" +
        "<div style=\"margin-top:12px;\">" + (a.items.length ? a.items.map(itemCard).join("") : "<div style=\"font-size:12px; font-weight:900; color:#065f46; border:1px solid rgba(34,197,94,.30); background:rgba(34,197,94,.10); padding:10px 12px; border-radius:14px;\">✓ Nessuna criticità evidente in questa area (ottimo).</div>") +
        "</div></div>";
    });

    html += "<div style=\"border:1px solid rgba(11,18,32,.12); background:#fff; border-radius:18px; padding:14px; margin-top:12px;\">" +
      "<div style=\"font-size:14px; font-weight:900;\">Condividi questa analisi con il tuo marketing</div>" +
      "<div style=\"margin-top:6px; font-size:12px; color:rgba(11,18,32,.72); line-height:1.5;\">Copia il link univoco del report e inoltralo al team marketing/agenzia.</div>" +
      "<div style=\"display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;\">" +
        "<button type=\"button\" onclick=\"MS_TF.copyShare()\" style=\"cursor:pointer; border:1px solid rgba(11,18,32,.14); background:#fff; color:#0b1220; padding:13px 14px; border-radius:14px; font-weight:900; flex:1 1 220px;\">Copia link report</button>" +
        "<button type=\"button\" onclick=\"MS_TF.openShare()\" style=\"cursor:pointer; border:1px solid rgba(11,18,32,.14); background:#fff; color:#0b1220; padding:13px 14px; border-radius:14px; font-weight:900; flex:1 1 180px;\">Apri link</button>" +
      "</div>" +
      "<div id=\"ms_copy_ok\" style=\"display:none; margin-top:10px; font-size:12px; font-weight:900; color:#065f46; border:1px solid rgba(34,197,94,.30); background:rgba(34,197,94,.10); padding:10px 12px; border-radius:14px;\">✓ Link copiato.</div>" +
    "</div>";

    html += "<div style=\"display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;\">" +
      "<a href=\"https://www.markselling.it/booking-audit/\" style=\"flex:1 1 220px; text-decoration:none; text-align:center; background:#DC2626; color:#fff; padding:13px 14px; border-radius:14px; font-weight:900; border:1px solid rgba(0,0,0,.25);\">Prenota Audit</a>" +
      "<button type=\"button\" onclick=\"MS_TF.back()\" style=\"flex:1 1 160px; cursor:pointer; border:1px solid rgba(11,18,32,.14); background:#fff; color:#0b1220; padding:13px 14px; border-radius:14px; font-weight:900;\">Torna alle risposte</button>" +
    "</div>";

    return html;
  }

  function makeSharePayload(S, r, report){
    return { meta:{ v:"MSR-1", created_at:new Date().toISOString() }, input:S, result:r, report:report };
  }

  // ===== Reasons =====
  var reasonItems = [
    {key:"fuori_target", label:"Fuori target", desc:"Mismatch con pubblico ideale"},
    {key:"fuori_budget", label:"Fuori budget", desc:"Capacità di spesa non compatibile"},
    {key:"non_idoneo", label:"Non idoneo", desc:"Non rientra nei requisiti"},
    {key:"non_pronto", label:"Non pronto", desc:"Timing e priorità"},
    {key:"fid_brand", label:"Blocco fiducia brand", desc:"Autorità percepita"},
    {key:"fid_prod", label:"Blocco fiducia prodotto/servizio_toggle", desc:"Scetticismo / prova"},
    {key:"prezzo_valore", label:"Blocco prezzo/valore", desc:"Percezione valore"},
    {key:"competitor", label:"Ha scelto competitor", desc:"Alternativa preferita"},
    {key:"non_qual", label:"Non qualificato (bad data / no risposta)", desc:"Reperibilità e qualità contatto"}
  ];

  // ===== Steps engine =====
  var steps = [];
  function addStep(id, question, subtitle, renderFn, validateFn, onEnterFn){
    steps.push({id:id, q:question, sub:subtitle, render:renderFn, validate:validateFn, onEnter:onEnterFn});
  }

  addStep("budget","Quanto investi ogni mese in ADV?","Risultati mensili — inserisci il budget pubblicitario che investi in un mese.",
    function(){ return inputNumber("budget","es. 10000"); },
    function(){ return (+S.budget || 0) > 0; }
  );
  addStep("lead","Quanti lead gestisci mediamente ogni mese dalle campagne?","Risultati mensili — quanti lead entrano in un mese.",
    function(){ return inputNumber("lead","es. 200"); },
    function(){ return S.lead !== null && (+S.lead >= 0); }
  );
  addStep("sales","Quanti nuovi clienti acquisisci mediamente ogni mese dalle campagne?","Risultati mensili — quante vendite chiudi in un mese.",
    function(){ return inputNumber("sales","es. 10"); },
    function(){ return S.sales !== null && (+S.sales >= 0); }
  );
  addStep("rev","Fatturato mensile (€)","Risultati mensili — serve per stimare lo scontrino medio e il fatturato perso.",
    function(){ return inputNumber("rev","es. 50000"); },
    function(){ return S.rev !== null && (+S.rev >= 0); }
  );

  addStep("seller","Chi gestisce le vendite?","Vendite — seleziona lo scenario più vicino a come lavori oggi.",
    function(){
      return choiceRadio("seller",[
        {value:"io", label:"Io", desc:"Gestione diretta delle vendite"},
        {value:"interno", label:"Team interno", desc:"Team in-house (processi e controllo interni)"},
        {value:"esterni", label:"Venditori esterni", desc:"Outsourcing / agenti esterni"}
      ], S.seller);
    },
    function(){ return !!S.seller; }
  );

  addStep("sales_controls","Cosa controlli del team vendite?","Vendite — seleziona cosa è realmente controllato e misurato nel mese.",
    function(){
      return checklist([
        {key:"c10", label:"Primo contatto entro 10 minuti", desc:"Tempo di reazione misurabile"},
        {key:"c5", label:"Almeno 5 tentativi se non risponde", desc:"Follow-up strutturato"},
        {key:"script", label:"Script chiaro (prequalifica, presentazione, obiezioni)", desc:"Standard di conversione"}
      ], "salesControls");
    },
    function(){ return true; },
    function(){
      if(!(S.seller==="interno" || S.seller==="esterni")) MS_TF.next(true);
    }
  );

  addStep("crm_ok","Utilizzi un CRM per gestire lead e vendite?","CRM — seleziona l’opzione che descrive la situazione attuale nel mese.",
    function(){
      return choiceRadio("crmOk",[
        {value:"si", label:"Sì", desc:"Traccia davvero lead, follow-up e pipeline"},
        {value:"no", label:"No", desc:"Gestione dispersiva (chat/appunti/memoria)"}
      ], (S.crmOk===true ? "si" : (S.crmOk===false ? "no" : null)));
    },
    function(){ return (S.crmOk===true || S.crmOk===false); }
  );

  addStep("crm_feat","Quali funzioni CRM usi davvero?","CRM — seleziona le funzioni che utilizzi concretamente nel mese.",
    function(){
      return checklist([
        {key:"cal", label:"Calendario, rubrica, appuntamenti", desc:"Agenda ordinata e condivisa"},
        {key:"rem", label:"Reminder automatici al cliente", desc:"Riduce no-show"},
        {key:"wf", label:"Workflow automatizzati sulle azioni del lead", desc:"Nurture e follow-up"},
        {key:"score", label:"Lead scoring + notifica follow-up immediato", desc:"Priorità ai lead caldi"},
        {key:"pipe", label:"Pipeline automatizzata", desc:"Stati chiari e misurabili"},
        {key:"flow", label:"Flusso clienti", desc:"Dalla vendita al post-vendita"}
      ], "crmFeat");
    },
    function(){ return true; },
    function(){ if(S.crmOk===false) MS_TF.next(true); }
  );

  addStep("crm_chan","Quali messaggi automatici invii dal CRM?","CRM — seleziona i canali che usi per messaggi automatici nel mese.",
    function(){
      return checklist([
        {key:"email", label:"Email", desc:"Follow-up e nurture"},
        {key:"wa", label:"WhatsApp / SMS", desc:"Velocità di contatto"}
      ], "crmChan");
    },
    function(){ return true; },
    function(){ if(S.crmOk===false) MS_TF.next(true); }
  );

  addStep("align","Ogni quanto marketing e vendite si confrontano in call congiunte su qualità lead, obiezioni e conversioni?","Allineamento marketing — seleziona la frequenza reale nel mese.",
    function(){
      return choiceRadio("align",[
        {value:"mai", label:"Mai", desc:"Nessun momento strutturato di allineamento"},
        {value:"30", label:"Ogni 30 giorni", desc:"Ritmo mensile"},
        {value:"7", label:"Ogni 7 giorni", desc:"Ritmo settimanale"},
        {value:"day", label:"Ogni giorno", desc:"Allineamento continuo"}
      ], S.align);
    },
    function(){ return !!S.align; }
  );

  addStep("fb","Sai misurare, con dati certi, i motivi di mancata chiusura?","Feedback vendite — seleziona ciò che riesci a quantificare nel mese.",
    function(){ return checklist(reasonItems, "fb"); },
    function(){ return true; }
  );

  addStep("camp","In caso di mancata vendita/opportunità, quali di questi motivi riesci a distinguere per singola campagna?","Attribuzione — seleziona ciò che riesci a leggere per campagna nel mese.",
    function(){ return checklist(reasonItems, "camp"); },
    function(){ return true; }
  );

  addStep("adset","In caso di mancata vendita/opportunità, quali di questi motivi riesci a distinguere per gruppo di annunci (adset)?","Attribuzione — seleziona ciò che riesci a leggere per adset nel mese.",
    function(){ return checklist(reasonItems, "adset"); },
    function(){ return true; }
  );

  addStep("loading","Sto calcolando…","Attendi qualche secondo: stiamo elaborando la tua situazione mensile e la reportistica MarkSelling.",
    function(){
      return "<div style=\"padding:8px 0;\">" +
        "<div style=\"display:flex; align-items:center; gap:12px; margin-top:10px;\">" +
          "<div style=\"width:34px; height:34px; border-radius:999px; border:4px solid rgba(11,18,32,.14); border-top-color:#0b1220; animation:msSpin 1s linear infinite;\"></div>" +
          "<div style=\"font-weight:900; color:#0b1220; font-size:14px;\">Sto calcolando…</div>" +
        "</div>" +
        "<style>@keyframes msSpin{to{transform:rotate(360deg)}}</style>" +
      "</div>";
    },
    function(){ return true; }
  );

  var LAST_SHARE_LINK = null;

  addStep("result","Report MarkSelling","Risultati mensili — ecco la stima prudenziale e il piano di intervento per aree.",
    function(){
      var r = calc();
      var report = generateReport(S, r);
      var payload = makeSharePayload(S, r, report);
      LAST_SHARE_LINK = buildShareLink(payload);

      return renderReportHTML({ report: report });
    },
    function(){ return true; }
  );

  // ===== NAV ENGINE =====
  var idx = 0;
  function step(){ return steps[idx]; }
  function findIndex(id){ for(var i=0;i<steps.length;i++){ if(steps[i].id===id) return i; } return 0; }

  function updateProgress(){
    var total = steps.length;
    var shown = idx + 1;
    var p = clamp(shown/total, 0, 1);
    $("ms_prog_label").textContent = "Domanda " + shown + " di " + total;
    $("ms_prog_pct").textContent = Math.round(p*100) + "%";
    $("ms_prog_bar").style.width = Math.round(p*100) + "%";
  }

  function render(){
    var st = step();
    if(!st) return;

    updateProgress();

    $("ms_step_question").textContent = st.q;
    $("ms_step_sub").textContent = st.sub || "";
    $("ms_step_body").innerHTML = st.render ? st.render() : "";

    $("ms_back_btn").style.visibility = (idx===0) ? "hidden" : "visible";
    $("ms_next_btn").style.display = (st.id==="result") ? "none" : "inline-flex";
    $("ms_next_btn").textContent = (st.id==="adset") ? "Calcola →" : "Avanti →";

    showErr(false);

    if(st.onEnter) st.onEnter();
    setTimeout(scrollTopForm, 40);
  }

  function canNext(){
    var st = step();
    if(!st) return false;
    if(st.validate) return !!st.validate();
    return true;
  }

  function goNextInternal(silent){
    var st = step();
    if(!silent && !canNext()){
      showErr(true);
      return;
    }
    showErr(false);

    if(!silent && st.id !== "loading" && st.id !== "result") pulseSaved();

    if(st.id === "adset"){
      idx = findIndex("loading"); render();
      setTimeout(function(){
        idx = findIndex("result"); render();
      }, 1200);
      return;
    }

    idx = Math.min(idx+1, steps.length-1);
    render();
  }

  // ===== VIEW MODE (quando apri link condiviso) =====
  var shared = getSharedPayloadFromUrl();
  var VIEW_MODE = !!shared;

  function enterViewMode(sharedPayload){
    // nascondi progress e nav
    if($("ms_progress_wrap")) $("ms_progress_wrap").style.display = "none";
    if($("ms_nav")) $("ms_nav").style.display = "none";
    if($("ms_reset_btn")) $("ms_reset_btn").style.display = "none";

    $("ms_title_top").textContent = "Report MarkSelling (condiviso)";
    $("ms_step_question").textContent = "Analisi MarkSelling";
    $("ms_step_sub").textContent = "Questo report è stato generato dal simulatore e condiviso tramite link univoco.";
    $("ms_step_body").innerHTML = renderReportHTML(sharedPayload);
  }

  // ===== BIND BUTTONS =====
  function bindButtons(){
    var next = $("ms_next_btn");
    var back = $("ms_back_btn");
    var reset = $("ms_reset_btn");

    if(next) next.onclick = function(){ MS_TF.next(); };
    if(back) back.onclick = function(){ MS_TF.back(); };
    if(reset) reset.onclick = function(){ MS_TF.reset(); };
  }

  // ===== PUBLIC API =====
  window.MS_TF = {
    setNum: function(key, val){
      var n = parseFloat(val);
      S[key] = isFinite(n) ? n : null;
      showErr(false);
    },
    setRadio: function(stateKey, value){
      if(stateKey === "seller") S.seller = value;
      if(stateKey === "crmOk") S.crmOk = (value === "si");
      if(stateKey === "align") S.align = value;
      showErr(false);
    },
    toggle: function(path, key, checked){
      if(!S[path]) S[path] = {};
      S[path][key] = !!checked;
      showErr(false);
    },
    next: function(silent){
      if(step().id === "loading") return;
      goNextInternal(!!silent);
    },
    back: function(){
      if(VIEW_MODE) return;
      if(step().id === "loading"){
        idx = findIndex("adset");
        render();
        return;
      }
      idx = Math.max(idx-1, 0);
      render();
    },
    reset: function(){
      if(VIEW_MODE) return;

      S = {
        budget:null, lead:null, sales:null, rev:null,
        seller:null,
        salesControls:{ c10:false, c5:false, script:false },
        crmOk:null,
        crmFeat:{ cal:false, rem:false, wf:false, score:false, pipe:false, flow:false },
        crmChan:{ email:false, wa:false },
        align:null,
        fb:{ fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false, fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false },
        camp:{ fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false, fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false },
        adset:{ fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false, fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false }
      };
      LAST_SHARE_LINK = null;
      idx = 0;
      render();
    },
    copyShare: async function(){
      var link = LAST_SHARE_LINK;
      if(!link){
        var r = calc();
        var report = generateReport(S, r);
        link = buildShareLink(makeSharePayload(S, r, report));
        LAST_SHARE_LINK = link;
      }
      var ok = await copyToClipboard(link);
      var box = $("ms_copy_ok");
      if(box){
        box.style.display = ok ? "block" : "none";
        if(ok) setTimeout(function(){ box.style.display = "none"; }, 4500);
      }
    },
    openShare: function(){
      var link = LAST_SHARE_LINK;
      if(!link){
        var r = calc();
        var report = generateReport(S, r);
        link = buildShareLink(makeSharePayload(S, r, report));
        LAST_SHARE_LINK = link;
      }
      window.open(link, "_blank");
    }
  };

  // Enter = avanti
  document.addEventListener("keydown", function(e){
    if(VIEW_MODE) return;
    if(e.key === "Enter" && !e.shiftKey){
      var st = step();
      if(st && st.id !== "result" && st.id !== "loading"){
        e.preventDefault();
        MS_TF.next();
      }
    }
  });

  bindButtons();

  if(VIEW_MODE){
    enterViewMode(shared);
  }else{
    render();
  }

})();
