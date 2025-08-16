const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai'); // <-- correto

require('dotenv').config();

const app = express();
app.use(express.json());

// 🔹 BLOCO DE CORS ESTENDIDO
app.use(cors({
  origin: '*', // pode trocar por "https://www.ferdie.store"
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Carregar prompt
const promptPath = process.env.PROMPT_PATH || './prompts/system_ptbr.txt';
const systemPrompt = fs.readFileSync(promptPath, 'utf8');
console.log(`[prompt] carregado de ${path.resolve(promptPath)}`);

// Carregar knowledge base
const knowledgePath = './knowledge/base.json';
const knowledgeBase = fs.existsSync(knowledgePath)
  ? JSON.parse(fs.readFileSync(knowledgePath, 'utf8'))
  : {};
console.log(`[knowledge] carregado de ${path.resolve(knowledgePath)}`);

// ✅ Instanciar corretamente o cliente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/assistente', async (req, res) => {
  try {
    const userMessage = req.body.message || "";

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
    });

    res.json({
      reply: completion.choices[0].message.content,
      meta: {
        model: process.env.MODEL || "gpt-4o",
        policy: "apontar_nao_convencer",
        sources_allowed: Object.keys(knowledgeBase)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: String(error) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Assistente Ferdie rodando em http://localhost:${port}`);
});
