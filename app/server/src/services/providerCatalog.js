// Provider catalog — definitive list of supported LLM providers
// This catalog is exposed via GET /api/llm/providers so the client can fetch it dynamically.

const localProviders = [
  {
    id: 'lmstudio',
    name: 'LM Studio',
    group: 'local',
    defaultUrl: 'http://localhost:1234/v1',
    defaultPort: 1234,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    group: 'local',
    defaultUrl: 'http://localhost:11434/v1',
    defaultPort: 11434,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
    // Ollama also has a native API at /api/tags (different JSON format)
    nativeModelsEndpoint: '/api/tags',
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp server',
    group: 'local',
    defaultUrl: 'http://localhost:8080/v1',
    defaultPort: 8080,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
  },
  {
    id: 'textgen-webui',
    name: 'TextGen WebUI',
    group: 'local',
    defaultUrl: 'http://localhost:5000/v1',
    defaultPort: 5000,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
  },
  {
    id: 'localai',
    name: 'LocalAI',
    group: 'local',
    defaultUrl: 'http://localhost:8080/v1',
    defaultPort: 8080,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
    // Same port as llama.cpp — differentiate by probing /system_stats endpoint
    distinguishEndpoint: '/system_stats',
  },
  {
    id: 'jan',
    name: 'Jan',
    group: 'local',
    defaultUrl: 'http://localhost:1337/v1',
    defaultPort: 1337,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
  },
  {
    id: 'vllm',
    name: 'vLLM',
    group: 'local',
    defaultUrl: 'http://localhost:8000/v1',
    defaultPort: 8000,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
  },
  {
    id: 'custom-local',
    name: 'Custom Local',
    group: 'local',
    defaultUrl: '',
    defaultPort: null,
    requiresApiKey: false,
    openAiCompatible: true,
    modelsEndpoint: '/models',
  },
];

const cloudProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    group: 'cloud',
    defaultUrl: 'https://api.openai.com/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    group: 'cloud',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    group: 'cloud',
    defaultUrl: 'https://api.together.xyz/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    group: 'cloud',
    defaultUrl: 'https://openrouter.ai/api/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    group: 'cloud',
    defaultUrl: 'https://api.mistral.ai/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    group: 'cloud',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    group: 'cloud',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: false,
    warning: 'Anthropic uses a different API format that may not be fully compatible. Consider using OpenRouter to access Claude models via the OpenAI-compatible endpoint.',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    group: 'cloud',
    defaultUrl: 'https://api.x.ai/v1',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    group: 'cloud',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: false,
    warning: 'Google AI Studio uses a different API format that may not be fully compatible. Consider using OpenRouter to access Gemini models via the OpenAI-compatible endpoint.',
  },
  {
    id: 'custom-cloud',
    name: 'Custom Cloud',
    group: 'cloud',
    defaultUrl: '',
    defaultPort: null,
    requiresApiKey: true,
    openAiCompatible: true,
  },
];

function getLocalProviders() {
  return localProviders;
}

function getCloudProviders() {
  return cloudProviders;
}

function getAllProviders() {
  return [...localProviders, ...cloudProviders];
}

function getProviderById(id) {
  return getAllProviders().find((p) => p.id === id) || null;
}

export {
  localProviders,
  cloudProviders,
  getLocalProviders,
  getCloudProviders,
  getAllProviders,
  getProviderById,
};