document.getElementById("analizza").addEventListener("click", analizza);

const paroleUrgenti = [
  "urgente", "attenzione", "immediato", "subito",
  "bloccato", "sospeso", "limitato", "scade"
];

const paroleLink = [
  "clicca", "link", "accedi", "verifica", "conferma"
];

const datiSensibili = [
  "iban", "password", "codice", "otp",
  "pin", "pagamento", "credito", "debito"
];

const entiFinti = [
  "poste", "inps", "banca", "paypal",
  "amazon", "spid", "intesa", "unicredit",
  "corriere", "dhl", "ups", "gls"
];

const paroleNormali = [
    "ciao", "ok", "grazie", "domani", "stasera", "alle", "appuntamento", "fammi sapere", "👍", "😂", "🤣"
];


function analizza() {
  let testo = document.getElementById("sms").value.toLowerCase();
  let rischio = 0;
  let motivi = [];

  paroleNormali.forEach(parola => {
    if (testo.includes(parola)) {
        rischio -= 5;
    }
  });
  
  if (rischio < 0) rischio = 0;



  paroleUrgenti.forEach(parola => {
    if (testo.includes(parola)) {
      rischio += 10;
      motivi.push(`Uso di linguaggio urgente (“${parola}”)`);
    }
  });

  paroleLink.forEach(parola => {
    if (testo.includes(parola)) {
      rischio += 15;
      motivi.push(`Invito ad agire (“${parola}”)`);
    }
  });

  datiSensibili.forEach(parola => {
    if (testo.includes(parola)) {
      rischio += 25;
      motivi.push(`Richiesta di dati sensibili (“${parola}”)`);
    }
  });

  entiFinti.forEach(ente => {
    if (testo.includes(ente)) {
      rischio += 20;
      motivi.push(`Possibile ente imitato (“${ente}”)`);
    }
  });

  if (testo.includes("http")) {
    rischio += 25;
    motivi.push("Presenza di un link nel messaggio");
  }

  if (rischio > 100) rischio = 100;

  let colore = rischio < 31 ? "green" : rischio < 61 ? "orange" : "red";

  let giudizio =
    rischio < 31
      ? "🟢 Il messaggio sembra tranquillo."
      : rischio < 61
      ? "🟠 Il messaggio presenta elementi sospetti."
      : "🔴 Questo messaggio ha un alto rischio di truffa.";

  document.getElementById("risultato").innerHTML = `
    <h3 style="color:${colore}">
      Rischio truffa: ${rischio}%
    </h3>
    <p>${giudizio}</p>
    <p><strong>Motivi rilevati:</strong><br>
      ${motivi.length ? motivi.join("<br>") : "Nessun segnale evidente"}
    </p>
    <p><strong>Consiglio:</strong><br>
      Nessun ente ufficiale chiede dati personali, codici o pagamenti via SMS.
    </p>
  `;
}