import { describe, it, expect } from 'vitest';
import {
  getLocalProviders,
  getCloudProviders,
  getAllProviders,
  getProviderById,
} from '../../../src/services/providerCatalog.js';

describe('providerCatalog', () => {
  describe('getLocalProviders()', () => {
    it('returns an array of local providers', () => {
      const providers = getLocalProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('returns 8 local providers', () => {
      const providers = getLocalProviders();
      expect(providers.length).toBe(8);
    });

    it('each provider has required fields', () => {
      const providers = getLocalProviders();
      for (const p of providers) {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('group', 'local');
        expect(p).toHaveProperty('defaultUrl');
        expect(p).toHaveProperty('requiresApiKey', false);
        expect(p).toHaveProperty('openAiCompatible', true);
      }
    });

    it('includes expected provider ids', () => {
      const providers = getLocalProviders();
      const ids = providers.map((p) => p.id);
      expect(ids).toContain('lmstudio');
      expect(ids).toContain('ollama');
      expect(ids).toContain('llamacpp');
      expect(ids).toContain('custom-local');
    });
  });

  describe('getCloudProviders()', () => {
    it('returns an array of cloud providers', () => {
      const providers = getCloudProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('returns 10 cloud providers', () => {
      const providers = getCloudProviders();
      expect(providers.length).toBe(10);
    });

    it('each provider requires an API key', () => {
      const providers = getCloudProviders();
      for (const p of providers) {
        expect(p.group).toBe('cloud');
        expect(p.requiresApiKey).toBe(true);
      }
    });

    it('includes expected provider ids', () => {
      const providers = getCloudProviders();
      const ids = providers.map((p) => p.id);
      expect(ids).toContain('openai');
      expect(ids).toContain('groq');
      expect(ids).toContain('anthropic');
      expect(ids).toContain('custom-cloud');
    });
  });

  describe('getAllProviders()', () => {
    it('returns combined list of local and cloud providers', () => {
      const all = getAllProviders();
      const local = getLocalProviders();
      const cloud = getCloudProviders();
      expect(all.length).toBe(local.length + cloud.length);
    });

    it('total is 18 providers', () => {
      const all = getAllProviders();
      expect(all.length).toBe(18);
    });
  });

  describe('getProviderById()', () => {
    it('returns provider for valid local id', () => {
      const provider = getProviderById('ollama');
      expect(provider).toBeDefined();
      expect(provider!.id).toBe('ollama');
      expect(provider!.name).toBe('Ollama');
      expect(provider!.group).toBe('local');
    });

    it('returns provider for valid cloud id', () => {
      const provider = getProviderById('openai');
      expect(provider).toBeDefined();
      expect(provider!.id).toBe('openai');
      expect(provider!.name).toBe('OpenAI');
      expect(provider!.group).toBe('cloud');
      expect(provider!.requiresApiKey).toBe(true);
    });

    it('returns null for nonexistent id', () => {
      const provider = getProviderById('nonexistent-provider-xyz');
      expect(provider).toBeNull();
    });

    it('returns provider with correct openAiCompatible flag', () => {
      // Anthropic is NOT OpenAI compatible
      const anthropic = getProviderById('anthropic');
      expect(anthropic!.openAiCompatible).toBe(false);

      // OpenAI IS compatible
      const openai = getProviderById('openai');
      expect(openai!.openAiCompatible).toBe(true);
    });
  });
});