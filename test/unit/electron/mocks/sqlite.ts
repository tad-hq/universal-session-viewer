import { vi } from 'vitest';

export interface MockStatement {
  run: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  iterate: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
  pluck: ReturnType<typeof vi.fn>;
}

export interface MockDatabase {
  prepare: ReturnType<typeof vi.fn<any, MockStatement>>;
  exec: ReturnType<typeof vi.fn>;
  pragma: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  inTransaction: boolean;
  _data: Map<string, any[]>;
}

export function createMockStatement(sql: string, dataStore: Map<string, any[]>): MockStatement {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();

  const selectMatch = normalizedSql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
  const insertMatch = normalizedSql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)/i);
  const updateMatch = normalizedSql.match(/UPDATE\s+(\w+)/i);
  const deleteMatch = normalizedSql.match(/DELETE\s+FROM\s+(\w+)/i);

  const isCTEQuery = /WITH\s+RECURSIVE/i.test(normalizedSql);

  const tableName = selectMatch?.[2] || insertMatch?.[1] || updateMatch?.[1] || deleteMatch?.[1] || 'unknown';

  const sqlForOperations = normalizedSql;

  return {
    run: vi.fn((...params: any[]) => {
      const data = dataStore.get(tableName) || [];

      if (insertMatch) {
        const isReplace = /INSERT\s+OR\s+REPLACE/i.test(sqlForOperations);
        const valuesMatch = sqlForOperations.match(/VALUES\s*\((.*?)\)/i);
        if (valuesMatch) {
          const columnsMatch = sqlForOperations.match(/\(([^)]+)\)\s*VALUES/i);
          const columns = columnsMatch?.[1].split(',').map(c => c.trim()) || [];
          const newRow: any = {};
          columns.forEach((col, i) => {
            newRow[col] = params[i];
          });

          if (isReplace) {
            const primaryKeyColumn = columns[0];
            const primaryKeyValue = params[0];
            const filtered = data.filter(row => row[primaryKeyColumn] !== primaryKeyValue);
            filtered.push(newRow);
            dataStore.set(tableName, filtered);
            return { changes: 1, lastInsertRowid: filtered.length };
          } else {
            data.push(newRow);
            dataStore.set(tableName, data);
            return { changes: 1, lastInsertRowid: data.length };
          }
        }
        return { changes: 1, lastInsertRowid: data.length };
      }

      if (updateMatch) {
        const whereMatch = sqlForOperations.match(/WHERE\s+(\w+)\s*=\s*\?/i);
        if (whereMatch && params.length > 0) {
          const whereColumn = whereMatch[1];
          const whereValue = params[params.length - 1];
          const setMatch = sqlForOperations.match(/SET\s+(.+?)\s+WHERE/i);
          if (setMatch) {
            const setPairs = setMatch[1].split(',').map(p => p.trim());
            let paramIndex = 0;
            data.forEach(row => {
              if (row[whereColumn] === whereValue) {
                setPairs.forEach(pair => {
                  const [col] = pair.split('=').map(s => s.trim());
                  row[col] = params[paramIndex++];
                });
              }
            });
          }
        }
        return { changes: 1, lastInsertRowid: 0 };
      }

      if (deleteMatch) {
        const whereMatch = sqlForOperations.match(/WHERE\s+(\w+)\s*=\s*\?/i);
        if (whereMatch && params.length > 0) {
          const whereColumn = whereMatch[1];
          const whereValue = params[0];
          const filtered = data.filter(row => row[whereColumn] !== whereValue);
          dataStore.set(tableName, filtered);
          return { changes: data.length - filtered.length, lastInsertRowid: 0 };
        } else {
          const count = data.length;
          dataStore.set(tableName, []);
          return { changes: count, lastInsertRowid: 0 };
        }
      }

      return { changes: 1, lastInsertRowid: 1 };
    }),

    get: vi.fn((...params: any[]) => {
      if (/SELECT\s+parent_session_id\s+as\s+continuation_of\s+FROM\s+session_continuations/i.test(sqlForOperations)) {
        const continuations = dataStore.get('session_continuations') || [];
        const childId = params[0];
        const cont = continuations.find(c => c.child_session_id === childId);
        return cont ? { continuation_of: cont.parent_session_id } : null;
      }

      if (/WITH\s+RECURSIVE\s+ancestors/i.test(sqlForOperations) && /SELECT\s+MAX\(d\)\s+as\s+depth/i.test(sqlForOperations)) {
        const continuations = dataStore.get('session_continuations') || [];
        const sessionId = params[0];

        let depth = 0;
        let currentId = sessionId;
        const visited = new Set();

        while (true) {
          if (visited.has(currentId)) break;
          visited.add(currentId);

          const parent = continuations.find(c => c.child_session_id === currentId);
          if (!parent) break;

          depth++;
          currentId = parent.parent_session_id;
        }

        return { depth };
      }

      if (/FROM\s+session_metadata\s+m\s+LEFT\s+JOIN\s+session_analysis_cache\s+c/i.test(sqlForOperations)) {
        const metadata = dataStore.get('session_metadata') || [];
        const analysisCache = dataStore.get('session_analysis_cache') || [];
        const sessionId = params[0];

        const meta = metadata.find(m => m.session_id === sessionId);
        if (!meta) return null;

        const analysis = analysisCache.find(a => a.session_id === sessionId) || {};

        return {
          session_id: meta.session_id,
          project_path: meta.project_path,
          file_path: meta.file_path,
          message_count: meta.message_count,
          last_message_time: meta.last_message_time,
          is_analyzed: meta.is_analyzed,
          title: analysis.title,
          summary: analysis.summary,
        };
      }

      if (/COUNT\s*\(\s*DISTINCT\s+(\w+)\s*\)/i.test(sqlForOperations)) {
        const match = sqlForOperations.match(/COUNT\s*\(\s*DISTINCT\s+(\w+)\s*\)/i);
        const column = match?.[1];
        const data = dataStore.get(tableName) || [];
        const uniqueValues = new Set(data.map(row => row[column]).filter(v => v != null));
        return { count: uniqueValues.size };
      }

      if (/SELECT\s+parent_session_id,\s*COUNT\(\*\)\s+as\s+depth/i.test(sqlForOperations)) {
        const continuations = dataStore.get('session_continuations') || [];
        const countByParent = new Map<string, number>();

        continuations.forEach(c => {
          const count = countByParent.get(c.parent_session_id) || 0;
          countByParent.set(c.parent_session_id, count + 1);
        });

        if (countByParent.size === 0) return null;

        let maxParent = '';
        let maxDepth = 0;
        countByParent.forEach((depth, parent) => {
          if (depth > maxDepth) {
            maxDepth = depth;
            maxParent = parent;
          }
        });

        return { parent_session_id: maxParent, depth: maxDepth };
      }

      let data = [...(dataStore.get(tableName) || [])];

      if (sqlForOperations.match(/COUNT\s*\(\s*\*\s*\)/i) && !/SELECT\s+MAX\(/i.test(sqlForOperations)) {
        const whereAndMatch = sqlForOperations.match(/WHERE\s+(.+)/i);
        if (whereAndMatch) {
          const whereClause = whereAndMatch[1];
          const conditions = whereClause.split(/\s+AND\s+/i);

          const conditionValues: any[] = [];
          let paramIndex = 0;
          conditions.forEach(condition => {
            const match = condition.match(/(\w+)\s*=\s*(\?|\d+|'[^']+'|"[^"]+")/i);
            if (match) {
              const [, , rawValue] = match;
              if (rawValue === '?') {
                conditionValues.push(params[paramIndex++]);
              } else if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
                conditionValues.push(rawValue.slice(1, -1));
              } else {
                conditionValues.push(Number(rawValue));
              }
            } else {
              conditionValues.push(null);
            }
          });

          const filtered = data.filter(row => {
            return conditions.every((condition, idx) => {
              const match = condition.match(/(\w+)\s*=\s*(\?|\d+|'[^']+'|"[^"]+")/i);
              if (match) {
                const column = match[1];
                const value = conditionValues[idx];
                return row[column] == value;
              }
              return true;
            });
          });
          return { count: filtered.length };
        }

        return { count: data.length };
      }

      if (/SELECT\s+MAX\(/i.test(sqlForOperations)) {
        const whereMatch = sqlForOperations.match(/WHERE\s+(.+)/i);
        let filtered = data;
        if (whereMatch) {
          const whereClause = whereMatch[1];
          const conditions = whereClause.split(/\s+AND\s+/i);

          const conditionValues: any[] = [];
          let paramIndex = 0;
          conditions.forEach(condition => {
            const match = condition.match(/(\w+)\s*=\s*(\?|\d+|'[^']+'|"[^"]+")/i);
            if (match) {
              const [, , rawValue] = match;
              if (rawValue === '?') {
                conditionValues.push(params[paramIndex++]);
              } else if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
                conditionValues.push(rawValue.slice(1, -1));
              } else {
                conditionValues.push(Number(rawValue));
              }
            } else {
              conditionValues.push(null);
            }
          });

          filtered = data.filter(row => {
            return conditions.every((condition, idx) => {
              const match = condition.match(/(\w+)\s*=\s*(\?|\d+|'[^']+'|"[^"]+")/i);
              if (match) {
                const column = match[1];
                const value = conditionValues[idx];
                return row[column] == value;
              }
              return true;
            });
          });
        }

        const result: any = {};

        const maxMatches = sqlForOperations.matchAll(/MAX\((\w+)\)\s+as\s+(\w+)/gi);
        for (const match of maxMatches) {
          const column = match[1];
          const alias = match[2];
          const values = filtered.map(row => row[column]).filter(v => v != null);
          result[alias] = values.length > 0 ? Math.max(...values) : 0;
        }

        if (/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i.test(sqlForOperations)) {
          const match = sqlForOperations.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i);
          if (match) {
            result[match[1]] = filtered.length;
          }
        }

        return result;
      }

      const whereMatch = sqlForOperations.match(/WHERE\s+(.+)/i);
      if (whereMatch && params.length > 0) {
        const whereClause = whereMatch[1];
        const conditions = whereClause.split(/\s+AND\s+/i);

        const conditionParams: any[] = [];
        conditions.forEach((condition) => {
          if (condition.includes('?')) {
            conditionParams.push(params[conditionParams.length]);
          }
        });

        data = data.filter(row => {
          let paramIdx = 0;
          return conditions.every(condition => {
            const eqMatch = condition.match(/(\w+)\s*=\s*\?/i);
            if (eqMatch) {
              const column = eqMatch[1];
              const value = conditionParams[paramIdx++];
              return row[column] == value;
            }
            return true;
          });
        });
      }

      const selectMatch = sqlForOperations.match(/SELECT\s+(.+?)\s+FROM/i);
      if (selectMatch && data.length > 0) {
        const selectClause = selectMatch[1];
        const aliasMatches = [...selectClause.matchAll(/(\w+)\s+as\s+(\w+)/gi)];

        if (aliasMatches.length > 0) {
          const row = data[0];
          const newRow: any = { ...row };
          aliasMatches.forEach(match => {
            const [, sourceCol, alias] = match;
            if (sourceCol in row) {
              newRow[alias] = row[sourceCol];
            }
          });
          return newRow;
        }
      }

      return data[0] || null;
    }),

    all: vi.fn((...params: any[]) => {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (isCTEQuery) {
        const parentId = params[0];
        return executeCTEChainQuery(dataStore, parentId);
      }

      if (/FROM\s+session_continuations\s+c\s+JOIN\s+session_metadata\s+m/i.test(normalizedSql) &&
          /WHERE\s+c\.parent_session_id\s+NOT\s+IN/i.test(normalizedSql)) {
        return handleOrphanDetectionQuery(dataStore);
      }

      if (/FROM\s+session_continuations\s+sc\s+JOIN\s+session_metadata\s+m/i.test(normalizedSql)) {
        return handleContinuationChildrenQuery(dataStore, params);
      }

      let filteredData = [...(dataStore.get(tableName) || [])];

      let remainingParams = [...params];

      const distinctMatch = normalizedSql.match(/SELECT\s+DISTINCT\s+(.+?)\s+FROM/i);
      if (distinctMatch) {
        const columns = distinctMatch[1].split(',').map(c => c.trim());
        const seen = new Set();
        filteredData = filteredData.filter(row => {
          const key = columns.map(col => row[col]).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      const whereMatch = normalizedSql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1];

        const orMatch = whereClause.match(/(.+?)\s+OR\s+(.+)/i);
        if (orMatch && remainingParams.length > 0) {
          const condition1 = orMatch[1];
          const condition2 = orMatch[2];
          const likeMatch1 = condition1.match(/(\w+)\s+LIKE\s+\?/i);
          const likeMatch2 = condition2.match(/(\w+)\s+LIKE\s+\?/i);

          if (likeMatch1 && likeMatch2) {
            const col1 = likeMatch1[1];
            const col2 = likeMatch2[1];
            const pattern1 = remainingParams[0];
            const pattern2 = remainingParams[1];

            const searchTerm1 = pattern1.replace(/^%|%$/g, '').toLowerCase();
            const searchTerm2 = pattern2.replace(/^%|%$/g, '').toLowerCase();

            filteredData = filteredData.filter(row => {
              const val1 = row[col1] ? String(row[col1]).toLowerCase() : '';
              const val2 = row[col2] ? String(row[col2]).toLowerCase() : '';

              const match1 = val1 && (
                pattern1.startsWith('%') && pattern1.endsWith('%') ? val1.includes(searchTerm1) :
                pattern1.startsWith('%') ? val1.endsWith(searchTerm1) :
                pattern1.endsWith('%') ? val1.startsWith(searchTerm1) :
                val1 === searchTerm1
              );

              const match2 = val2 && (
                pattern2.startsWith('%') && pattern2.endsWith('%') ? val2.includes(searchTerm2) :
                pattern2.startsWith('%') ? val2.endsWith(searchTerm2) :
                pattern2.endsWith('%') ? val2.startsWith(searchTerm2) :
                val2 === searchTerm2
              );

              return match1 || match2;
            });
          }
        } else {
          const likeMatch = whereClause.match(/(\w+)\s+LIKE\s+\?/i);
          if (likeMatch) {
            const column = likeMatch[1];
            const pattern = remainingParams[0];
            if (pattern) {
              const searchTerm = pattern.replace(/^%|%$/g, '');

              filteredData = filteredData.filter(row => {
                const value = row[column];
                if (!value) return false;
                const valueStr = String(value).toLowerCase();
                const termStr = searchTerm.toLowerCase();

                if (pattern.startsWith('%') && pattern.endsWith('%')) {
                  return valueStr.includes(termStr);
                } else if (pattern.startsWith('%')) {
                  return valueStr.endsWith(termStr);
                } else if (pattern.endsWith('%')) {
                  return valueStr.startsWith(termStr);
                } else {
                  return valueStr === termStr;
                }
              });
            } else {
              filteredData = [];
            }
          }

          const eqMatch = whereClause.match(/(\w+)\s*=\s*\?/i);
          if (eqMatch && !whereClause.includes('LIKE')) {
            const column = eqMatch[1];
            const value = remainingParams[0];
            filteredData = filteredData.filter(row => row[column] == value);
          }

          const notNullMatch = whereClause.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
          if (notNullMatch) {
            const column = notNullMatch[1];
            filteredData = filteredData.filter(row => row[column] != null);
          }
        }
      }

      const caseMatch = normalizedSql.match(/CASE\s+(.+?)\s+END\s+as\s+(\w+)/i);
      if (caseMatch) {
        const caseExpression = caseMatch[1];
        const alias = caseMatch[2];

        const whenMatches = [...caseExpression.matchAll(/WHEN\s+(\w+)\s+LIKE\s+\?\s+THEN\s+(\d+)/gi)];
        const elseMatch = caseExpression.match(/ELSE\s+(\d+)/i);
        const elseValue = elseMatch ? parseInt(elseMatch[1]) : 0;

        const caseParamCount = whenMatches.length;

        const caseParams = remainingParams.slice(0, caseParamCount);

        remainingParams = remainingParams.slice(caseParamCount);

        filteredData = filteredData.map(row => {
          let rankValue = elseValue;

          whenMatches.forEach((whenMatch, idx) => {
            const column = whenMatch[1];
            const thenValue = parseInt(whenMatch[2]);
            const pattern = caseParams[idx];

            if (pattern) {
              const searchTerm = pattern.replace(/^%|%$/g, '').toLowerCase();
              const value = row[column] ? String(row[column]).toLowerCase() : '';

              if (pattern.startsWith('%') && pattern.endsWith('%') && value.includes(searchTerm)) {
                rankValue = thenValue;
              }
            }
          });

          return { ...row, [alias]: rankValue };
        });
      }

      const castMatch1 = normalizedSql.match(/CAST\((\w+)\s+AS\s+FLOAT\)\s*\/\s*(\w+)\s*\*\s*(\d+(?:\.\d+)?)\s+as\s+(\w+)/i);
      if (castMatch1) {
        const [, numerator, denominator, multiplier, alias] = castMatch1;
        filteredData = filteredData.map(row => ({
          ...row,
          [alias]: (parseFloat(row[numerator] || 0) / parseFloat(row[denominator] || 1)) * parseFloat(multiplier),
        }));
      }

      const castMatch2 = normalizedSql.match(/CAST\((\w+)\s+AS\s+FLOAT\)\s*\/\s*(\w+)(?:\s+as\s+(\w+))?/i);
      if (castMatch2 && !castMatch1) {
        const [, numerator, denominator, alias] = castMatch2;
        if (alias) {
          filteredData = filteredData.map(row => ({
            ...row,
            [alias]: parseFloat(row[numerator] || 0) / parseFloat(row[denominator] || 1),
          }));
        }
      }

      const selectMatch = normalizedSql.match(/SELECT\s+(.+?)\s+FROM/i);
      if (selectMatch) {
        let selectClause = selectMatch[1];

        selectClause = selectClause.replace(/CAST\([^)]+\)[^,]*/gi, '');

        const aliasMatches = [...selectClause.matchAll(/(\w+)\s+as\s+(\w+)/gi)];

        if (aliasMatches.length > 0) {
          filteredData = filteredData.map(row => {
            const newRow: any = { ...row };
            aliasMatches.forEach(match => {
              const [, sourceCol, alias] = match;
              if (!(alias in newRow) && sourceCol in row) {
                newRow[alias] = row[sourceCol];
              }
            });
            return newRow;
          });
        }
      }

      const orderMatch = normalizedSql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
      if (orderMatch) {
        const orderColumn = orderMatch[1];
        const orderDirection = orderMatch[2]?.toUpperCase() || 'ASC';
        filteredData.sort((a, b) => {
          const aVal = a[orderColumn];
          const bVal = b[orderColumn];
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return orderDirection === 'DESC' ? -cmp : cmp;
        });
      }

      const limitMatch = normalizedSql.match(/LIMIT\s+(\d+|\?)/i);
      if (limitMatch) {
        const limitValue = limitMatch[1] === '?' ? remainingParams[remainingParams.length - 1] : parseInt(limitMatch[1]);
        filteredData = filteredData.slice(0, limitValue);
      }

      return filteredData;
    }),

    iterate: vi.fn((...params: any[]) => {
      const data = dataStore.get(tableName) || [];

      const whereMatch = sqlForOperations.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      if (whereMatch && params.length > 0) {
        const whereColumn = whereMatch[1];
        const whereValue = params[0];
        const filtered = data.filter(row => row[whereColumn] == whereValue);
        return filtered[Symbol.iterator]();
      }

      return data[Symbol.iterator]();
    }),

    finalize: vi.fn(),

    pluck: vi.fn((returnFirst: boolean = true) => {
      const originalGet = this.get;
      const originalAll = this.all;

      return {
        ...this,
        get: vi.fn((...params: any[]) => {
          const result = originalGet.getMockImplementation()?.(...params);
          if (result && typeof result === 'object') {
            const firstKey = Object.keys(result)[0];
            return result[firstKey];
          }
          return result;
        }),
        all: vi.fn((...params: any[]) => {
          const results = originalAll.getMockImplementation()?.(...params) || [];
          return results.map((row: any) => {
            const firstKey = Object.keys(row)[0];
            return row[firstKey];
          });
        }),
      };
    }),
  };
}

export function createMockDatabase(initialData: Record<string, any[]> = {}): MockDatabase {
  const dataStore = new Map<string, any[]>(Object.entries(initialData));

  const db: MockDatabase = {
    _data: dataStore,
    inTransaction: false,

    prepare: vi.fn((sql: string) => {
      return createMockStatement(sql, dataStore);
    }),

    exec: vi.fn((sql: string) => {
      return db;
    }),

    pragma: vi.fn((pragma: string, options?: any) => {
      if (pragma === 'user_version') {
        return options?.simple ? 1 : [{ user_version: 1 }];
      }
      if (pragma === 'journal_mode') {
        return 'wal';
      }
      return null;
    }),

    close: vi.fn(),

    transaction: vi.fn((fn: Function) => {
      return (...args: any[]) => {
        db.inTransaction = true;
        try {
          const result = fn(...args);
          db.inTransaction = false;
          return result;
        } catch (error) {
          db.inTransaction = false;
          throw error;
        }
      };
    }),
  };

  return db;
}

export function createMockDatabaseConstructor(initialData?: Record<string, any[]>) {
  return vi.fn((filename: string, options?: any) => {
    return createMockDatabase(initialData);
  });
}

export function seedTable(db: MockDatabase, tableName: string, rows: any[]): void {
  db._data.set(tableName, rows);
}

export function getTableData(db: MockDatabase, tableName: string): any[] {
  return db._data.get(tableName) || [];
}

export function clearDatabase(db: MockDatabase): void {
  db._data.clear();
}

export function resetDatabase(db: MockDatabase): void {
  db._data.clear();
  vi.clearAllMocks();
}

function handleOrphanDetectionQuery(dataStore: Map<string, any[]>): any[] {
  const continuations = dataStore.get('session_continuations') || [];
  const metadata = dataStore.get('session_metadata') || [];

  const existingSessionIds = new Set(metadata.map(m => m.session_id));

  const orphans = continuations.filter(c => !existingSessionIds.has(c.parent_session_id));

  return orphans.map(c => {
    const meta = metadata.find(m => m.session_id === c.session_id || m.session_id === c.child_session_id) || {};

    return {
      child_session_id: c.child_session_id || c.session_id,
      parent_session_id: c.parent_session_id,
      continuation_order: c.continuation_order,
      file_path: meta.file_path,
      project_path: meta.project_path,
    };
  });
}

function handleContinuationChildrenQuery(dataStore: Map<string, any[]>, params: any[]): any[] {
  const continuations = dataStore.get('session_continuations') || [];
  const metadata = dataStore.get('session_metadata') || [];
  const analysisCache = dataStore.get('session_analysis_cache') || [];

  const parentId = params[0];
  const children = continuations.filter(c => c.parent_session_id === parentId);

  return children.map(c => {
    const meta = metadata.find(m => m.session_id === c.child_session_id) || {};
    const analysis = analysisCache.find(a => a.session_id === c.child_session_id) || {};

    return {
      session_id: c.child_session_id,
      project_path: meta.project_path,
      file_path: meta.file_path,
      message_count: meta.message_count,
      last_message_time: meta.last_message_time,
      is_analyzed: meta.is_analyzed,
      title: analysis.title,
      summary: analysis.summary,
      chain_position: c.continuation_order,
      is_active_continuation: c.is_active_continuation,
    };
  }).sort((a, b) => (a.chain_position || 0) - (b.chain_position || 0));
}

export function executeCTEChainQuery(
  dataStore: Map<string, any[]> | MockDatabase,
  rootSessionId: string,
  tableName: string = 'session_continuations'
): any[] {
  const store = ('_data' in dataStore) ? dataStore._data : dataStore;

  const continuations = store.get(tableName) || [];
  const metadata = store.get('session_metadata') || [];
  const analysisCache = store.get('session_analysis_cache') || [];
  const result: any[] = [];
  const visited = new Set<string>();

  let currentDepth = 0;
  let foundAtDepth = true;
  const parentsAtCurrentDepth = [rootSessionId];

  while (foundAtDepth && currentDepth < 100) {
    foundAtDepth = false;
    const nextParents: string[] = [];

    for (const parent of parentsAtCurrentDepth) {
      const children = continuations
        .filter(c =>
          c.parent_session_id === parent && !visited.has(c.child_session_id)
        )
        .sort((a, b) => (a.continuation_order || 0) - (b.continuation_order || 0));

      for (const child of children) {
        const meta = metadata.find(m => m.session_id === child.child_session_id) || {};
        const analysis = analysisCache.find(a => a.session_id === child.child_session_id) || {};

        result.push({
          session_id: child.child_session_id,
          parent_session_id: child.parent_session_id,
          project_path: meta.project_path,
          file_path: meta.file_path,
          message_count: meta.message_count,
          last_message_time: meta.last_message_time,
          is_analyzed: meta.is_analyzed,
          title: analysis.title,
          summary: analysis.summary,
          depth: currentDepth + 1,
          continuation_order: child.continuation_order,
          chain_position: child.continuation_order,
          is_active_continuation: child.is_active_continuation,
        });
        visited.add(child.child_session_id);
        nextParents.push(child.child_session_id);
        foundAtDepth = true;
      }
    }

    parentsAtCurrentDepth.length = 0;
    parentsAtCurrentDepth.push(...nextParents);
    currentDepth++;
  }

  return result;
}

export function executeOrphanQuery(
  db: MockDatabase,
  continuationsTable: string = 'session_continuations',
  metadataTable: string = 'session_metadata'
): any[] {
  const continuations = db._data.get(continuationsTable) || [];
  const metadata = db._data.get(metadataTable) || [];

  const metadataIds = new Set(metadata.map(m => m.session_id));

  return continuations.filter(c => !metadataIds.has(c.parent_session_id));
}

export function triggerCacheInvalidation(
  db: MockDatabase,
  cacheTable: string = 'continuation_chain_cache'
): void {
  db._data.set(cacheTable, []);
}

export function setupContinuationTriggers(db: MockDatabase): void {
  const originalPrepare = db.prepare;

  db.prepare = vi.fn((sql: string) => {
    const stmt = originalPrepare(sql);
    const originalRun = stmt.run;

    stmt.run = vi.fn((...params: any[]) => {
      const result = originalRun(...params);

      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      const affectsContinuations =
        /INSERT.*INTO\s+session_continuations/i.test(normalizedSql) ||
        /UPDATE\s+session_continuations/i.test(normalizedSql) ||
        /DELETE\s+FROM\s+session_continuations/i.test(normalizedSql);

      if (affectsContinuations) {
        triggerCacheInvalidation(db);
      }

      return result;
    });

    return stmt;
  }) as any;
}

export function buildChainFixture(
  db: MockDatabase,
  chainSpec: Array<{ id: string; parent: string | null; order?: number }>,
  tableName: string = 'session_continuations'
): void {
  const continuations = chainSpec
    .filter(spec => spec.parent !== null)
    .map((spec, index) => ({
      child_session_id: spec.id,
      parent_session_id: spec.parent,
      continuation_order: spec.order ?? index + 1,
      is_active_continuation: true,
      is_orphaned: false,
      detected_at: new Date().toISOString(),
      child_started_timestamp: Date.now(),
    }));

  db._data.set(tableName, continuations);
}
