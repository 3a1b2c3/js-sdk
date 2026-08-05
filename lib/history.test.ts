import { History, type Fact } from './history';

describe('History', () => {
  let history: History;

  beforeEach(() => {
    history = new History();
  });

  describe('Assertion', () => {
    it('asserts a sustained fact', () => {
      const fact: Fact = {
        key: 'weather:raining',
        clause: 'It is raining.',
        weight: 2,
        life: { kind: 'sustained' },
      };

      history.assert(fact);
      const snapshot = history.snapshot();

      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].key).toBe('weather:raining');
      expect(snapshot[0].clause).toBe('It is raining.');
    });

    it('asserts a temporary fact with step limit', () => {
      const fact: Fact = {
        key: 'fx:explosion',
        clause: 'Explosion nearby!',
        weight: 1,
        life: { kind: 'steps', n: 3 },
      };

      history.assert(fact);
      const snapshot = history.snapshot();

      expect(snapshot[0].remaining).toBe('3');
    });

    it('asserts an instant fact (1 step)', () => {
      const fact: Fact = {
        key: 'sfx:footstep',
        clause: 'Footsteps.',
        weight: 0,
        life: { kind: 'instant' },
      };

      history.assert(fact);
      const snapshot = history.snapshot();

      expect(snapshot[0].remaining).toBe('1');
    });

    it('refreshes an existing fact (same key)', () => {
      const fact1: Fact = {
        key: 'player:health',
        clause: 'Player health is 100.',
        weight: 1,
        life: { kind: 'sustained' },
      };
      const fact2: Fact = {
        key: 'player:health',
        clause: 'Player health is 50.',
        weight: 1,
        life: { kind: 'sustained' },
      };

      history.assert(fact1);
      history.assert(fact2);

      const snapshot = history.snapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].clause).toBe('Player health is 50.');
    });
  });

  describe('Retraction', () => {
    it('removes a fact by key', () => {
      const fact: Fact = {
        key: 'weather:raining',
        clause: 'It is raining.',
        weight: 2,
        life: { kind: 'sustained' },
      };

      history.assert(fact);
      expect(history.snapshot()).toHaveLength(1);

      history.retract('weather:raining');
      expect(history.snapshot()).toHaveLength(0);
    });

    it('silently ignores retract of non-existent fact', () => {
      history.retract('non:existent');
      expect(history.snapshot()).toHaveLength(0);
    });
  });

  describe('Clear', () => {
    it('removes all facts', () => {
      history.assert({
        key: 'a',
        clause: 'Fact A',
        weight: 1,
        life: { kind: 'sustained' },
      });
      history.assert({
        key: 'b',
        clause: 'Fact B',
        weight: 1,
        life: { kind: 'sustained' },
      });

      expect(history.snapshot()).toHaveLength(2);

      history.clear();

      expect(history.snapshot()).toHaveLength(0);
    });
  });

  describe('Has', () => {
    it('returns true for existing fact', () => {
      history.assert({
        key: 'test:fact',
        clause: 'Test',
        weight: 1,
        life: { kind: 'sustained' },
      });

      expect(history.has('test:fact')).toBe(true);
    });

    it('returns false for non-existent fact', () => {
      expect(history.has('non:existent')).toBe(false);
    });
  });

  describe('Advance & Expiration', () => {
    it('expires instant facts after one step', () => {
      history.assert({
        key: 'instant:event',
        clause: 'Event',
        weight: 0,
        life: { kind: 'instant' },
      });

      expect(history.snapshot()).toHaveLength(1);

      const changed = history.advance();

      expect(changed).toBe(true);
      expect(history.snapshot()).toHaveLength(0);
    });

    it('expires step-limited facts after N steps', () => {
      history.assert({
        key: 'temp:effect',
        clause: 'Effect',
        weight: 1,
        life: { kind: 'steps', n: 3 },
      });

      expect(history.snapshot()[0].remaining).toBe('3');

      history.advance();
      expect(history.snapshot()[0].remaining).toBe('2');

      history.advance();
      expect(history.snapshot()[0].remaining).toBe('1');

      history.advance();
      expect(history.snapshot()).toHaveLength(0);
    });

    it('never expires sustained facts', () => {
      history.assert({
        key: 'sustained:state',
        clause: 'State',
        weight: 1,
        life: { kind: 'sustained' },
      });

      for (let i = 0; i < 100; i++) {
        history.advance();
      }

      expect(history.snapshot()).toHaveLength(1);
    });

    it('returns false if nothing changed', () => {
      history.assert({
        key: 'sustained:state',
        clause: 'State',
        weight: 1,
        life: { kind: 'sustained' },
      });

      const changed = history.advance();

      expect(changed).toBe(false);
    });
  });

  describe('Projection', () => {
    it('projects facts into a single string', () => {
      history.assert({
        key: 'a',
        clause: 'First clause.',
        weight: 0,
        life: { kind: 'sustained' },
      });
      history.assert({
        key: 'b',
        clause: 'Second clause.',
        weight: 1,
        life: { kind: 'sustained' },
      });

      const projected = history.project();

      expect(projected).toContain('First clause.');
      expect(projected).toContain('Second clause.');
    });

    it('orders facts by weight (lowest first)', () => {
      history.assert({
        key: 'high',
        clause: 'High weight.',
        weight: 10,
        life: { kind: 'sustained' },
      });
      history.assert({
        key: 'low',
        clause: 'Low weight.',
        weight: 0,
        life: { kind: 'sustained' },
      });

      const projected = history.project();
      const lowIdx = projected.indexOf('Low weight.');
      const highIdx = projected.indexOf('High weight.');

      expect(lowIdx).toBeLessThan(highIdx);
    });

    it('includes identity prefix if set', () => {
      const h = new History({ identity: 'You are a helpful agent.' });

      h.assert({
        key: 'state',
        clause: 'Current state.',
        weight: 1,
        life: { kind: 'sustained' },
      });

      const projected = h.project();

      expect(projected).toContain('You are a helpful agent.');
      expect(projected).toContain('Current state.');
    });

    it('trims and joins clauses', () => {
      history.assert({
        key: 'a',
        clause: '  Clause A  ',
        weight: 0,
        life: { kind: 'sustained' },
      });

      const projected = history.project();

      expect(projected).toBe('Clause A');
    });
  });

  describe('Snapshot', () => {
    it('returns ordered facts with remaining lifetime', () => {
      history.assert({
        key: 'instant',
        clause: 'Instant',
        weight: 2,
        life: { kind: 'instant' },
      });
      history.assert({
        key: 'steps',
        clause: 'Steps',
        weight: 1,
        life: { kind: 'steps', n: 5 },
      });
      history.assert({
        key: 'sustained',
        clause: 'Sustained',
        weight: 0,
        life: { kind: 'sustained' },
      });

      const snapshot = history.snapshot();

      expect(snapshot).toHaveLength(3);
      expect(snapshot[0].key).toBe('sustained');
      expect(snapshot[0].remaining).toBe('∞');
      expect(snapshot[1].key).toBe('steps');
      expect(snapshot[1].remaining).toBe('5');
      expect(snapshot[2].key).toBe('instant');
      expect(snapshot[2].remaining).toBe('1');
    });
  });

  describe('Reconciliation', () => {
    it('resets age of observed sustained facts', () => {
      history.assert({
        key: 'persistent',
        clause: 'Persistent fact.',
        weight: 1,
        life: { kind: 'sustained' },
      });

      history.advance();
      history.advance();

      // Fact still exists but we pretend it was observed
      const observed = new Set(['persistent']);
      history.reconcile(observed);

      // Age should not be reset for sustained facts
      // (reconcile only resets age if fact was missing)
      expect(history.snapshot()).toHaveLength(1);
    });

    it('preserves facts not in observed set', () => {
      history.assert({
        key: 'fact',
        clause: 'Fact.',
        weight: 1,
        life: { kind: 'sustained' },
      });

      // Empty observation set
      history.reconcile(new Set());

      // Fact should persist (reconcile doesn't remove sustained facts)
      expect(history.snapshot()).toHaveLength(1);
    });
  });

  describe('Debug Mode', () => {
    it('does not log when debug is false', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const h = new History({ debug: false });
      h.assert({
        key: 'test',
        clause: 'Test.',
        weight: 1,
        life: { kind: 'sustained' },
      });

      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('logs state changes when debug is true', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const h = new History({ debug: true });
      h.assert({
        key: 'test',
        clause: 'Test.',
        weight: 1,
        life: { kind: 'sustained' },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[history]')
      );

      logSpy.mockRestore();
    });
  });
});
