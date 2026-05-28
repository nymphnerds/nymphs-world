import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthedApp } from '../helpers/testApp.js';

describe('Reminders API Integration', () => {
  let agent: ReturnType<typeof getAuthedApp>['agent'];
  let token: string;
  const username = 'integ_reminders_user';

  beforeAll(async () => {
    const authed = await getAuthedApp(username);
    agent = authed.agent;
    token = authed.token;
  });

  // ─── Create reminder ───

  describe('POST /api/reminders', () => {
    it('creates a new reminder', async () => {
      const ts = Date.now();
      const res = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: `test-integration/reminder-file-${ts}.md`,
          title: `Reminder title ${ts}`,
          fireAt: new Date(Date.now() + 3600000).toISOString(),
          recurrence: 'none',
        });
      expect(res.status).toBe(201);
      expect(res.body.reminder).toBeDefined();
      expect(res.body.reminder.id).toBeDefined();
      expect(res.body.reminder.title).toBe(`Reminder title ${ts}`);
    });

    it('returns 400 when filePath missing', async () => {
      const res = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'test',
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when title missing', async () => {
      const res = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'test.md',
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when fireAt missing', async () => {
      const res = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'test.md',
          title: 'test',
        });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const { getTestApp } = await import('../helpers/testApp.js');
      const unauth = getTestApp();
      const res = await unauth.post('/api/reminders').send({
        filePath: 'test.md',
        title: 'test',
        fireAt: new Date(Date.now() + 3600000).toISOString(),
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── List reminders ───

  describe('GET /api/reminders', () => {
    it('returns list of reminders', async () => {
      const res = await agent.get('/api/reminders')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.reminders).toBeDefined();
      expect(Array.isArray(res.body.reminders)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const { getTestApp } = await import('../helpers/testApp.js');
      const unauth = getTestApp();
      const res = await unauth.get('/api/reminders');
      expect(res.status).toBe(401);
    });
  });

  // ─── Get grouped reminders ───

  describe('GET /api/reminders/grouped', () => {
    it('returns reminders grouped by file', async () => {
      const res = await agent.get('/api/reminders/grouped')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.groups).toBeDefined();
    });
  });

  // ─── Update nonexistent returns error ───

  describe('PUT /api/reminders/:id (nonexistent)', () => {
    it('returns error for nonexistent ID via update', async () => {
      const res = await agent.put('/api/reminders/nonexistent-id-xyz')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Update reminder ───

  describe('PUT /api/reminders/:id', () => {
    it('updates a reminder', async () => {
      const ts = Date.now();
      // Create first
      const createRes = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: `test-integration/update-test-${ts}.md`,
          title: `Before update ${ts}`,
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      const id = createRes.body.reminder.id;

      const res = await agent.put(`/api/reminders/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `After update ${ts}`,
          fireAt: new Date(Date.now() + 7200000).toISOString(),
        });
      expect(res.status).toBe(200);
      expect(res.body.reminder.title).toBe(`After update ${ts}`);
    });
  });

  // ─── Add thread note ───

  describe('POST /api/reminders/:id/thread', () => {
    it('adds a thread note', async () => {
      const ts = Date.now();
      const createRes = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: `test-integration/thread-test-${ts}.md`,
          title: `Thread test ${ts}`,
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      const id = createRes.body.reminder.id;

      const res = await agent.post(`/api/reminders/${id}/thread`)
        .set('Authorization', `Bearer ${token}`)
        .send({ note: `Thread note ${ts}` });
      expect(res.status).toBe(200);
      expect(res.body.reminder.id).toBe(id);
    });

    it('returns 400 when note missing', async () => {
      const res = await agent.post('/api/reminders/nonexistent-thread-xyz/thread')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── Delete reminder ───

  describe('DELETE /api/reminders/:id', () => {
    it('deletes a reminder', async () => {
      // Create first
      const createRes = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: `test-integration/delete-test-${Date.now()}.md`,
          title: `Delete test`,
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      const id = createRes.body.reminder.id;

      const res = await agent.delete(`/api/reminders/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify gone - try to update it
      const getRes = await agent.put(`/api/reminders/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'should fail' });
      expect(getRes.status).toBe(400);
    });

    it('returns error when deleting nonexistent reminder', async () => {
      const res = await agent.delete('/api/reminders/nonexistent-delete-xyz')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  // ─── Check and fire reminders ───

  describe('POST /api/reminders/check', () => {
    it('checks for fired reminders (past fireAt)', async () => {
      const res = await agent.post('/api/reminders/check')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('fired');
      expect(res.body).toHaveProperty('advanced');
    });
  });

  // ─── Convert to new reminder ───

  describe('POST /api/reminders/:id/convert', () => {
    it('converts a reminder to a new follow-up', async () => {
      const ts = Date.now();
      const createRes = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: `test-integration/convert-test-${ts}.md`,
          title: `Convert test ${ts}`,
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      const id = createRes.body.reminder.id;

      const res = await agent.post(`/api/reminders/${id}/convert`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          newFireAt: new Date(Date.now() + 7200000).toISOString(),
        });
      expect(res.status).toBe(200);
      expect(res.body.reminder).toBeDefined();
    });

    it('returns 400 when newFireAt missing', async () => {
      const ts = Date.now();
      const createRes = await agent.post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: `test-integration/convert-missing-${ts}.md`,
          title: `Convert missing ${ts}`,
          fireAt: new Date(Date.now() + 3600000).toISOString(),
        });
      const id = createRes.body.reminder.id;

      const res = await agent.post(`/api/reminders/${id}/convert`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});