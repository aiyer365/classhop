/**
 * Map catalog text to ClassHop interest chips (1–3 tags), biased by title + description.
 */

const INTEREST_OPTIONS = [
  "Science & Nature",
  "Tech & Engineering",
  "Math & Data",
  "Arts & Design",
  "History & Culture",
  "Society & Politics",
  "Business & Economics",
  "Health & Environment"
];

/** Strong subject-code priors — bump score by 3 so it dominates weak text signals. */
const SUBJECT_HINT = {
  // Tech & Engineering
  COMPSCI: "Tech & Engineering",
  EECS: "Tech & Engineering",
  ELENG: "Tech & Engineering",
  ENGIN: "Tech & Engineering",
  INDENG: "Tech & Engineering",
  BIOENG: "Tech & Engineering",
  ME: "Tech & Engineering",
  CE: "Tech & Engineering",
  AEROENG: "Tech & Engineering",
  INFO: "Tech & Engineering",
  // Math & Data
  MATH: "Math & Data",
  STAT: "Math & Data",
  DATA: "Math & Data",
  CDSS: "Math & Data",
  // Science & Nature
  PHYSICS: "Science & Nature",
  CHEM: "Science & Nature",
  MCELLBI: "Science & Nature",
  INTEGBI: "Science & Nature",
  PLANTBI: "Science & Nature",
  BIOLOGY: "Science & Nature",
  NEU: "Science & Nature",
  ASTRON: "Science & Nature",
  EPS: "Science & Nature",
  // Arts & Design
  ENGLISH: "Arts & Design",
  MUSIC: "Arts & Design",
  THEATER: "Arts & Design",
  TDPS: "Arts & Design",
  ART: "Arts & Design",
  ARCH: "Arts & Design",
  FILM: "Arts & Design",
  // History & Culture
  HISTORY: "History & Culture",
  ANTHRO: "History & Culture",
  ETHSTD: "History & Culture",
  AFRICAM: "History & Culture",
  SASIAN: "History & Culture",
  MELC: "History & Culture",
  // Society & Politics
  PHILOS: "Society & Politics",
  SOCIOL: "Society & Politics",
  POLSCI: "Society & Politics",
  PSYCH: "Society & Politics",
  PUBPOL: "Society & Politics",
  GPP: "Society & Politics",
  EDUC: "Society & Politics",
  LEGALST: "Society & Politics",
  COGSCI: "Society & Politics",
  // Business & Economics
  ECON: "Business & Economics",
  UGBA: "Business & Economics",
  // Health & Environment
  PBHLTH: "Health & Environment",
  NUT: "Health & Environment",
  ESPM: "Health & Environment",
  ENVECON: "Health & Environment",
  CYPLAN: "Health & Environment",
  GEOG: "Health & Environment"
};

