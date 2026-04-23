import Link from "next/link";
import styles from "./page.module.css";

const CATEGORIES = [
  {
    name: "Science & Nature",
    covers: "Biology, chemistry, physics, astronomy, genetics, ecology, geology, neuroscience",
    examples: ["Molecular Biology", "Astrophysics", "Evolutionary Biology", "Organic Chemistry"]
  },
  {
    name: "Tech & Engineering",
    covers: "Computer science, electrical engineering, mechanical, civil, bioengineering, AI/ML",
    examples: ["Machine Learning", "Computer Architecture", "Robotics", "Circuits"]
  },
  {
    name: "Math & Data",
    covers: "Pure math, statistics, data science, probability, numerical methods",
    examples: ["Abstract Algebra", "Data Science", "Probability Theory", "Real Analysis"]
  },
  {
    name: "Arts & Design",
    covers: "Literature, music, film, theater, visual art, architecture, design, dance",
    examples: ["Film History", "Music Composition", "Studio Art", "Architecture Studio"]
  },
  {
    name: "History & Culture",
    covers: "World and US history, ancient civilizations, anthropology, cultural studies, religion",
    examples: ["Ancient Rome", "Modern China", "Cultural Anthropology", "Diaspora Studies"]
  },
  {
    name: "Society & Politics",
    covers: "Political science, sociology, psychology, law, philosophy, ethics, policy, media",
    examples: ["Constitutional Law", "Social Movements", "Ethics", "International Relations"]
  },
  {
    name: "Business & Economics",
    covers: "Micro/macroeconomics, finance, accounting, entrepreneurship, marketing, strategy",
    examples: ["Game Theory", "Corporate Finance", "Entrepreneurship", "Labor Economics"]
  },
  {
    name: "Health & Environment",
    covers: "Public health, nutrition, climate, sustainability, ecology, urban planning, wellness",
    examples: ["Public Health", "Climate Change Policy", "Urban Planning", "Nutrition"]
  }
];

export default function CategoriesPage() {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <text x="2" y="13" fontFamily="Georgia" fontSize="12" fontWeight="bold" fill="#FDB515">CH</text>
            </svg>
          </div>
          <span className={styles.logoWordmark}>ClassHop</span>
        </Link>
        <Link href="/" className={styles.backLink}>← Back to discover</Link>
      </nav>

      <main className={styles.main}>
        <p className={styles.eyebrow}>Interest categories</p>
        <h1 className={styles.title}>What are you curious about?</h1>
        <p className={styles.subtitle}>Eight buckets. Thousands of classes.</p>
        <p className={styles.desc}>
          Each interest tag maps to a cluster of related departments and topics at Berkeley.
          Use them on the discover page to narrow your search — or leave them blank to see everything happening right now.
        </p>

        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Covers</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => (
              <tr key={cat.name}>
                <td>{cat.name}</td>
                <td className={styles.covers}>
                  {cat.covers}
                  <div className={styles.exampleList}>
                    {cat.examples.map((ex) => (
                      <span key={ex} className={styles.examplePill}>{ex}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerNote}>ClassHop · UC Berkeley</span>
        <span className={styles.footerNote}>Tags are inferred — some courses may span multiple categories.</span>
      </footer>
    </div>
  );
}
