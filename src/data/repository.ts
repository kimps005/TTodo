import schema from './schema.json';
import { normalizeTitle, validateDue, type Todo, type TodoInput, type SourceType } from '../domain/todo';

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
  removeTodo(id: string) { return this.db.runAsync('DELETE FROM todos WHERE id=?', id); }
  listAnalyses() { return this.db.getAllAsync<Analysis>('SELECT * FROM analyses ORDER BY received_at DESC'); }
  listExtracted(id: string) { return this.db.getAllAsync<ExtractedTask>('SELECT * FROM extracted_tasks WHERE analysis_id=? ORDER BY rowid', id); }
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
  async retryFailedAnalysis(id: string): Promise<string> {
    const time = this.now();
    const token = this.uuid();
    await this.db.withExclusiveTransactionAsync(async tx => {
      const analysis = await tx.getFirstAsync<Analysis>('SELECT * FROM analyses WHERE id=?', id);
      if (analysis?.status !== 'failed') throw new Error('이미 분석 중이거나 처리된 이미지예요. 분석함을 확인해 주세요.');
      await tx.runAsync("UPDATE analyses SET status='processing',error_code=NULL,received_at=?,expires_at=?,processing_token=? WHERE id=?", time, new Date(Date.parse(time) + 7 * 86400000).toISOString(), token, id);
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
  async ignoreAnalysis(id: string) {
    await this.db.withExclusiveTransactionAsync(async tx => {
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
    const time = this.now();
    await this.db.withExclusiveTransactionAsync(async tx => {
      // Opening the app must not cancel a live App Intent process using the same DB.
      // Only recover abandoned work after a grace period; never recreate its image implicitly.
      await tx.runAsync("UPDATE analyses SET status='failed',error_code='INTERRUPTED',processing_token=NULL WHERE status IN ('queued','processing') AND received_at<?", new Date(Date.parse(time) - 10 * 60000).toISOString());
      await tx.runAsync("UPDATE extracted_tasks SET title='보존 기간이 지난 제안',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,review_status='ignored',confidence=0 WHERE review_status='pending' AND analysis_id IN (SELECT id FROM analyses WHERE expires_at <= ?)", time);
      await tx.runAsync("UPDATE extracted_tasks SET evidence_text='' WHERE analysis_id IN (SELECT id FROM analyses WHERE expires_at <= ?)", time);
      await tx.runAsync("UPDATE analyses SET status=CASE WHEN EXISTS(SELECT 1 FROM extracted_tasks WHERE analysis_id=analyses.id AND review_status='saved') THEN 'saved' ELSE 'ignored' END WHERE status='review' AND expires_at<=?", time);
    });
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
      result = { format_version: 1, exported_at: this.now(), todos: await tx.getAllAsync('SELECT * FROM todos'), analyses: await tx.getAllAsync('SELECT * FROM analyses'), extracted_tasks: await tx.getAllAsync('SELECT * FROM extracted_tasks') };
    });
    return JSON.stringify(result, null, 2);
  }
  async deleteAll() {
    await this.db.withExclusiveTransactionAsync(async tx => { await tx.execAsync('DELETE FROM extracted_tasks; DELETE FROM analyses; DELETE FROM todos; DELETE FROM preferences;'); });
    await this.db.execAsync('VACUUM;');
  }
}
