import schema from './schema.json';
import { normalizeTitle, validateDue, type Todo, type TodoInput, type SourceType } from '../domain/todo';
import { resemblesEvidence, type SimilarCapture } from '../domain/duplicate';

export type SqlValue = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}
export interface Database extends SqlConnection {
  withExclusiveTransactionAsync(task: (tx: SqlConnection) => Promise<void>): Promise<void>;
}
export interface Analysis {
  id: string; image_fingerprint: string; captured_at: string | null; received_at: string;
  status: 'queued' | 'processing' | 'review' | 'saved' | 'ignored' | 'failed' | 'empty';
  source_channel: 'shortcuts' | 'share' | 'manual'; model_version: string | null;
  error_code: string | null; expires_at: string;
  processing_token: string | null;
}
export interface ExtractedTask {
  id: string; analysis_id: string; title: string; description: string | null;
  due_at: string | null; due_precision: Todo['due_precision']; assignee: string | null;
  confidence: number; evidence_text: string; needs_confirmation: number;
  review_status: 'pending' | 'saved' | 'ignored'; linked_todo_id: string | null;
}
export class Repository {
  constructor(private db: Database, private uuid: () => string, private now = () => new Date().toISOString()) {}
  async initialize() {
    await this.db.execAsync('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON; PRAGMA temp_store=MEMORY;');
    await this.db.withExclusiveTransactionAsync(async tx => {
      const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) > schema.version) throw new Error('새로운 앱 버전으로 데이터가 저장되었어요. 앱을 업데이트해 주세요.');
      if (version?.user_version === 1) {
        await tx.execAsync(schema.migration_from_1_before);
        await tx.execAsync(schema.sql);
        await tx.execAsync(schema.migration_from_1_after);
      } else if (version?.user_version === 2) await tx.execAsync(schema.migration_from_2);
      else if ((version?.user_version ?? 0) < schema.version) await tx.execAsync(schema.sql);
    });
    await this.pruneEvidence();
  }
  listTodos() { return this.db.getAllAsync<Todo>('SELECT * FROM todos'); }
  async addTodo(input: TodoInput, source: SourceType = 'manual', sourceId: string | null = null): Promise<string> {
    const title = normalizeTitle(input.title);
    const due = input.due_at ?? null;
    const precision = input.due_precision ?? 'unknown';
    validateDue(due, precision);
    const id = this.uuid();
    const time = this.now();
    await this.db.runAsync('INSERT INTO todos (id,title,description,due_at,due_precision,created_at,updated_at,source_type,source_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
      id, title, input.description?.trim() || null, due, precision, time, time, source, sourceId, Date.parse(time));
    return id;
  }
  async updateTodo(id: string, input: TodoInput) {
    const due = input.due_at ?? null;
    const precision = input.due_precision ?? 'unknown';
    validateDue(due, precision);
    await this.db.runAsync('UPDATE todos SET title=?,description=?,due_at=?,due_precision=?,updated_at=? WHERE id=?',
      normalizeTitle(input.title), input.description?.trim() || null, due, precision, this.now(), id);
  }
  setCompleted(id: string, complete: boolean) {
    const time = this.now();
    return this.db.runAsync('UPDATE todos SET status=?,completed_at=?,updated_at=? WHERE id=?', complete ? 'completed' : 'pending', complete ? time : null, time, id);
  }
  async removeTodo(id: string) {
    let analyses: string[] = [];
    await this.db.withExclusiveTransactionAsync(async tx => {
      analyses = (await tx.getAllAsync<{ analysis_id: string }>('SELECT DISTINCT analysis_id FROM extracted_tasks WHERE linked_todo_id=? OR id=(SELECT source_id FROM todos WHERE id=?)', id, id)).map(row => row.analysis_id);
      // Keep the saved marker and image fingerprint so a cached approval cannot
      // recreate the task. Remove both original and edited proposal content.
      await tx.runAsync("UPDATE extracted_tasks SET title='삭제한 할 일',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,evidence_text='',confidence=0,needs_confirmation=1,linked_todo_id=NULL WHERE linked_todo_id=? OR id=(SELECT source_id FROM todos WHERE id=?)", id, id);
      await tx.runAsync('DELETE FROM todos WHERE id=?', id);
    });
    return analyses;
  }
  async listAnalyses() {
    let rows: Analysis[] = [];
    await this.db.withExclusiveTransactionAsync(async tx => {
      await this.pruneEvidenceInTransaction(tx, this.now());
      rows = await tx.getAllAsync<Analysis>('SELECT * FROM analyses ORDER BY received_at DESC');
    });
    return rows;
  }
  async listExtracted(id: string) {
    let rows: ExtractedTask[] = [];
    await this.db.withExclusiveTransactionAsync(async tx => {
      await this.pruneEvidenceInTransaction(tx, this.now());
      rows = await tx.getAllAsync<ExtractedTask>('SELECT * FROM extracted_tasks WHERE analysis_id=? ORDER BY rowid', id);
    });
    return rows.map(task => {
      const assignee = task.assignee?.trim() || null;
      return { ...task, assignee, needs_confirmation: task.needs_confirmation || !assignee ? 1 : 0 };
    });
  }
  async findSimilarAnalyses(id: string, source: string): Promise<SimilarCapture[]> {
    const rows = await this.db.getAllAsync<{ analysis_id: string; title: string; evidence_text: string; review_status: string; received_at: string; expires_at: string }>("SELECT e.analysis_id,e.title,e.evidence_text,e.review_status,a.received_at,a.expires_at FROM extracted_tasks e JOIN analyses a ON a.id=e.analysis_id WHERE a.id<>? AND e.review_status IN ('pending','saved') AND e.evidence_text<>'' ORDER BY a.received_at DESC,e.rowid DESC LIMIT 200", id);
    const now = Date.parse(this.now()), matches: SimilarCapture[] = [];
    for (const row of rows) {
      const age = now - Date.parse(row.received_at);
      if (!(age >= 0 && age <= 7 * 86400000 && Date.parse(row.expires_at) > now) || matches.some(m => m.analysis_id === row.analysis_id)) continue;
      if (resemblesEvidence(source, row.evidence_text)) matches.push({ analysis_id: row.analysis_id, title: row.title, received_at: row.received_at, saved: row.review_status === 'saved' });
      if (matches.length === 3) break;
    }
    return matches;
  }
  async createAnalysis(fingerprint: string, source: Analysis['source_channel'], capturedAt: string | null): Promise<{ id: string; created: boolean; token: string | null }> {
    const id = this.uuid();
    const token = this.uuid();
    let result: { id: string; created: boolean; token: string | null } = { id, created: false, token: null };
    const time = this.now();
    await this.db.withExclusiveTransactionAsync(async tx => {
      const existing = await tx.getFirstAsync<{ id: string }>('SELECT id FROM analyses WHERE image_fingerprint=?', fingerprint);
      if (existing) { result = { id: existing.id, created: false, token: null }; return; }
      await tx.runAsync('INSERT INTO analyses (id,image_fingerprint,captured_at,received_at,status,source_channel,expires_at,processing_token) VALUES (?,?,?,?,?,?,?,?)',
        id, fingerprint, capturedAt, time, 'processing', source, new Date(Date.parse(time) + 7 * 86400000).toISOString(), token);
      result = { id, created: true, token };
    });
    return result;
  }
  failAnalysis(id: string, code: string, token: string) {
    return this.db.runAsync("UPDATE analyses SET status='failed',error_code=?,processing_token=NULL WHERE id=? AND processing_token=? AND status IN ('processing','queued')", code, id, token);
  }
  retryFailedAnalysis(id: string) { return this.restartUnstoredAnalysis(id, true); }
  async restartUnstoredAnalysis(id: string, failedOnly = false): Promise<string> {
    const time = this.now();
    const token = this.uuid();
    await this.db.withExclusiveTransactionAsync(async tx => {
      const analysis = await tx.getFirstAsync<Analysis>('SELECT * FROM analyses WHERE id=?', id);
      const saved = await tx.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM extracted_tasks WHERE analysis_id=? AND review_status='saved'", id);
      if (analysis?.status === 'saved' || saved?.count) throw new Error('한 번이라도 할 일을 저장한 캡처는 다시 분석하지 않아요. 저장한 할 일은 목록에서 직접 수정해 주세요.');
      if (!analysis || !(failedOnly ? ['failed'] : ['failed', 'review', 'empty', 'ignored']).includes(analysis.status)) throw new Error('이미 분석 중이거나 상태가 변경되었어요. 분석함을 확인해 주세요.');
      const consent = await tx.getFirstAsync<{ value: string }>("SELECT value FROM preferences WHERE key='ai_local_consent'");
      if (consent?.value !== 'yes') throw new Error('먼저 기기 내 AI 분석에 동의해 주세요.');
      await tx.runAsync('DELETE FROM extracted_tasks WHERE analysis_id=?', id);
      await tx.runAsync("UPDATE analyses SET status='processing',model_version=NULL,error_code=NULL,received_at=?,expires_at=?,processing_token=? WHERE id=?", time, new Date(Date.parse(time) + 7 * 86400000).toISOString(), token, id);
    });
    return token;
  }
  async finishAnalysis(id: string, tasks: Omit<ExtractedTask, 'id' | 'analysis_id' | 'review_status' | 'linked_todo_id'>[], model: string, token: string) {
    await this.db.withExclusiveTransactionAsync(async tx => {
      const consent = await tx.getFirstAsync<{ value: string }>("SELECT value FROM preferences WHERE key='ai_local_consent'");
      if (consent?.value !== 'yes') throw new Error('기기 내 AI 분석 동의가 변경되었어요. 설정을 확인해 주세요.');
      const analysis = await tx.getFirstAsync<Analysis>('SELECT * FROM analyses WHERE id=?', id);
      if (!analysis || analysis.status !== 'processing' || analysis.processing_token !== token) throw new Error('분석 상태가 변경되었어요. 다시 확인해 주세요.');
      for (const task of tasks) {
        validateDue(task.due_at, task.due_precision);
        await tx.runAsync('INSERT INTO extracted_tasks (id,analysis_id,title,description,due_at,due_precision,assignee,confidence,evidence_text,needs_confirmation) VALUES (?,?,?,?,?,?,?,?,?,?)',
          this.uuid(), id, normalizeTitle(task.title), task.description, task.due_at, task.due_precision, task.assignee, task.confidence, task.evidence_text, task.needs_confirmation);
      }
      await tx.runAsync('UPDATE analyses SET status=?,model_version=?,error_code=NULL,processing_token=NULL WHERE id=?', tasks.length ? 'review' : 'empty', model, id);
    });
  }
  async approve(id: string, edits: { id: string; input: TodoInput }[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async tx => {
      const analysis = await tx.getFirstAsync<Analysis>('SELECT * FROM analyses WHERE id=?', id);
      if (!analysis || !['review', 'saved'].includes(analysis.status)) throw new Error('저장할 수 없는 분석 결과예요.');
      if (!(Date.parse(analysis.expires_at) > Date.parse(this.now()))) throw new Error('보존 기간이 지난 분석 결과예요. 이미지를 다시 선택해 주세요.');
      for (const edit of edits) {
        const task = await tx.getFirstAsync<ExtractedTask>('SELECT * FROM extracted_tasks WHERE id=? AND analysis_id=?', edit.id, id);
        if (!task) throw new Error('분석 항목을 찾을 수 없어요.');
        if (task.review_status !== 'pending') continue;
        const todoId = this.uuid();
        const time = this.now();
        const due = edit.input.due_at ?? null;
        const precision = edit.input.due_precision ?? 'unknown';
        validateDue(due, precision);
        const title = normalizeTitle(edit.input.title);
        await tx.runAsync('INSERT INTO todos (id,title,description,due_at,due_precision,created_at,updated_at,source_type,source_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
          todoId, title, edit.input.description?.trim() || null, due, precision, time, time, analysis.source_channel === 'share' ? 'share' : 'screenshot', task.id, Date.parse(time));
        await tx.runAsync("UPDATE extracted_tasks SET review_status='saved',linked_todo_id=?,title=?,description=?,due_at=?,due_precision=? WHERE id=?", todoId, title, edit.input.description?.trim() || null, due, precision, task.id);
      }
      const pending = await tx.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM extracted_tasks WHERE analysis_id=? AND review_status='pending'", id);
      await tx.runAsync('UPDATE analyses SET status=? WHERE id=?', pending?.count ? 'review' : 'saved', id);
    });
  }
  async ignoreAnalysis(id: string, expectedTaskIds?: string[]) {
    await this.db.withExclusiveTransactionAsync(async tx => {
      if (expectedTaskIds) {
        const current = await tx.getAllAsync<{ id: string }>("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='pending'", id);
        if (JSON.stringify(current.map(t => t.id).sort()) !== JSON.stringify([...expectedTaskIds].sort())) throw new Error('분석 제안이 변경되었어요. 분석함에서 다시 확인해 주세요.');
      }
      await tx.runAsync("UPDATE extracted_tasks SET review_status='ignored',title='무시한 제안',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,evidence_text='',confidence=0 WHERE analysis_id=? AND review_status='pending'", id);
      await tx.runAsync("UPDATE analyses SET status=CASE WHEN EXISTS(SELECT 1 FROM extracted_tasks WHERE analysis_id=? AND review_status='saved') THEN 'saved' ELSE 'ignored' END WHERE id=?", id, id);
    });
  }
  async getPreference(key: string): Promise<string | null> {
    return (await this.db.getFirstAsync<{ value: string }>('SELECT value FROM preferences WHERE key=?', key))?.value ?? null;
  }
  setPreference(key: string, value: string) { return this.db.runAsync('INSERT INTO preferences(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value); }
  async setLockVisibility(value: 'titles' | 'count' | 'hidden') {
    if (!['titles', 'count', 'hidden'].includes(value)) throw new Error('잠금화면 표시 설정을 확인해 주세요.');
    await this.db.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync("INSERT INTO preferences(key,value) VALUES('private_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", value === 'titles' ? 'no' : 'yes');
      await tx.runAsync("INSERT INTO preferences(key,value) VALUES('hide_lock_content',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", value === 'hidden' ? 'yes' : 'no');
    });
  }
  async pruneEvidence() {
    await this.db.withExclusiveTransactionAsync(tx => this.pruneEvidenceInTransaction(tx, this.now()));
  }
  private async pruneEvidenceInTransaction(tx: SqlConnection, time: string) {
    // Apply the user's deletion policy to saved proposals orphaned by older versions.
    await tx.runAsync("UPDATE extracted_tasks SET title='삭제한 할 일',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,evidence_text='',confidence=0,needs_confirmation=1 WHERE review_status='saved' AND linked_todo_id IS NULL AND (title<>'삭제한 할 일' OR description IS NOT NULL OR due_at IS NOT NULL OR assignee IS NOT NULL OR evidence_text<>'')");
    // Opening the app must not cancel a live App Intent process using the same DB.
    // Only recover abandoned work after a grace period; never recreate its image implicitly.
    await tx.runAsync("UPDATE analyses SET status='failed',error_code='INTERRUPTED',processing_token=NULL WHERE status IN ('queued','processing') AND received_at<?", new Date(Date.parse(time) - 10 * 60000).toISOString());
    await tx.runAsync("UPDATE extracted_tasks SET title='보존 기간이 지난 제안',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,review_status='ignored',confidence=0 WHERE review_status='pending' AND analysis_id IN (SELECT id FROM analyses WHERE expires_at <= ?)", time);
    await tx.runAsync("UPDATE extracted_tasks SET evidence_text='' WHERE analysis_id IN (SELECT id FROM analyses WHERE expires_at <= ?)", time);
    await tx.runAsync("UPDATE analyses SET status=CASE WHEN EXISTS(SELECT 1 FROM extracted_tasks WHERE analysis_id=analyses.id AND review_status='saved') THEN 'saved' ELSE 'ignored' END WHERE status='review' AND expires_at<=?", time);
  }
  async revokeLocalAIConsent() {
    await this.db.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync("INSERT INTO preferences(key,value) VALUES('ai_local_consent','no') ON CONFLICT(key) DO UPDATE SET value='no'");
      await tx.runAsync("UPDATE extracted_tasks SET evidence_text=''");
    });
  }
  async exportData() {
    let result: object = {};
    await this.db.withExclusiveTransactionAsync(async tx => {
      const time = this.now();
      // Cleanup and snapshot share one transaction: never export pre-cleanup content.
      await this.pruneEvidenceInTransaction(tx, time);
      result = { format_version: 1, exported_at: time, todos: await tx.getAllAsync('SELECT * FROM todos'), analyses: await tx.getAllAsync('SELECT * FROM analyses'), extracted_tasks: await tx.getAllAsync('SELECT * FROM extracted_tasks') };
    });
    return JSON.stringify(result, null, 2);
  }
  async deleteAll() {
    await this.db.withExclusiveTransactionAsync(async tx => { await tx.execAsync('DELETE FROM extracted_tasks; DELETE FROM analyses; DELETE FROM todos; DELETE FROM preferences;'); });
    // Rows are already committed with secure_delete enabled. Space reclamation
    // can be blocked by another process; it must not prevent OS/cache cleanup.
    try { await this.db.execAsync('VACUUM;'); return { compacted: true }; }
    catch { return { compacted: false }; }
  }
}
