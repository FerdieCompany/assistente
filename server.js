import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Config --------------------
const PORT = process.env.PORT || 8080;
const MODEL = process.env.MODEL || 'gpt-4o';
const PROMPT_PATH = process.env.PROMPT_PATH
  ? path.resolve(process.env.PROMPT_PATH)
  : path.join(__dirname, 'prompts', 'system_ptbr.txt');

const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge', 'base.json');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------------------- Leitura de arquivos --------------------
let SYSTEM_PROMPT = '';
function loadPrompt() {
  try {
    SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf-8');
    console.log('[prompt] carregado de', PROMPT_PATH);
  } catch (e) {
    console.warn('[prompt] não foi possível ler', PROMPT_PATH, '->', e.message);
    SYSTEM_PROMPT = 'Você é o Assistente Ferdie. Responda com educação, brevidade e sem vender.';
  }
}
loadPrompt();

// recarrega automaticamente quando o arquivo do prompt mudar
fs.watchFile(PROMPT_PATH, { interval: 1000 }, () => {
  try {
    loadPrompt();
    console.log('[prompt] recarregado');
  } catch {}
});

let knowledgeBase = {};
function loadKnowledge() {
  try {
    const raw = fs.readFileSync(KNOWLEDGE_PATH, 'utf-8');
    knowledgeBase = JSON.parse(raw);
    console.log('[knowledge] carregado de', KNOWLEDGE_PATH);
  } catch (e) {
    console.error('[knowledge] erro ao ler JSON:', e.message);
    knowledgeBase = {};
  }
}
loadKnowledge();

// recarrega automaticamente quando a base mudar
fs.watchFile(KNOWLEDGE_PATH, { interval: 1000 }, () => {
  try {
    loadKnowledge();
    console.log('[knowledge] recarregado');
  } catch {}
});

// -------------------- App --------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

// Endpoint principal do assistente
app.post('/assistente', async (req, res) => {
  try {
    const userMessage = String(req.body?.message ?? '').slice(0, 4000);
    if (!userMessage) {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    // Mensagens para o modelo — 100% contidas e curadas
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content:
          'knowledge_base (JSON a seguir). Use somente estes conteúdos e links:\n' +
          JSON.stringify(knowledgeBase, null, 2)
      },
      { role: 'user', content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 450
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      '...';

    res.json({
      reply,
      meta: {
        model: MODEL,
        policy: 'apontar_nao_convencer',
        sources_allowed: Object.keys(knowledgeBase)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Falha ao gerar resposta.',
      detail: String(err?.message || err)
    });
  }
});

// -------------------- Start --------------------
app.listen(PORT, () => {
  console.log(`Assistente Ferdie rodando em http://localhost:${PORT}`);
});
