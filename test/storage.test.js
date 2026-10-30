import { expect } from '@open-wc/testing';
import {
  STORAGE_KEYS,
  clearCredentials,
  clearHistory,
  loadCredentials,
  loadHistory,
  loadSettings,
  saveCredentials,
  saveHistory,
  saveSettings,
} from '../src/services/storage.js';

const credentials = {
  openai: { apiKey: 'sk-openai', model: 'gpt-4o-mini' },
  custom: { apiKey: '', baseUrl: 'http://localhost:1234/v1', model: 'm' },
};

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  after(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('credentials', () => {
    it('returns null when nothing is saved', () => {
      expect(loadCredentials()).to.equal(null);
    });

    it('saves to localStorage by default', () => {
      expect(saveCredentials(credentials)).to.equal(true);
      expect(localStorage.getItem(STORAGE_KEYS.credentials)).to.be.a('string');
      expect(sessionStorage.getItem(STORAGE_KEYS.credentials)).to.equal(null);
      expect(loadCredentials()).to.deep.equal({
        credentials,
        persistence: 'local',
      });
    });

    it('saves to sessionStorage and removes the localStorage copy', () => {
      saveCredentials(credentials, { persistence: 'local' });
      saveCredentials(credentials, { persistence: 'session' });

      expect(localStorage.getItem(STORAGE_KEYS.credentials)).to.equal(null);
      expect(loadCredentials()).to.deep.equal({
        credentials,
        persistence: 'session',
      });
    });

    it('switching back to localStorage removes the sessionStorage copy', () => {
      saveCredentials(credentials, { persistence: 'session' });
      saveCredentials(credentials, { persistence: 'local' });

      expect(sessionStorage.getItem(STORAGE_KEYS.credentials)).to.equal(null);
      expect(loadCredentials()?.persistence).to.equal('local');
    });

    it('clears both storage areas', () => {
      localStorage.setItem(STORAGE_KEYS.credentials, '{"a":{}}');
      sessionStorage.setItem(STORAGE_KEYS.credentials, '{"b":{}}');

      clearCredentials();

      expect(localStorage.getItem(STORAGE_KEYS.credentials)).to.equal(null);
      expect(sessionStorage.getItem(STORAGE_KEYS.credentials)).to.equal(null);
      expect(loadCredentials()).to.equal(null);
    });

    it('ignores corrupted or unexpected data', () => {
      localStorage.setItem(STORAGE_KEYS.credentials, '{not json');
      expect(loadCredentials()).to.equal(null);

      localStorage.setItem(STORAGE_KEYS.credentials, '["array"]');
      expect(loadCredentials()).to.equal(null);
    });
  });

  describe('settings', () => {
    it('round-trips settings through localStorage', () => {
      const settings = { provider: 'anthropic', stream: false };
      expect(saveSettings(settings)).to.equal(true);
      expect(loadSettings()).to.deep.equal(settings);
    });

    it('returns an empty object when missing or invalid', () => {
      expect(loadSettings()).to.deep.equal({});
      localStorage.setItem(STORAGE_KEYS.settings, 'null');
      expect(loadSettings()).to.deep.equal({});
    });
  });

  describe('history', () => {
    it('stores only id, role and content of valid messages', () => {
      saveHistory([
        { id: '1', role: 'user', content: 'Hi', pending: false },
        { id: '2', role: 'assistant', content: 'Hello!', extra: 42 },
        { id: '3', role: 'hacker', content: 'nope' },
        { role: 'user', content: 'missing id' },
      ]);

      expect(loadHistory()).to.deep.equal([
        { id: '1', role: 'user', content: 'Hi' },
        { id: '2', role: 'assistant', content: 'Hello!' },
      ]);
    });

    it('filters invalid entries when loading', () => {
      localStorage.setItem(
        STORAGE_KEYS.history,
        JSON.stringify([
          { id: 'a', role: 'user', content: 'ok' },
          { id: 'b', role: 'user', content: 123 },
          'garbage',
        ]),
      );
      expect(loadHistory()).to.deep.equal([
        { id: 'a', role: 'user', content: 'ok' },
      ]);
    });

    it('returns an empty array when missing or corrupted, and clears', () => {
      expect(loadHistory()).to.deep.equal([]);
      localStorage.setItem(STORAGE_KEYS.history, '{oops');
      expect(loadHistory()).to.deep.equal([]);

      saveHistory([{ id: '1', role: 'user', content: 'Hi' }]);
      clearHistory();
      expect(localStorage.getItem(STORAGE_KEYS.history)).to.equal(null);
    });
  });
});
