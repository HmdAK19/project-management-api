#!/usr/bin/env node
/**
 * ────────────────────────────────────────────────────────
 *  API Test Script – Jira Backend
 *  Runs a full integration test against the running server.
 *
 *  Usage:
 *    1. In one terminal:  npm run dev
 *    2. In another:       node test-api.mjs
 * ────────────────────────────────────────────────────────
 */

const BASE = 'http://localhost:4000';

// ─────────── Helpers ────────────
let passed = 0;
let failed = 0;
const results = [];

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✓  ${name}`);
  } else {
    failed++;
    results.push(`  ✗  ${name}  ${detail}`);
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────── Tests ────────────
async function runTests() {
  console.log('\n🧪  Starting API Integration Tests...\n');

  // 1. Health
  let r = await req('GET', '/api/health');
  check('Health check returns 200', r.status === 200, `got ${r.status}`);
  check('Health status is ok', r.data?.data?.status === 'ok');

  // 2. Init endpoint (bootstrap)
  r = await req('GET', '/api/init');
  check('Init returns all data', r.ok && r.data?.data, `got ${r.status}`);
  check('Init has users', (r.data?.data?.users?.length ?? 0) > 0);
  check('Init has projects', (r.data?.data?.projects?.length ?? 0) > 0);
  check('Init has tasks', (r.data?.data?.tasks?.length ?? 0) > 0);
  check('Init has sprints', (r.data?.data?.sprints?.length ?? 0) > 0);
  check('Init has boards', (r.data?.data?.boards?.length ?? 0) > 0);
  check('Task has parsed labels array', Array.isArray(r.data?.data?.tasks?.[0]?.labels));

  // 3. Users
  r = await req('GET', '/api/users');
  check('GET /api/users', r.ok && r.data?.data?.length >= 5, `got ${r.data?.data?.length}`);
  const userId = r.data?.data?.[0]?.id;

  r = await req('GET', `/api/users/${userId}`);
  check('GET /api/users/:id', r.ok && r.data?.data?.id === userId);

  r = await req('POST', '/api/users', {
    name: 'تست کاربر', email: 'testuser@test.com', role: 'تستر', color: '#00B8D9'
  });
  check('POST /api/users (create)', r.status === 201, `got ${r.status}`);
  const newUserId = r.data?.data?.id;

  r = await req('PUT', `/api/users/${newUserId}`, { name: 'تست کاربر ویرایش شده' });
  check('PUT /api/users/:id (update)', r.ok && r.data?.data?.name?.includes('ویرایش'));

  r = await req('DELETE', `/api/users/${newUserId}`);
  check('DELETE /api/users/:id', r.ok);

  // 4. Auth login
  r = await req('POST', '/api/auth/login', { email: 'hamed@company.com' });
  check('POST /api/auth/login (existing user)', r.ok && r.data?.data?.email === 'hamed@company.com');

  r = await req('POST', '/api/auth/login', { email: 'newperson@test.com' });
  check('POST /api/auth/login (auto-create)', r.ok, `got ${r.status}`);

  // 5. Projects
  r = await req('GET', '/api/projects');
  check('GET /api/projects', r.ok && r.data?.data?.length >= 3);
  const projectId = r.data?.data?.[0]?.id;

  r = await req('GET', `/api/projects/${projectId}`);
  check('GET /api/projects/:id (with boards+columns)', r.ok && r.data?.data?.boards?.length > 0);

  r = await req('POST', '/api/projects', {
    name: 'پروژه تستی', key: 'TESTP', leadId: userId, category: 'تست', rgb: '#FF5630'
  });
  check('POST /api/projects (with default board)', r.status === 201 && r.data?.data?.boards?.length > 0,
    `got ${r.status}`);
  const newProjectId = r.data?.data?.id;
  check('New project auto-creates board columns',
    r.data?.data?.boards?.[0]?.columns?.length === 5);

  r = await req('PUT', `/api/projects/${newProjectId}`, { name: 'پروژه ویرایش شده' });
  check('PUT /api/projects/:id', r.ok && r.data?.data?.name?.includes('ویرایش'));

  // 6. Boards
  r = await req('GET', '/api/boards?projectId=p-1');
  check('GET /api/boards?projectId', r.ok && r.data?.data?.length >= 2);
  const boardId = r.data?.data?.[0]?.id;

  r = await req('GET', `/api/boards/${boardId}`);
  check('GET /api/boards/:id (with columns+tasks)', r.ok && r.data?.data?.columns?.length > 0);

  // 7. Tasks
  r = await req('GET', '/api/tasks?projectId=p-1');
  check('GET /api/tasks?projectId', r.ok && r.data?.data?.length >= 3);

  r = await req('GET', '/api/tasks?status=DONE');
  check('GET /api/tasks?status filter', r.ok);

  r = await req('POST', '/api/tasks', {
    title: 'تسک تستی جدید', projectId: 'p-1', reporterId: 'u-1',
    priority: 'HIGH', type: 'TASK', labels: ['test', 'api']
  });
  check('POST /api/tasks (auto-generates key)', r.status === 201 && r.data?.data?.key?.startsWith('PORTAL-'),
    `got ${r.status}, key=${r.data?.data?.key}`);
  const newTaskId = r.data?.data?.id;
  check('New task has parsed labels', Array.isArray(r.data?.data?.labels) && r.data?.data?.labels.includes('test'));

  r = await req('PUT', `/api/tasks/${newTaskId}`, { title: 'عنوان ویرایش شده', status: 'IN_PROGRESS' });
  check('PUT /api/tasks/:id', r.ok && r.data?.data?.title?.includes('ویرایش'));

  r = await req('PATCH', `/api/tasks/${newTaskId}/move`, { targetStatus: 'DONE' });
  check('PATCH /api/tasks/:id/move', r.ok && r.data?.data?.status === 'DONE',
    `got status ${r.data?.data?.status}`);

  // 8. Subtasks
  r = await req('POST', `/api/tasks/${newTaskId}/subtasks`, { title: 'ساب‌تسک تستی' });
  check('POST /api/tasks/:id/subtasks', r.status === 201);
  const subtaskId = r.data?.data?.id;

  r = await req('PATCH', `/api/tasks/${newTaskId}/subtasks/${subtaskId}/toggle`);
  check('PATCH .../subtasks/:id/toggle', r.ok && r.data?.data?.isDone === true);

  r = await req('DELETE', `/api/tasks/${newTaskId}/subtasks/${subtaskId}`);
  check('DELETE .../subtasks/:id', r.ok);

  // 9. Comments
  r = await req('POST', `/api/tasks/${newTaskId}/comments`, {
    authorId: 'u-1', content: 'کامنت تستی'
  });
  check('POST /api/tasks/:id/comments', r.status === 201 && r.data?.data?.content === 'کامنت تستی');
  const commentId = r.data?.data?.id;

  r = await req('DELETE', `/api/tasks/${newTaskId}/comments/${commentId}`);
  check('DELETE .../comments/:id', r.ok);

  // 10. Sprints
  r = await req('GET', '/api/sprints');
  check('GET /api/sprints', r.ok && r.data?.data?.length >= 3);

  r = await req('POST', '/api/sprints', {
    name: 'اسپرینت تستی', status: 'FUTURE', startDate: '2026-08-01', endDate: '2026-08-15'
  });
  check('POST /api/sprints', r.status === 201);
  const newSprintId = r.data?.data?.id;

  r = await req('PATCH', `/api/sprints/${newSprintId}/status`, { status: 'ACTIVE' });
  check('PATCH /api/sprints/:id/status', r.ok && r.data?.data?.status === 'ACTIVE');

  r = await req('PUT', `/api/sprints/${newSprintId}`, { goal: 'هدف تستی' });
  check('PUT /api/sprints/:id', r.ok && r.data?.data?.goal === 'هدف تستی');

  r = await req('DELETE', `/api/sprints/${newSprintId}`);
  check('DELETE /api/sprints/:id', r.ok);

  // 11. Activity logs
  r = await req('POST', '/api/activity', {
    userId: 'u-1', action: 'ایجاد تسک', details: 'یک تسک جدید ایجاد شد'
  });
  check('POST /api/activity', r.status === 201);
  const logId = r.data?.data?.id;

  r = await req('GET', '/api/activity');
  check('GET /api/activity', r.ok && r.data?.data?.length > 0);

  r = await req('DELETE', `/api/activity/${logId}`);
  check('DELETE /api/activity/:id', r.ok);

  // 12. Wiki
  r = await req('POST', '/api/wiki', {
    projectId: 'p-1', title: 'صفحه ویکی تستی', content: '# تست'
  });
  check('POST /api/wiki', r.status === 201);
  const wikiId = r.data?.data?.id;

  r = await req('GET', '/api/wiki?projectId=p-1');
  check('GET /api/wiki?projectId', r.ok);

  r = await req('DELETE', `/api/wiki/${wikiId}`);
  check('DELETE /api/wiki/:id', r.ok);

  // 13. Cleanup created test data
  r = await req('DELETE', `/api/tasks/${newTaskId}`);
  check('Cleanup: DELETE test task', r.ok);

  r = await req('DELETE', `/api/projects/${newProjectId}`);
  check('Cleanup: DELETE test project (cascades)', r.ok);

  // 14. Error handling
  r = await req('GET', '/api/tasks/nonexistent-id-12345');
  check('GET /api/tasks/:id returns 404 for missing', r.status === 404, `got ${r.status}`);

  r = await req('POST', '/api/tasks', {});
  check('POST /api/tasks returns 400 for missing fields', r.status === 400, `got ${r.status}`);

  // ─────────── Print Results ────────────
  console.log(results.join('\n'));
  console.log('\n' + '═'.repeat(55));
  console.log(`  ✓  Passed: ${passed}`);
  console.log(`  ✗  Failed: ${failed}`);
  console.log('═'.repeat(55));

  if (failed > 0) {
    console.log('\n❌  Some tests failed. Check the output above.\n');
    process.exit(1);
  } else {
    console.log('\n✅  All tests passed! The backend is working perfectly.\n');
    process.exit(0);
  }
}

// ─────────── Main ────────────
console.log(`Testing against: ${BASE}`);

// Check if server is running
fetch(`${BASE}/api/health`)
  .then(() => runTests())
  .catch(() => {
    console.log('\n❌  Server is not running!');
    console.log('   Start it first with:  npm run dev');
    console.log('   Then run this test in another terminal.\n');
    process.exit(1);
  });
