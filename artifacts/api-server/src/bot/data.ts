import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const CHANNELS_FILE = path.join(DATA_DIR, "channels.json");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const PENDING_FILE = path.join(DATA_DIR, "pending.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USER_IDS_FILE = path.join(DATA_DIR, "user_ids.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(file: string, def: T): T {
  ensureDir();
  if (!fs.existsSync(file)) return def;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return def;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export interface Channel {
  id: string;
  username: string;
  title: string;
  addedAt: number;
}

export interface Job {
  id: string;
  phone: string;
  jobType: string;
  salary: string;
  district: string;
  ageMin: number;
  ageMax: number;
  description: string;
  postedBy: number;
  postedAt: number;
  approved: boolean;
  paid: boolean;
  receiptFile?: string;
}

export interface PendingJob {
  id: string;
  job: Job;
  receiptFile: string;
  submittedAt: number;
}

export interface UserSession {
  userId: number;
  step: string;
  data: Record<string, string | number>;
}

export function getChannels(): Channel[] {
  return readJson<Channel[]>(CHANNELS_FILE, []);
}

export function saveChannels(channels: Channel[]) {
  writeJson(CHANNELS_FILE, channels);
}

export function addChannel(channel: Channel) {
  const channels = getChannels();
  if (!channels.find((c) => c.username === channel.username)) {
    channels.push(channel);
    saveChannels(channels);
  }
}

export function removeChannel(username: string) {
  const channels = getChannels().filter((c) => c.username !== username);
  saveChannels(channels);
}

export function getJobs(): Job[] {
  return readJson<Job[]>(JOBS_FILE, []);
}

export function saveJobs(jobs: Job[]) {
  writeJson(JOBS_FILE, jobs);
}

export function addJob(job: Job) {
  const jobs = getJobs();
  jobs.push(job);
  saveJobs(jobs);
}

export function updateJob(id: string, updates: Partial<Job>) {
  const jobs = getJobs().map((j) => (j.id === id ? { ...j, ...updates } : j));
  saveJobs(jobs);
}

export function deleteJob(id: string) {
  saveJobs(getJobs().filter((j) => j.id !== id));
}

export function getJobById(id: string): Job | undefined {
  return getJobs().find((j) => j.id === id);
}

export function getUserJobs(userId: number): Job[] {
  return getJobs().filter((j) => j.postedBy === userId);
}

export function getPendingJobs(): PendingJob[] {
  return readJson<PendingJob[]>(PENDING_FILE, []);
}

export function savePendingJobs(pending: PendingJob[]) {
  writeJson(PENDING_FILE, pending);
}

export function addPendingJob(pending: PendingJob) {
  const all = getPendingJobs();
  all.push(pending);
  savePendingJobs(all);
}

export function removePendingJob(id: string) {
  savePendingJobs(getPendingJobs().filter((p) => p.id !== id));
}

export function getPendingById(id: string): PendingJob | undefined {
  return getPendingJobs().find((p) => p.id === id);
}

export function trackUser(userId: number) {
  const ids = readJson<number[]>(USER_IDS_FILE, []);
  if (!ids.includes(userId)) {
    ids.push(userId);
    writeJson(USER_IDS_FILE, ids);
  }
}

export function getAllUserIds(): number[] {
  return readJson<number[]>(USER_IDS_FILE, []);
}

export function getSessions(): Record<string, UserSession> {
  return readJson<Record<string, UserSession>>(USERS_FILE, {});
}

export function getSession(userId: number): UserSession | undefined {
  return getSessions()[String(userId)];
}

export function setSession(session: UserSession) {
  const all = getSessions();
  all[String(session.userId)] = session;
  writeJson(USERS_FILE, all);
}

export function clearSession(userId: number) {
  const all = getSessions();
  delete all[String(userId)];
  writeJson(USERS_FILE, all);
}
