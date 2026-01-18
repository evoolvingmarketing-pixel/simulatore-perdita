(function(){
  function $(id){ return document.getElementById(id); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function money(x){
    if(!isFinite(x)) return "—";
    return x.toLocaleString("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
  }
  function scrollTopForm(){
    var top = $("ms_top");
    if(top && top.scrollIntoView){
      top.scrollIntoView({behavior:"smooth", block:"start"});
    }else{
      window.scrollTo({top:0, behavior:"smooth"});
    }
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
  function showErr(show){
    var el = $("ms_err");
    if(!el) return;
    el.style.display = show ? "block" : "none";
  }

  // ✅ Stato
  var S = {
    budget: null,
    lead: null,
    sales: null,
    rev: null,

    seller: null,
    salesControls: { c10:false, c5:false, script:false },

    crmOk: null,
    crmFeat: { cal:false, rem:false, wf:false, score:false, pipe:false, flow:false },
    crmChan: { email:false, wa:false },

    align: null,

    fb: {
      fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false,
      fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false
    },
    camp: {
      fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false,
      fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false
    },
    adset: {
      fuori_target:false, fuori_budget:false, non_idoneo:false, non_pronto:false,
      fid_brand:false, fid_prod:false, prezzo_valore:false, competitor:false, non_qual:false
    }
  };

  var CAPS = { waste: 0.35, loss: 0.55 };

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
    if(S.align === "day") wastePct += 0;

    var fbWeights = {
      fuori_target:5, fuori_budget:5, non_idoneo:5,
      non_pronto:2, fid_brand:2, fid_prod:2, prezzo_valore:2, competitor:2, non_qual:2
    };
    Object.keys(fbWeights).forEach(function(k){
      if(!S.fb[k]) wastePct += fbWeights[k];
    });

    var campWeights = {
      fuori_target:10, fuori_budget:10, non_idoneo:10,
      non_pronto:8, fid_brand:8, fid_prod:8, prezzo_valore:8, competitor:8, non_qual:8
    };
    Object.keys(campWeights).forEach(function(k){
      if(!S.camp[k]) wastePct += campWeights[k];
    });

    var adsetWeights = {
      fuori_target:5, fuori_budget:5,
      non_idoneo:4, non_pronto:4, fid_brand:4, fid_prod:4, prezzo_valore:4, competitor:4, non_qual:4
    };
    Object.keys(adsetWeights).forEach(function(k){
      if(!S.adset[k]) wastePct += adsetWeights[k];
    });

    wastePct = Math.min((wastePct/100), CAPS.waste);

    return {
      wastePct: wastePct,
      lossPct: lossPct,
      wasteEur: budget * wastePct,
      lossEur:  rev    * lossPct
    };
  }

  // ✅ HTML builders
  function inputNumber(key, placeholder){
    var v = (S[key]===null || S[key]===undefined) ? "" : S[key];
    return "" +
      "<input type=\"number\" inputmode=\"decimal\" min=\"0\" step=\"1\" value=\"" + String(v).replace(/\"/g,'&quot;') + "\" " +
      "oninput=\"MS_TF.setNum('" + key + "', this.value)\" " +
      "placeholder=\"" + placeholder + "\" " +
      "style=\"width:100%; padding:14px 14px; border-radius:14px; border:1px solid rgba(11,18,32,.14); " +
      "background:#ffffff; color:#0b1220; outline:none; font-weight:900; font-size:16px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">";
  }

  function choiceRadio(stateKey, options, current){
    var html = "<div style=\"display:flex; flex-direction:column; gap:10px;\">";
    options.forEach(function(o){
      var checked = (current===o.value) ? "checked" : "";
      html += "" +
      "<label style=\"display:flex; gap:12px; align-items:flex-start; cursor:pointer; " +
      "border:1px solid rgba(11,18,32,.12); background:#ffffff; padding:12px; border-radius:14px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
        "<input type=\"radio\" name=\"ms_" + stateKey + "\" value=\"" + o.value + "\" " + checked +
        " onchange=\"MS_TF.setRadio('" + stateKey + "', '" + o.value + "')\" style=\"margin-top:3px;\">" +
        "<div style=\"display:flex; flex-direction:column; gap:4px;\">" +
          "<div style=\"font-weight:900; color:#0b1220;\">" + o.label + "</div>" +
          (o.desc ? "<div style=\"font-size:12px; color:rgba(11,18,32,.72); line-height:1.4;\">" + o.desc + "</div>" : "") +
        "</div>" +
      "</label>";
    });
    html += "</div>";
    return html;
  }

  function checklist(items, path){
    var html = "<div style=\"display:flex; flex-direction:column; gap:10px;\">";
    items.forEach(function(it){
      var checked = (S[path] && S[path][it.key]) ? "checked" : "";
      html += "" +
        "<label style=\"display:flex; gap:12px; align-items:flex-start; cursor:pointer; " +
        "border:1px solid rgba(11,18,32,.12); background:#ffffff; padding:12px; border-radius:14px; box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
          "<input type=\"checkbox\" " + checked +
          " onchange=\"MS_TF.toggle('" + path + "', '" + it.key + "', this.checked)\" style=\"margin-top:3px;\">" +
          "<div style=\"display:flex; flex-direction:column; gap:4px;\">" +
            "<div style=\"font-weight:900; color:#0b1220;\">" + it.label + "</div>" +
            (it.desc ? "<div style=\"font-size:12px; color:rgba(11,18,32,.72); line-height:1.4;\">" + it.desc + "</div>" : "") +
          "</div>" +
        "</label>";
    });
    html += "</div>";
    return html;
  }

  var reasonItems = [
    {key:"fuori_target", label:"Fuori target", desc:"Mismatch con pubblico ideale"},
    {key:"fuori_budget", label:"Fuori budget", desc:"Capacità di spesa non compatibile"},
    {key:"non_idoneo", label:"Non idoneo", desc:"Non rientra nei requisiti"},
    {key:"non_pronto", label:"Non pronto", desc:"Timing e priorità"},
    {key:"fid_brand", label:"Blocco fiducia brand", desc:"Autorità percepita"},
    {key:"fid_prod", label:"Blocco fiducia prodotto/servizio", desc:"Scetticismo / prova"},
    {key:"prezzo_valore", label:"Blocco prezzo/valore", desc:"Percezione valore"},
    {key:"competitor", label:"Ha scelto competitor", desc:"Alternativa preferita"},
    {key:"non_qual", label:"Non qualificato (bad data / no risposta)", desc:"Reperibilità e qualità contatto"}
  ];

  // ✅ Steps
  var steps = [];
  function addStep(id, question, subtitle, renderFn, validateFn, onEnterFn){
    steps.push({id:id, q:question, sub:subtitle, render:renderFn, validate:validateFn, onEnter:onEnterFn});
  }

  addStep("budget",
    "Quanto investi ogni mese in ADV?",
    "Risultati mensili — inserisci il budget pubblicitario che investi in un mese.",
    function(){ return inputNumber("budget","es. 10000"); },
    function(){ return (+S.budget || 0) > 0; }
  );

  addStep("lead",
    "Quanti lead gestisci mediamente ogni mese dalle campagne?",
    "Risultati mensili — quanti lead entrano in un mese.",
    function(){ return inputNumber("lead","es. 200"); },
    function(){ return S.lead !== null && (+S.lead >= 0); }
  );

  addStep("sales",
    "Quanti nuovi clienti acquisisci mediamente ogni mese dalle campagne?",
    "Risultati mensili — quante vendite chiudi in un mese.",
    function(){ return inputNumber("sales","es. 10"); },
    function(){ return S.sales !== null && (+S.sales >= 0); }
  );

  addStep("rev",
    "Fatturato mensile (€)",
    "Risultati mensili — serve per stimare lo scontrino medio e il fatturato perso.",
    function(){ return inputNumber("rev","es. 50000"); },
    function(){ return S.rev !== null && (+S.rev >= 0); }
  );

  addStep("seller",
    "Chi gestisce le vendite?",
    "Vendite — seleziona lo scenario più vicino a come lavori oggi.",
    function(){
      return choiceRadio("seller",[
        {value:"io", label:"Io", desc:"Gestione diretta delle vendite"},
        {value:"interno", label:"Team interno", desc:"Team in-house (processi e controllo interni)"},
        {value:"esterni", label:"Venditori esterni", desc:"Outsourcing / agenti esterni"}
      ], S.seller);
    },
    function(){ return !!S.seller; }
  );

  addStep("sales_controls",
    "Cosa controlli del team vendite?",
    "Vendite — seleziona cosa è realmente controllato e misurato nel mese.",
    function(){
      return checklist([
        {key:"c10", label:"Primo contatto entro 10 minuti", desc:"Tempo di reazione misurabile"},
        {key:"c5", label:"Almeno 5 tentativi se non risponde", desc:"Follow-up strutturato"},
        {key:"script", label:"Script chiaro (prequalifica, presentazione, obiezioni)", desc:"Standard di conversione"}
      ], "salesControls");
    },
    function(){ return true; },
    function(){
      if(!(S.seller==="interno" || S.seller==="esterni")){
        MS_TF.next(true);
      }
    }
  );

  addStep("crm_ok",
    "Utilizzi un CRM per gestire lead e vendite?",
    "CRM — seleziona l’opzione che descrive la situazione attuale nel mese.",
    function(){
      return choiceRadio("crmOk",[
        {value:"si", label:"Sì", desc:"Traccia davvero lead, follow-up e pipeline"},
        {value:"no", label:"No", desc:"Gestione dispersiva (chat/appunti/memoria)"}
      ], (S.crmOk===true ? "si" : (S.crmOk===false ? "no" : null)));
    },
    function(){ return (S.crmOk===true || S.crmOk===false); }
  );

  addStep("crm_feat",
    "Quali funzioni CRM usi davvero?",
    "CRM — seleziona le funzioni che utilizzi concretamente nel mese.",
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
    function(){
      if(S.crmOk===false){
        MS_TF.next(true);
      }
    }
  );

  addStep("crm_chan",
    "Quali messaggi automatici invii dal CRM?",
    "CRM — seleziona i canali che usi per messaggi automatici nel mese.",
    function(){
      return checklist([
        {key:"email", label:"Email", desc:"Follow-up e nurture"},
        {key:"wa", label:"WhatsApp / SMS", desc:"Velocità di contatto"}
      ], "crmChan");
    },
    function(){ return true; },
    function(){
      if(S.crmOk===false){
        MS_TF.next(true);
      }
    }
  );

  addStep("align",
    "Ogni quanto marketing e vendite si confrontano in call congiunte su qualità lead, obiezioni e conversioni?",
    "Allineamento marketing — seleziona la frequenza reale nel mese.",
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

  addStep("fb",
    "Sai misurare, con dati certi, i motivi di mancata chiusura?",
    "Feedback vendite — seleziona ciò che riesci a quantificare nel mese.",
    function(){ return checklist(reasonItems, "fb"); },
    function(){ return true; }
  );

  addStep("camp",
    "In caso di mancata vendita/opportunità, quali di questi motivi riesci a distinguere per singola campagna?",
    "Attribuzione — seleziona ciò che riesci a leggere per campagna nel mese.",
    function(){ return checklist(reasonItems, "camp"); },
    function(){ return true; }
  );

  addStep("adset",
    "In caso di mancata vendita/opportunità, quali di questi motivi riesci a distinguere per gruppo di annunci (adset)?",
    "Attribuzione — seleziona ciò che riesci a leggere per adset nel mese.",
    function(){ return checklist(reasonItems, "adset"); },
    function(){ return true; }
  );

  addStep("loading",
    "Sto calcolando…",
    "Attendi qualche secondo: stiamo elaborando la tua situazione mensile.",
    function(){
      return "" +
      "<div style=\"padding:8px 0;\">" +
        "<div style=\"display:flex; align-items:center; gap:12px; margin-top:10px;\">" +
          "<div style=\"width:34px; height:34px; border-radius:999px; border:4px solid rgba(11,18,32,.14); border-top-color:#0b1220; animation:msSpin 1s linear infinite;\"></div>" +
          "<div style=\"font-weight:900; color:#0b1220; font-size:14px;\">Sto calcolando…</div>" +
        "</div>" +
        "<div style=\"margin-top:14px; height:10px; border-radius:999px; background:rgba(11,18,32,.10); overflow:hidden;\">" +
          "<div style=\"height:10px; width:45%; border-radius:999px; background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 45%,#7c3aed 100%); animation:msLoad 1.2s ease-in-out infinite;\"></div>" +
        "</div>" +
      "</div>" +
      "<style>@keyframes msSpin{to{transform:rotate(360deg)}} @keyframes msLoad{0%{transform:translateX(-30%)}50%{transform:translateX(120%)}100%{transform:translateX(-30%)}}</style>";
    },
    function(){ return true; }
  );

  addStep("result",
    "Risposta",
    "Risultati mensili — ecco la stima prudenziale basata sulle risposte inserite.",
    function(){
      var r = calc();
      var wastePctTxt = (r.wastePct*100).toFixed(0) + "% (cap 35%)";
      var lossPctTxt  = (r.lossPct*100).toFixed(0) + "% (cap 55%)";

      function lossBox(title, amount, pctText, desc){
        return "" +
          "<div style=\"border-radius:16px; padding:14px; border:1px solid rgba(239,68,68,.28); background:rgba(239,68,68,.08); margin-bottom:12px;\">" +
            "<div style=\"font-size:12px; font-weight:900; color:rgba(11,18,32,.92);\">" + title + "</div>" +
            "<div style=\"display:flex; justify-content:space-between; gap:12px; align-items:baseline; margin-top:8px;\">" +
              "<div style=\"font-size:28px; font-weight:900; color:#b91c1c;\">" + amount + "</div>" +
              "<div style=\"font-size:13px; font-weight:900; color:#b91c1c;\">" + pctText + "</div>" +
            "</div>" +
            "<div style=\"font-size:12px; color:rgba(11,18,32,.74); line-height:1.5; margin-top:8px;\">" + desc + "</div>" +
          "</div>";
      }

      var out = "";
      out += lossBox(
        "Budget ADV sprecato (mensile)",
        money(r.wasteEur),
        wastePctTxt,
        "Stima prudenziale della quota di budget che, nel mese, non produce miglioramento misurabile (allocazione/targeting/messaggio)."
      );

      out += lossBox(
        "Fatturato perso (mensile)",
        money(r.lossEur),
        lossPctTxt,
        "Stima prudenziale della quota di fatturato potenziale che, nel mese, non viene catturata per mancanza di processo e controllo operativo."
      );

      out += "" +
        "<div style=\"display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;\">" +
          "<a href=\"https://www.markselling.it/booking-audit/\" style=\"flex:1 1 220px; text-decoration:none; text-align:center; " +
          "background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 45%,#7c3aed 100%); color:#fff; " +
          "padding:13px 14px; border-radius:14px; font-weight:900; box-shadow:0 16px 36px rgba(37,99,235,.20);\">" +
            "Prenota Audit" +
          "</a>" +
          "<button type=\"button\" onclick=\"MS_TF.back()\" style=\"flex:1 1 160px; cursor:pointer; " +
          "border:1px solid rgba(11,18,32,.14); background:#ffffff; color:#0b1220; " +
          "padding:13px 14px; border-radius:14px; font-weight:900; box-shadow:0 10px 26px rgba(11,18,32,.06);\">" +
            "Torna alle risposte" +
          "</button>" +
        "</div>";

      return out;
    },
    function(){ return true; }
  );

  var idx = 0;
  function step(){ return steps[idx]; }

  function updateProgress(){
    var total = steps.length;
    var shown = idx + 1;
    var p = clamp(shown / total, 0, 1);

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

    // ✅ QUI nascevano i “campi che non appaiono” se app.js era sporco o con <script>
    $("ms_step_body").innerHTML = st.render ? st.render() : "";

    $("ms_back_btn").style.visibility = (idx === 0) ? "hidden" : "visible";
    $("ms_next_btn").style.display = (st.id === "result") ? "none" : "inline-flex";

    if(st.id === "adset") $("ms_next_btn").textContent = "Calcola →";
    else $("ms_next_btn").textContent = "Avanti →";

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

  function findIndex(id){
    for(var i=0;i<steps.length;i++){ if(steps[i].id === id) return i; }
    return 0;
  }

  function goNextInternal(silent){
    var st = step();
    if(!silent && !canNext()){
      showErr(true);
      return;
    }
    showErr(false);

    if(!silent && st.id !== "loading" && st.id !== "result"){
      pulseSaved();
    }

    if(st.id === "adset"){
      idx = findIndex("loading");
      render();

      setTimeout(function(){
        idx = findIndex("result");
        render();
      }, 1200);

      return;
    }

    idx = Math.min(idx + 1, steps.length - 1);
    render();
  }

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
    },
    next: function(silent){
      if(step().id === "loading") return;
      goNextInternal(!!silent);
    },
    back: function(){
      if(step().id === "loading"){
        idx = findIndex("adset");
        render();
        return;
      }
      idx = Math.max(idx - 1, 0);
      render();
    },
    reset: function(){
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
      idx = 0;
      render();
    }
  };

  document.addEventListener("keydown", function(e){
    if(e.key === "Enter" && !e.shiftKey){
      var st = step();
      if(st && st.id !== "result" && st.id !== "loading"){
        e.preventDefault();
        MS_TF.next();
      }
    }
  });

  // ✅ Extra safety: avvia render solo quando DOM è pronto
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
