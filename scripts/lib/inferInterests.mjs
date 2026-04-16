/**
 * Map catalog text to ClassHop interest chips (1–3 tags), biased by title + description.
 */

const INTEREST_OPTIONS = [
  "Science",
  "Arts",
  "Philosophy",
  "Tech",
  "History",
  "Business",
  "Social Science",
  "Environment"
];

const SUBJECT_HINT = {
  COMPSCI: "Tech",
  DATA: "Tech",
  EECS: "Tech",
  ELENG: "Tech",
  ENGIN: "Tech",
  INDENG: "Tech",
  BIOENG: "Tech",
  MATH: "Science",
  STAT: "Science",
  PHYSICS: "Science",
  CHEM: "Science",
  MCELLBI: "Science",
  INTEGBI: "Science",
  PLANTBI: "Science",
  BIOLOGY: "Science",
  NEU: "Science",
  ASTRON: "Science",
  EPS: "Science",
  HISTORY: "History",
  PHILOS: "Philosophy",
  ECON: "Business",
  UGBA: "Business",
  SOCIOL: "Social Science",
  POLSCI: "Social Science",
  ANTHRO: "Social Science",
  PSYCH: "Social Science",
  ESPM: "Environment",
  ENVECON: "Environment",
  ENGLISH: "Arts",
  MUSIC: "Arts",
  THEATER: "Arts",
  ART: "Arts",
  CDSS: "Tech",
  INFO: "Tech",
  CYPLAN: "Environment",
  PUBPOL: "Social Science",
  GPP: "Social Science",
  PBHLTH: "Science",
  EDUC: "Social Science"
};

/** @type {Record<string, RegExp[]>} */
const SIGNALS = {
  Tech: [
    /\b(computer|computing|software|algorithm|programming|program)\b/i,
    /\b(machine learning|artificial intelligence|deep learning|neural network)\b/i,
    /\b(data science|data mining|big data|dataset|visualization dashboard)\b/i,
    /\b(data structure|database|cryptograph|cybersecurity|security protocol)\b/i,
    /\b(operating system|compiler|distributed system|network protocol|internet)\b/i,
    /\b(reinforcement learning|robotics|computer vision|natural language)\b/i,
    /\b(statistical learning|information retrieval|web application|API)\b/i,
    /\b(embedded system|blockchain|human-computer interaction|HCI)\b/i
  ],
  Science: [
    /\b(physics|chemistry|biology|molecular|cell biology|biochemistry)\b/i,
    /\b(calculus|differential equation|linear algebra|probability theory)\b/i,
    /\b(statistics|statistical method|hypothesis test|biostatistics)\b/i,
    /\b(astronom|laboratory|experiment|quantum|thermodynamic)\b/i,
    /\b(genetic|evolution|ecology|physiology|anatomy|neuroscience)\b/i,
    /\b(geolog|climate model|epidemiolog|immunolog|microbi)\b/i,
    /\b(mathematical proof|topology|number theory)\b/i,
    /\b(public health|epidemiology|nutrition science|clinical trial)\b/i
  ],
  History: [
    /\b(history|historical|medieval|renaissance|ancient world)\b/i,
    /\b(civilization|colonization|revolution|warfare|archive)\b/i,
    /\b(19th century|20th century|primary source|historiograph)\b/i
  ],
  Business: [
    /\b(economics|economic theory|microeconom|macroeconom)\b/i,
    /\b(finance|financial market|investment|accounting)\b/i,
    /\b(business strategy|management|entrepreneur|marketing)\b/i,
    /\b(pricing|auction|contract theory|game theory)\b/i
  ],
  Philosophy: [
    /\b(philosophy|philosophical|metaphysics|epistemology)\b/i,
    /\b(ethics|ethical theory|moral reasoning|existential)\b/i,
    /\b(logic\s|formal logic|argumentation)\b/i
  ],
  Arts: [
    /\b(literature|novel|poetry|fiction|creative writing)\b/i,
    /\b(music|composition|orchestra|theater|theatre|drama)\b/i,
    /\b(film|cinema|dance|visual art|painting|sculpture)\b/i,
    /\b(aesthetic|art history|performance)\b/i
  ],
  "Social Science": [
    /\b(psychology|psychological|sociology|anthropology)\b/i,
    /\b(political science|public policy|governance|democracy)\b/i,
    /\b(politic(al|s)\s|legislature|election|international relations)\b/i,
    /\b(social theory|inequality|race|gender|identity)\b/i,
    /\b(law\s|legal studies|jurisprudence)\b/i,
    /\b(education policy|learning science|pedagog)\b/i,
    /\b(criminal justice|demograph|survey method)\b/i
  ],
  Environment: [
    /\b(environmental|ecology|ecosystem|climate change|sustainability)\b/i,
    /\b(conservation|biodiversity|forestry|agriculture|soil)\b/i,
    /\b(renewable energy|pollution|natural resource)\b/i,
    /\b(land use|urban planning and environment)\b/i
  ]
};

function scoreSignals(hay) {
  /** @type {Record<string, number>} */
  const scores = {};
  for (const key of INTEREST_OPTIONS) scores[key] = 0;
  for (const [interest, patterns] of Object.entries(SIGNALS)) {
    for (const re of patterns) {
      if (re.test(hay)) scores[interest] += 1;
    }
  }
  return scores;
}

/**
 * @param {{ subject: string; title?: string; description?: string }} entry
 * @returns {string[]}
 */
export function inferInterestsFromCatalogEntry(entry) {
  const subject = (entry.subject || "").toUpperCase();
  const title = entry.title || "";
  const description = entry.description || "";
  const hay = `${title}\n${description}`.toLowerCase();

  const scores = scoreSignals(hay);

  const hint = SUBJECT_HINT[subject];
  if (hint && scores[hint] !== undefined) {
    scores[hint] += 2;
  }

  const ranked = [...INTEREST_OPTIONS].filter((k) => scores[k] > 0).sort((a, b) => scores[b] - scores[a]);

  if (ranked.length === 0) {
    if (hint && INTEREST_OPTIONS.includes(hint)) return [hint];
    return ["Science"];
  }

  const top = ranked.slice(0, 3);
  return top;
}
