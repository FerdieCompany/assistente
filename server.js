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

// 🔗 MAPA DE LINKS JSON → URLs reais do site Ferdie
const linksMap = {
  JSON_home: "https://www.ferdie.store/",
  JSON_curadoria: "https://www.ferdie.store/curadoriaferdie",
  JSON_gift: "https://www.ferdie.store/gift-card",
  JSON_blog: "https://www.ferdie.store/blogferdiecompany",
  JSON_argentea: "https://www.ferdie.store/argenteaferdiecompany",
  JSON_presentes: "https://www.ferdie.store/presentesferdie",
  JSON_gradus: "https://www.ferdie.store/gradusferdie",
  JSON_turmalina: "https://www.ferdie.store/turmalinaparaiba",
  JSON_aurora: "https://www.ferdie.store/colecaoauroraboreal",
  JSON_sobre: "https://www.ferdie.store/aferdie",
  JSON_autenticidade: "https://www.ferdie.store/autenticiadeferdie",
  JSON_privacidade: "https://www.ferdie.store/privacidadeferdie",
  JSON_formatos: "https://www.ferdie.store/tabeladearosabntvisual",
  JSON_contato: "https://www.ferdie.store/contatoferdie",
  JSON_envio: "https://www.ferdie.store/envio-e-devolu%C3%A7%C3%B5es"
};

// Função para substituir [link JSON_xxx](#) → [Título bonito](URL real)
function substituirLinks(texto) {
  return texto.replace(/\[link JSON_(\w+)\]\(#\)/g, (match, key) => {
    const url = linksMap[`JSON_${key}`];
    if (!url) return match; // se não achar, mantém como estava
    let titulo = "Página Ferdie";
    switch (`JSON_${key}`) {
      case "JSON_formatos": titulo = "Tabela ABNT"; break;
      case "JSON_envio": titulo = "Envios e Devoluções"; break;
      case "JSON_presentes": titulo = "Seleção de Presentes"; break;
      case "JSON_gift": titulo = "Gift Card"; break;
      case "JSON_gradus": titulo = "Joias de Formatura"; break;
      case "JSON_turmalina": titulo = "Turmalina Paraíba"; break;
      case "JSON_aurora": titulo = "Coleção Aurora Boreal"; break;
      case "JSON_curadoria": titulo = "Curadoria Ferdie"; break;
      case "JSON_argentea": titulo = "Argentea Ferdie"; break;
      case "JSON_autenticidade": titulo = "Certificado de Autenticidade"; break;
      case "JSON_privacidade": titulo = "Política de Privacidade"; break;
      case "JSON_contato": titulo = "Contato"; break;
      case "JSON_sobre": titulo = "Sobre a Ferdie"; break;
      case "JSON_blog": titulo = "Blog Ferdie"; break;
      case "JSON_home": titulo = "Início"; break;
    }
    return `[${titulo}](${url})`;
  });
}

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

    let reply = completion.choices[0].message.content;
    reply = substituirLinks(reply);

    res.json({
      reply,
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
