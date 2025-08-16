const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');

require('dotenv').config();

const app = express();
app.use(express.json());

// 🔹 Configuração de CORS
app.use(cors({
  origin: '*', // pode trocar para "https://www.ferdie.store"
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Carregar prompt do sistema
const promptPath = process.env.PROMPT_PATH || './prompts/system_ptbr.txt';
const systemPrompt = fs.readFileSync(promptPath, 'utf8');
console.log(`[prompt] carregado de ${path.resolve(promptPath)}`);

// Carregar knowledge base do site (conteúdo do JSON)
const knowledgePath = './knowledge/conteudo_ferdie.json';
const knowledgeBase = fs.existsSync(knowledgePath)
  ? JSON.parse(fs.readFileSync(knowledgePath, 'utf8'))
  : {};
console.log(`[knowledge] carregado de ${path.resolve(knowledgePath)}`);

// ✅ Instanciar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/assistente', async (req, res) => {
  try {
    const userMessage = req.body.message || "";

    // Transformar knowledgeBase em um bloco de contexto
    const knowledgeText = Object.entries(knowledgeBase)
      .map(([url, content]) => `📄 Página: ${url}\n${content}`)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nAqui estão os textos do site Ferdie que você deve usar para responder:\n${knowledgeText}`
        },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    res.json({
      reply,
      meta: {
        model: process.env.MODEL || "gpt-4o",
        policy: "usar_conteudo_site",
        sources_total: Object.keys(knowledgeBase).length
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
