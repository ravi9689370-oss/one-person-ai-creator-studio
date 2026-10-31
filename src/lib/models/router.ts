export interface Model {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  capabilities: string[];
  free: boolean;
  status: 'active' | 'inactive';
}

export const models: Model[] = [
  // Kilo Gateway / Auto
  { id: 'kilo-auto/free', name: 'Auto Free', provider: 'kilo', contextLength: 128000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
  
  // OpenCode Models
  { id: 'opencode/glm-5.3-flash:free', name: 'GLM-5.3 Flash (OpenCode)', provider: 'opencode', contextLength: 200000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
  { id: 'opencode/deepseek-chat-v3:free', name: 'DeepSeek Chat V3 (OpenCode)', provider: 'opencode', contextLength: 164000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
  { id: 'opencode/deepseek-v4.1-flash:free', name: 'DeepSeek V4.1 Flash (OpenCode)', provider: 'opencode', contextLength: 164000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
  { id: 'opencode/flint:free', name: 'Flint (OpenCode)', provider: 'opencode', contextLength: 128000, capabilities: ['chat', 'coding'], free: true, status: 'active' },
  { id: 'opencode/beam:free', name: 'Beam (OpenCode)', provider: 'opencode', contextLength: 128000, capabilities: ['chat', 'coding'], free: true, status: 'active' },
  { id: 'opencode/mimo-v2.6-flash:free', name: 'MiMo-V2.6-Flash (OpenCode)', provider: 'opencode', contextLength: 128000, capabilities: ['chat', 'coding'], free: true, status: 'active' },
  
  // Kimi Models
  { id: 'moonshotai/kimi-k2:free', name: 'Kimi K2', provider: 'moonshotai', contextLength: 128000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
  { id: 'moonshotai/kimi-k3:free', name: 'Kimi K3', provider: 'moonshotai', contextLength: 256000, capabilities: ['chat', 'coding', 'tools', 'reasoning'], free: true, status: 'active' },
  { id: 'moonshotai/kimi-1.5:free', name: 'Kimi 1.5 (Free)', provider: 'moonshotai', contextLength: 128000, capabilities: ['chat', 'coding'], free: true, status: 'active' },
  
  // OpenRouter Free Models
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'google', contextLength: 1000000, capabilities: ['chat', 'coding', 'image', 'tools'], free: true, status: 'active' },
  { id: 'deepseek-chat-v3-0324:free', name: 'DeepSeek Chat V3', provider: 'openrouter', contextLength: 164000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B', provider: 'nvidia', contextLength: 128000, capabilities: ['chat', 'coding'], free: true, status: 'active' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'meta', contextLength: 128000, capabilities: ['chat'], free: true, status: 'active' },
  { id: 'qwen/qwen2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B', provider: 'qwen', contextLength: 128000, capabilities: ['chat', 'coding', 'tools'], free: true, status: 'active' },
];

export class ModelRouter {
  static getBestModel(task: 'coding' | 'chat' | 'research' | 'reasoning' = 'chat'): Model {
    if (task === 'coding') {
      return models.find(m => m.name.toLowerCase().includes('coder') || m.name.toLowerCase().includes('deepseek')) || models[0];
    }
    if (task === 'reasoning') {
      return models.find(m => m.name.toLowerCase().includes('kimi') && m.name.includes('K3')) || models[7];
    }
    return models[0]; // Auto
  }
  
  static getModels() {
    return models;
  }
  
  static getModelsByProvider(provider: string) {
    return models.filter(m => m.provider === provider);
  }
}
