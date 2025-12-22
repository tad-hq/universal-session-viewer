/**
 * Unit Tests for buildSessionMetadataQuery
 *
 * Tests the shared SQL query builder function that generates consistent
 * SELECT statements for session metadata across multiple IPC handlers.
 *
 * Coverage:
 * - Base query generation (no optional fields)
 * - Continuation count subquery inclusion
 * - Analysis cache JOIN and fields
 * - Pagination (LIMIT/OFFSET)
 * - Custom ORDER BY
 * - Combined options (all flags enabled)
 */

import { describe, test, expect, beforeEach } from 'vitest';

/**
 * buildSessionMetadataQuery function implementation
 * This is the function that will be added to main.js
 *
 * @param {Object} options - Query configuration
 * @param {boolean} options.includeContinuationCount - Add continuation_count subquery
 * @param {boolean} options.includeAnalysis - Join session_analysis_cache
 * @param {string} options.orderBy - Sort column (default: last_message_time DESC)
 * @param {number} options.limit - Result limit (optional)
 * @param {number} options.offset - Pagination offset (optional)
 * @returns {string} - Complete SQL SELECT statement
 */
function buildSessionMetadataQuery(options: {
  includeContinuationCount?: boolean;
  includeAnalysis?: boolean;
  orderBy?: string;
  limit?: number;
  offset?: number;
} = {}): string {
  // Base SELECT with core fields
  const baseFields = `
    m.session_id,
    m.project_path,
    m.file_path,
    m.file_modified_time,
    m.message_count,
    m.last_message_time,
    m.is_analyzed`;

  // Conditional field: continuation_count subquery
  const continuationCountField = options.includeContinuationCount
    ? `,
          (SELECT COUNT(*) FROM session_continuations
           WHERE parent_session_id = m.session_id) as continuation_count`
    : '';

  // Conditional fields: analysis cache
  const analysisFields = options.includeAnalysis
    ? `,
          c.title,
          c.summary,
          c.analysis_timestamp,
          c.analysis_date`
    : '';

  // Conditional fields: continuation metadata (always include for consistency)
  const continuationMetadataFields = `
    sc.parent_session_id as continuation_of,
    sc.continuation_order as chain_position,
    sc.is_active_continuation`;

  // Conditional JOIN clause for analysis
  const analysisJoin = options.includeAnalysis
    ? 'LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id'
    : '';

  // Continuation metadata JOIN (always present)
  const continuationJoin = 'LEFT JOIN session_continuations sc ON m.session_id = sc.child_session_id';

  // ORDER BY clause
  const orderBy = options.orderBy || 'last_message_time DESC';

  // LIMIT/OFFSET clauses
  const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
  const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

  // Assemble final query (normalize whitespace)
  return `
    SELECT ${baseFields}${continuationCountField}${analysisFields},
          ${continuationMetadataFields}
    FROM session_metadata m
    ${analysisJoin}
    ${continuationJoin}
    ORDER BY m.${orderBy}
    ${limitClause} ${offsetClause}
  `.trim().replace(/\s+/g, ' ');
}

describe('buildSessionMetadataQuery', () => {
  test('generates base query without optional fields', () => {
    // GIVEN: No options
    const query = buildSessionMetadataQuery();

    // THEN: Returns query with core fields only
    expect(query).toContain('SELECT');
    expect(query).toContain('m.session_id');
    expect(query).toContain('m.project_path');
    expect(query).toContain('m.file_path');
    expect(query).toContain('m.message_count');
    expect(query).toContain('m.last_message_time');
    expect(query).toContain('FROM session_metadata m');

    // ASSERT: No continuation_count subquery
    expect(query).not.toContain('SELECT COUNT(*) FROM session_continuations');

    // ASSERT: No analysis fields
    expect(query).not.toContain('c.title');
    expect(query).not.toContain('c.summary');
    expect(query).not.toContain('c.analysis_timestamp');

    // ASSERT: No analysis JOIN
    expect(query).not.toContain('LEFT JOIN session_analysis_cache');

    // ASSERT: Default ORDER BY last_message_time DESC
    expect(query).toContain('ORDER BY m.last_message_time DESC');
  });

  test('includes continuation_count when requested', () => {
    // GIVEN: { includeContinuationCount: true }
    const query = buildSessionMetadataQuery({ includeContinuationCount: true });

    // THEN: Returns query with continuation_count subquery
    expect(query).toContain('SELECT COUNT(*) FROM session_continuations');

    // ASSERT: Subquery uses correct parent_session_id reference
    expect(query).toContain('WHERE parent_session_id = m.session_id');

    // ASSERT: Subquery aliases as 'continuation_count'
    expect(query).toContain('as continuation_count');
  });

  test('includes analysis fields and JOIN when requested', () => {
    // GIVEN: { includeAnalysis: true }
    const query = buildSessionMetadataQuery({ includeAnalysis: true });

    // THEN: Returns query with analysis fields
    expect(query).toContain('c.title');
    expect(query).toContain('c.summary');
    expect(query).toContain('c.analysis_timestamp');
    expect(query).toContain('c.analysis_date');

    // ASSERT: Contains LEFT JOIN session_analysis_cache
    expect(query).toContain('LEFT JOIN session_analysis_cache c');
    expect(query).toContain('ON m.session_id = c.session_id');
  });

  test('applies pagination parameters', () => {
    // GIVEN: { limit: 50, offset: 100 }
    const query = buildSessionMetadataQuery({ limit: 50, offset: 100 });

    // THEN: Returns query with LIMIT/OFFSET
    expect(query).toContain('LIMIT 50');
    expect(query).toContain('OFFSET 100');
  });

  test('supports custom ORDER BY', () => {
    // GIVEN: { orderBy: 'message_count DESC' }
    const query = buildSessionMetadataQuery({ orderBy: 'message_count DESC' });

    // THEN: Returns query with custom sort
    expect(query).toContain('ORDER BY m.message_count DESC');

    // ASSERT: Does not contain default sort
    expect(query).not.toContain('ORDER BY m.last_message_time DESC');
  });

  test('combines all options correctly', () => {
    // GIVEN: All options enabled
    const query = buildSessionMetadataQuery({
      includeContinuationCount: true,
      includeAnalysis: true,
      limit: 10,
      offset: 20,
      orderBy: 'message_count DESC'
    });

    // THEN: Returns complete query
    // ASSERT: Contains all base fields
    expect(query).toContain('m.session_id');
    expect(query).toContain('m.message_count');

    // ASSERT: Contains continuation_count subquery
    expect(query).toContain('SELECT COUNT(*) FROM session_continuations');
    expect(query).toContain('as continuation_count');

    // ASSERT: Contains analysis fields
    expect(query).toContain('c.title');
    expect(query).toContain('c.summary');
    expect(query).toContain('c.analysis_timestamp');

    // ASSERT: Contains analysis JOIN
    expect(query).toContain('LEFT JOIN session_analysis_cache c');

    // ASSERT: Contains continuation metadata JOIN
    expect(query).toContain('LEFT JOIN session_continuations sc');
    expect(query).toContain('sc.parent_session_id as continuation_of');

    // ASSERT: Contains proper ORDER/LIMIT/OFFSET
    expect(query).toContain('ORDER BY m.message_count DESC');
    expect(query).toContain('LIMIT 10');
    expect(query).toContain('OFFSET 20');
  });
});
