import type { AuthorizationAuditEvent, DiscoverySuggestion, Entry, KnowledgeEntry, KnowledgeRelation, LearningMaterial, LearningProject, LearningSuggestion, LearningTask, Relation, Transition } from './domain';
import { defaultPrivacy, seedEntries, seedRelations } from './domain';

const LEGACY_KEY = 'infinity-v2-atlas';
const LEGACY_REVIEW_KEY = 'infinity-v2-hidden-reflections';
const DB_NAME = 'infinity-v2';
const DB_VERSION = 2;
const ATLAS_KEY = 'personal-atlas';
const REVIEW_KEY = 'hidden-reflections';

export interface Atlas {
  entries: Entry[];
  knowledge: KnowledgeEntry[];
  relations: Relation[];
  transitions: Transition[];
  learningProjects: LearningProject[];
  learningMaterials: LearningMaterial[];
  learningSuggestions: LearningSuggestion[];
  learningTasks: LearningTask[];
  knowledgeRelations: KnowledgeRelation[];
  discoverySuggestions: DiscoverySuggestion[];
  authorizationAudit: AuthorizationAuditEvent[];
}

function normalize(value: Partial<Atlas> | null | undefined): Atlas {
  return {
    entries: (value?.entries ?? seedEntries).map(entry => ({ ...entry, kind: entry.kind ?? 'daily', privacy: entry.privacy ? { aiVisible: entry.privacy.aiVisible !== false, shareGrants: entry.privacy.shareGrants ?? [] } : defaultPrivacy() })),
    knowledge: value?.knowledge ?? [],
    relations: value?.relations ?? seedRelations,
    transitions: value?.transitions ?? [],
    learningProjects: value?.learningProjects ?? [],
    learningMaterials: value?.learningMaterials ?? [],
    learningSuggestions: value?.learningSuggestions ?? [],
    learningTasks: value?.learningTasks ?? [],
    knowledgeRelations: value?.knowledgeRelations ?? [],
    discoverySuggestions: value?.discoverySuggestions ?? [],
    authorizationAudit: value?.authorizationAudit ?? []
  };
}

/** 仅作为从早期 V2 试玩版迁移的兜底，新的事实来源为 IndexedDB。 */
export function loadAtlas(): Atlas {
  try { return normalize(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as Partial<Atlas> | null); }
  catch { return normalize(null); }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('atlas')) db.createObjectStore('atlas');
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'));
  });
}
function read<T>(store: 'atlas' | 'preferences', key: string): Promise<T | undefined> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly'); const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined); request.onerror = () => reject(request.error);
  }));
}
function write(store: 'atlas' | 'preferences', key: string, value: unknown): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  }));
}

/** 首次进入时自动导入早期 localStorage 数据；之后永远优先读取 IndexedDB。 */
export async function hydrateAtlas(): Promise<Atlas> {
  const saved = await read<Atlas>('atlas', ATLAS_KEY);
  if (saved) return normalize(saved);
  const legacy = loadAtlas(); await write('atlas', ATLAS_KEY, legacy); return legacy;
}
export function saveAtlas(next: Atlas) {
  localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
  return write('atlas', ATLAS_KEY, next);
}
export async function hydrateHiddenReflections(): Promise<string[]> {
  const saved = await read<string[]>('preferences', REVIEW_KEY);
  if (Array.isArray(saved)) return saved;
  let legacy: string[] = []; try { legacy = JSON.parse(localStorage.getItem(LEGACY_REVIEW_KEY) ?? '[]'); } catch { /* ignore */ }
  await write('preferences', REVIEW_KEY, legacy); return legacy;
}
export function saveHiddenReflections(ids: string[]) {
  localStorage.setItem(LEGACY_REVIEW_KEY, JSON.stringify(ids));
  return write('preferences', REVIEW_KEY, ids);
}