/** @type {Record<string, RegExp[]>} */
const SIGNALS = {
  "Tech & Engineering": [
    /\b(computer science|computing|software engineering|algorithm|programming)\b/i,
    /\b(machine learning|artificial intelligence|deep learning|neural network)\b/i,
    /\b(data structure|database|cryptograph|cybersecurity|operating system)\b/i,
    /\b(compiler|distributed system|network protocol|computer architecture)\b/i,
    /\b(reinforcement learning|robotics|computer vision|natural language processing)\b/i,
    /\b(circuit|signal processing|semiconductor|microprocessor|VLSI)\b/i,
    /\b(embedded system|human-computer interaction|HCI|web application)\b/i,
    /\b(mechanical engineering|civil engineering|aerospace|structural analysis)\b/i,
    /\b(thermodynamics|fluid dynamics|manufacturing|control system)\b/i
  ],
  "Math & Data": [
    /\b(calculus|differential equation|linear algebra|abstract algebra)\b/i,
    /\b(probability theory|stochastic|combinatorics|number theory|topology)\b/i,
    /\b(mathematical proof|real analysis|complex analysis|discrete math)\b/i,
    /\b(statistics|statistical method|hypothesis test|regression|inference)\b/i,
    /\b(data science|data analysis|data mining|machine learning)\b/i,
    /\b(optimization|numerical method|mathematical modeling|statistical simulation|computational modeling)\b/i
  ],
  "Science & Nature": [
    /\b(biology|molecular biology|cell biology|biochemistry|genetics)\b/i,
    /\b(physics|quantum mechanics|relativity|electromagnetism|optics)\b/i,
    /\b(chemistry|organic chemistry|inorganic|chemical reaction)\b/i,
    /\b(astronomy|astrophysics|cosmology|planetary science)\b/i,
    /\b(evolution|ecology|physiology|anatomy|neuroscience|microbiology)\b/i,
    /\b(geology|geophysics|atmospheric science|oceanography|climate)\b/i,
    /\b(laboratory|experiment|scientific method|empirical research|empirical study)\b/i,
    /\b(immunology|virology|epidemiology|pharmacology)\b/i
  ],
  "Arts & Design": [
    /\b(literature|novel|poetry|fiction|creative writing|prose)\b/i,
    /\b(music|composition|orchestra|chamber music|musicology)\b/i,
    /\b(theater|theatre|drama|acting|playwriting|performance)\b/i,
    /\b(film|cinema|documentary|screenwriting|cinematography)\b/i,
    /\b(visual art|painting|sculpture|drawing|printmaking|photography)\b/i,
    /\b(architecture|architectural design|urban design|landscape architecture|landscape design)\b/i,
    /\b(graphic design|typography|illustration|studio art)\b/i,
    /\b(dance|choreography|art history|aesthetic|criticism)\b/i
  ],
  "History & Culture": [
    /\b(history|historical|historiography|primary source|archive)\b/i,
    /\b(ancient|medieval|renaissance|early modern|19th century|20th century)\b/i,
    /\b(civilization|empire|colonialism|colonization|decolonization)\b/i,
    /\b(revolution|warfare|diplomacy|political history)\b/i,
    /\b(anthropology|ethnography|cultural studies|cross-cultural)\b/i,
    /\b(diaspora|migration|indigenous|heritage|tradition)\b/i,
    /\b(religion|mythology|ritual|sacred|secular)\b/i
  ],
  "Society & Politics": [
    /\b(political science|politics|governance|democracy|election|political economy)\b/i,
    /\b(public policy|policy analysis|legislation|government regulation|regulatory policy|social policy)\b/i,
    /\b(sociology|social theory|social movement|inequality|social structure|social stratification)\b/i,
    /\b(race|racism|racial equity|gender studies|sexuality|gender identity|social identity|intersectionality|racial justice)\b/i,
    /\b(psychology|cognitive psychology|behavioral science|social behavior|mental health|human behavior)\b/i,
    /\b(legal system|legal studies|jurisprudence|constitutional law|criminal justice|rule of law|case law|legal theory|international law)\b/i,
    /\b(philosophy|moral philosophy|applied ethics|research ethics|bioethics|political philosophy|epistemology|metaphysics|philosophical logic)\b/i,
    /\b(international relations|globalization|diplomacy|foreign policy|geopolitics|political theory)\b/i,
    /\b(education policy|pedagogy|curriculum studies|higher education|public education)\b/i,
    /\b(journalism|mass media|news media|social media|rhetoric|public discourse|science communication|political communication)\b/i
  ],
  "Business & Economics": [
    /\b(economics|economic theory|microeconomics|macroeconomics)\b/i,
    /\b(finance|financial market|investment|portfolio|asset pricing)\b/i,
    /\b(accounting|financial statement|auditing|taxation)\b/i,
    /\b(business strategy|management|organizational|leadership)\b/i,
    /\b(entrepreneurship|startup|venture capital|innovation)\b/i,
    /\b(marketing|consumer behavior|brand|supply chain|operations)\b/i,
    /\b(game theory|mechanism design|auction|contract theory)\b/i,
    /\b(labor economics|industrial organization|development economics)\b/i
  ],
  "Health & Environment": [
    /\b(public health|global health|epidemiology|biostatistics)\b/i,
    /\b(nutrition|diet|food system|health policy|health care)\b/i,
    /\b(environmental|ecosystem|climate change|global warming)\b/i,
    /\b(sustainability|renewable energy|conservation|biodiversity)\b/i,
    /\b(pollution|toxicology|waste|water quality|air quality)\b/i,
    /\b(urban planning|land use|transportation|infrastructure)\b/i,
    /\b(natural resource|forestry|agriculture|soil science)\b/i,
    /\b(mental health|wellbeing|stress|community health)\b/i
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
  const hay = `${title}\n${description}`;

  const scores = scoreSignals(hay);

  const hint = SUBJECT_HINT[subject];
  if (hint && scores[hint] !== undefined) {
    scores[hint] += 3;
  }

  const ranked = [...INTEREST_OPTIONS]
    .filter((k) => scores[k] > 0)
    .sort((a, b) => scores[b] - scores[a]);

  if (ranked.length === 0) {
    if (hint && INTEREST_OPTIONS.includes(hint)) return [hint];
    return ["Science & Nature"];
  }

  return ranked.slice(0, 3);
}
