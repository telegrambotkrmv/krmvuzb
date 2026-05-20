import { Job } from "./data.js";

const TOSHKENT_DISTRICTS = [
  "yunusobod", "chilonzor", "mirzo ulug'bek", "shayxontohur",
  "yakkasaroy", "uchtepa", "sergeli", "olmazar",
  "bektemir", "yashnobod", "mirobod", "hamza",
  "toshkent",
];

export function parseQuery(text: string): { district: string | null; keyword: string } {
  const lower = text.toLowerCase().trim();
  let district: string | null = null;
  let keyword = lower;

  for (const d of TOSHKENT_DISTRICTS) {
    if (lower.startsWith(d + " ") || lower.endsWith(" " + d) || lower === d) {
      district = d;
      keyword = lower.replace(d, "").trim();
      break;
    }
  }

  return { district, keyword };
}

export function searchJobs(
  jobs: Job[],
  query: string,
  maxResults = 30
): Job[] {
  const { district, keyword } = parseQuery(query);
  const approvedJobs = jobs.filter((j) => j.approved && j.paid);

  const scored: { job: Job; score: number }[] = [];
  const seen = new Set<string>();

  for (const job of approvedJobs) {
    const jobText = `${job.jobType} ${job.description} ${job.district}`.toLowerCase();
    const jobDistrict = job.district.toLowerCase();

    let score = 0;

    if (district && jobDistrict.includes(district)) score += 10;
    if (keyword && jobText.includes(keyword)) score += 5;

    const keyWords = keyword.split(/\s+/).filter(Boolean);
    for (const kw of keyWords) {
      if (jobText.includes(kw)) score += 2;
    }

    if (score > 0) {
      const dedupKey = `${job.postedBy}_${job.jobType}_${job.district}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        scored.push({ job, score });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((s) => s.job);
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatJob(job: Job): string {
  return (
    `📌 <b>${esc(job.jobType)}</b>\n` +
    `📍 Tuman: ${esc(job.district)}\n` +
    `💰 Oylik: ${esc(job.salary)}\n` +
    `👤 Yosh: ${job.ageMin}–${job.ageMax}\n` +
    `📞 Telefon: ${esc(job.phone)}\n` +
    (job.description ? `📝 ${esc(job.description)}\n` : "")
  );
}
