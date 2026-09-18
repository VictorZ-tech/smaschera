document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("analyzerForm");
  const input = document.getElementById("sms");
  const clearButton = document.getElementById("pulisci");
  const result = document.getElementById("risultato");
  const counter = document.getElementById("counter");

  // I segnali sono volutamente spiegabili: ogni punteggio viene mostrato all'utente.
  // Una parola isolata pesa poco; le combinazioni di segnali pesano di più.
  const signals = [
    {
      id: "credentials",
      score: 30,
      reason: "Richiede codici o credenziali di sicurezza",
      patterns: [
        /\b(?:otp|pin|cvv|password|credenziali)\b/,
        /\bcodice\s+(?:di\s+)?(?:sicurezza|verifica|accesso|conferma)\b/,
        /\bnumero\s+(?:della\s+)?(?:carta|tessera)\b/
      ]
    },
    {
      id: "money",
      score: 15,
      reason: "Fa leva su denaro, pagamenti o rimborsi",
      patterns: [
        /\b(?:bonifico|addebito|pagamento|rimborso|credito|debito|saldo|fattura|multa|sanzione)\b/,
        /\b(?:carta\s+(?:di\s+)?credito|conto\s+corrente|iban)\b/
      ]
    },
    {
      id: "threat",
      score: 18,
      reason: "Minaccia un blocco, una sospensione o conseguenze",
      patterns: [
        /\b(?:conto|carta|profilo|account|utenza|servizio)\s+(?:e|è|risulta)?\s*(?:stato\s+)?(?:bloccato|sospeso|limitato|disattivato|compromesso)\b/,
        /\b(?:accesso|attivit[aà]|operazione)\s+(?:anomalo|sospett[oa]|non autorizzat[oa])\b/,
        /\b(?:evita|per evitare)\s+(?:il|la|una)?\s*(?:blocco|sospensione|chiusura|penale)\b/
      ]
    },
    {
      id: "urgency",
      score: 12,
      reason: "Usa urgenza o una scadenza per mettere pressione",
      patterns: [
        /\b(?:subito|ora|adesso|immediatamente|urgentemente)\b/,
        /\b(?:entro|prima\s+che|ultima\s+possibilit[aà])\s+(?:\d+|oggi|domani|\w+\s+ore)\b/,
        /\b(?:scade|scadenza|azione\s+richiesta)\b/
      ]
    },
    {
      id: "action",
      score: 9,
      reason: "Ti invita a compiere un’azione non richiesta",
      patterns: [
        /\b(?:clicca|apri|segui|tocca)\s+(?:qui|il|questo)?\s*(?:link|collegamento)?\b/,
        /\b(?:accedi|verifica|conferma|aggiorna|sblocca|regolarizza)\s+(?:ora|subito|qui|il tuo|i tuoi|la tua)?\b/,
        /\b(?:rispondi|invia|comunica|condividi)\s+(?:con|il|la|i tuoi|le tue)?\s*(?:codici?|dati|informazioni|credenziali)\b/
      ]
    },
    {
      id: "impersonation",
      score: 7,
      reason: "Cita un ente o un servizio che viene spesso imitato",
      patterns: [
        /\b(?:poste(?:\s+italiane|info)?|inps|agenzia\s+delle\s+entrate|spid|paypal|amazon|banca|intesa(?:\s+sanpaolo)?|unicredit|nexi|dhl|gls|ups|sda|corriere|whatsapp|telegram)\b/
      ]
    },
    {
      id: "delivery",
      score: 5,
      reason: "Usa il tema di una consegna o di un pacco come pretesto",
      patterns: [/\b(?:pacco|consegna|spedizione|corriere|giacenza|ritiro)\b/]
    },
    {
      id: "bait",
      score: 10,
      reason: "Promette un vantaggio insolito o una vincita",
      patterns: [/\b(?:hai\s+vinto|vincita|premio|buono\s+regalo|rimborso\s+garantito|bonus\s+esclusivo|offerta\s+imperdibile)\b/]
    },
    {
      id: "secrecy",
      score: 12,
      reason: "Invita a mantenere segrete informazioni o a non contattare nessuno",
      patterns: [/\b(?:non\s+(?:dire|condividere|mostrare)|mantieni\s+(?:il\s+)?segreto|non\s+contattare)\b/]
    },
    {
      id: "genericGreeting",
      score: 4,
      reason: "Usa un saluto generico invece del tuo nome",
      patterns: [/\b(?:gentile|caro|cara)\s+(?:cliente|utente|cittadino)\b/]
    }
  ];

  const shorteners = new Set(["bit.ly", "t.co", "tinyurl.com", "is.gd", "cutt.ly", "rebrand.ly", "shorturl.at", "rb.gy"]);
  const brandDomains = {
    poste: ["poste.it", "posteitaliane.it"],
    paypal: ["paypal.com"],
    amazon: ["amazon.it", "amazon.com"],
    inps: ["inps.it"],
    unicredit: ["unicredit.it", "unicredit.eu"],
    intesa: ["intesasanpaolo.com", "intesasanpaolo.it"],
    dhl: ["dhl.com"],
    gls: ["gls-italy.com", "gls-group.com"],
    ups: ["ups.com"]
  };

  function normalize(text) {
    return text
      .toLocaleLowerCase("it-IT")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function addFinding(findings, score, reason) {
    if (!findings.some((finding) => finding.reason === reason)) {
      findings.push({ score, reason });
    }
  }

  function getUrls(text) {
    return text.match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi) || [];
  }

  function analyseUrl(rawUrl, findings) {
    const cleanUrl = rawUrl.replace(/[),.;!?]+$/, "");
    let url;

    try {
      url = new URL(/^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`);
    } catch {
      addFinding(findings, 15, "Contiene un collegamento scritto in modo insolito");
      return;
    }

    const host = url.hostname.toLowerCase();
    addFinding(findings, 20, "Contiene un link esterno: non aprirlo dal messaggio");

    if (shorteners.has(host) || [...shorteners].some((domain) => host.endsWith(`.${domain}`))) {
      addFinding(findings, 18, "Il link è abbreviato e nasconde la destinazione finale");
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
      addFinding(findings, 22, "Il link usa un indirizzo numerico anziché un dominio riconoscibile");
    }
    if (host.includes("xn--")) {
      addFinding(findings, 20, "Il dominio usa caratteri internazionali: potrebbe imitare un sito noto");
    }
    if (url.username || url.password || cleanUrl.includes("@")) {
      addFinding(findings, 20, "Il link contiene una struttura ingannevole con il simbolo @");
    }

    Object.entries(brandDomains).forEach(([brand, officialDomains]) => {
      if (host.includes(brand) && !officialDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        addFinding(findings, 18, `Il dominio cita “${brand}” ma non corrisponde ai suoi domini ufficiali noti`);
      }
    });
  }

  function analyseText(rawText) {
    const text = normalize(rawText);
    const findings = [];
    const triggered = new Set();

    signals.forEach((signal) => {
      if (signal.patterns.some((pattern) => pattern.test(text))) {
        triggered.add(signal.id);
        addFinding(findings, signal.score, signal.reason);
      }
    });

    const urls = getUrls(rawText);
    urls.forEach((url) => analyseUrl(url, findings));

    // Le combinazioni sono più significative di una singola parola, quindi ricevono un peso aggiuntivo.
    if (triggered.has("credentials") && (triggered.has("action") || urls.length)) {
      addFinding(findings, 18, "Abbina una richiesta di sicurezza a un’azione o a un link");
    }
    if (triggered.has("impersonation") && (triggered.has("action") || urls.length)) {
      addFinding(findings, 14, "Un servizio noto viene associato a un’azione non richiesta");
    }
    if (triggered.has("urgency") && (triggered.has("threat") || triggered.has("money"))) {
      addFinding(findings, 14, "Combina pressione psicologica con una possibile conseguenza economica o un blocco");
    }
    if (triggered.has("delivery") && (triggered.has("money") || urls.length)) {
      addFinding(findings, 10, "Una consegna è collegata a pagamento o a un link");
    }

    const uppercaseLetters = (rawText.match(/[A-ZÀ-ÖØ-Þ]/g) || []).length;
    const letters = (rawText.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
    if (letters > 24 && uppercaseLetters / letters > 0.65) {
      addFinding(findings, 5, "Usa molte maiuscole per aumentare il senso di allarme");
    }

    const score = Math.min(100, findings.reduce((total, finding) => total + finding.score, 0));
    return { score, findings };
  }

  function riskProfile(score) {
    if (score >= 67) {
      return {
        level: "Alto", tone: "high", icon: "!",
        verdict: "Il messaggio contiene più segnali compatibili con una possibile truffa.",
        advice: "Non cliccare link, non rispondere e non condividere dati. Verifica solo dall’app o dal sito ufficiale del servizio citato."
      };
    }
    if (score >= 32) {
      return {
        level: "Da verificare", tone: "medium", icon: "?",
        verdict: "Ci sono elementi da controllare prima di fidarti del messaggio.",
        advice: "Non usare i contatti o i link nel messaggio. Cerca autonomamente il canale ufficiale e verifica lì."
      };
    }
    return {
      level: "Basso", tone: "low", icon: "✓",
      verdict: "Non emergono forti segnali automatici di truffa.",
      advice: "Resta prudente: un punteggio basso non dimostra che il messaggio sia autentico, soprattutto se chiede dati o denaro."
    };
  }

  function renderResult(analysis) {
    const profile = riskProfile(analysis.score);
    result.hidden = false;
    result.className = `result result--${profile.tone}`;
    result.replaceChildren();

    const top = document.createElement("div");
    top.className = "result-top";
    const status = document.createElement("div");
    status.className = "risk-status";
    status.innerHTML = `<span class="risk-icon" aria-hidden="true">${profile.icon}</span><div><p class="result-label">Esito dell’analisi</p><h2>Rischio ${profile.level}</h2></div>`;
    const score = document.createElement("strong");
    score.className = "score";
    score.textContent = `${analysis.score}/100`;
    top.append(status, score);

    const meter = document.createElement("div");
    meter.className = "meter";
    meter.setAttribute("role", "progressbar");
    meter.setAttribute("aria-label", "Punteggio di rischio");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    meter.setAttribute("aria-valuenow", String(analysis.score));
    const meterFill = document.createElement("span");
    meterFill.style.width = `${analysis.score}%`;
    meter.append(meterFill);

    const verdict = document.createElement("p");
    verdict.className = "verdict";
    verdict.textContent = profile.verdict;

    const details = document.createElement("div");
    details.className = "details";
    const detailsTitle = document.createElement("h3");
    detailsTitle.textContent = analysis.findings.length ? "Segnali rilevati" : "Cosa è stato rilevato";
    const list = document.createElement("ul");
    if (analysis.findings.length) {
      analysis.findings.sort((a, b) => b.score - a.score).forEach((finding) => {
        const item = document.createElement("li");
        item.textContent = finding.reason;
        list.append(item);
      });
    } else {
      const item = document.createElement("li");
      item.textContent = "Nessun segnale tipico nel vocabolario attuale.";
      list.append(item);
    }
    details.append(detailsTitle, list);

    const recommendation = document.createElement("div");
    recommendation.className = "recommendation";
    const recommendationTitle = document.createElement("strong");
    recommendationTitle.textContent = "Cosa fare ora";
    const recommendationText = document.createElement("p");
    recommendationText.textContent = profile.advice;
    recommendation.append(recommendationTitle, recommendationText);

    const note = document.createElement("p");
    note.className = "result-note";
    note.textContent = "Valutazione automatica e indicativa: non è una certificazione di autenticità.";
    result.append(top, meter, verdict, details, recommendation, note);
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateCounter() {
    counter.textContent = `${input.value.length.toLocaleString("it-IT")} caratteri`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
      result.hidden = false;
      result.className = "result result--empty";
      result.textContent = "Incolla un messaggio da analizzare.";
      return;
    }
    input.removeAttribute("aria-invalid");
    renderResult(analyseText(input.value));
  });

  input.addEventListener("input", updateCounter);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") form.requestSubmit();
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    updateCounter();
    result.hidden = true;
    result.replaceChildren();
    input.removeAttribute("aria-invalid");
    input.focus();
  });
});
