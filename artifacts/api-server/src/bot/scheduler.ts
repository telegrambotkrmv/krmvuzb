import { getJobs, saveJobs, getPendingJobs, savePendingJobs } from "./data.js";
import { logger } from "../lib/logger.js";

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // har soatda bir tekshir

function deleteExpiredJobs() {
  const now = Date.now();
  const jobs = getJobs();
  const before = jobs.length;
  const active = jobs.filter((j) => now - j.postedAt < TEN_DAYS_MS);
  if (active.length < before) {
    saveJobs(active);
    logger.info({ removed: before - active.length }, "Expired jobs removed (10 days)");
  }
}

function deleteExpiredPending() {
  const now = Date.now();
  const pending = getPendingJobs();
  const before = pending.length;
  const active = pending.filter((p) => now - p.submittedAt < TEN_DAYS_MS);
  if (active.length < before) {
    savePendingJobs(active);
    logger.info({ removed: before - active.length }, "Expired pending jobs removed");
  }
}

export function startScheduler() {
  deleteExpiredJobs();
  deleteExpiredPending();

  setInterval(() => {
    deleteExpiredJobs();
    deleteExpiredPending();
  }, CHECK_INTERVAL_MS);

  logger.info("Job scheduler started (10-day auto-delete)");
}
