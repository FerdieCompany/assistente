import "dotenv/config";   // carrega .env

import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===============================
// Prompt base + conhecimento fixo
// ===============================
const systemPrompt = fs.readFileSync("./prompts/system_ptbr.txt", "utf8");
const knowledgeText = fs.readFileSync("./data/conteudo_ferdie.json", "utf8");

// ===============================
// Carrega catálogo JSON (limpo, fiel ao CSV do Wix)
// ===============================
let produtos = [];
try {
  const raw = fs.readFileSync("./catalogo_ferdie_final.json", "utf8");
  const parsed = JSON.parse(raw);
  produtos = Array.isArray(parsed) ? parsed : [];

  produtos = produtos.map((p, i) => {
    const imagem = p.imagem
      ? String(p.imagem).split(";").map(s => s.trim()).filter(Boolean)[0] || null
      : null;

    return {
      id: p.id ?? String(i + 1),
      titulo: String(p.titulo || p.title || "").trim(),
      preco: p.preco ?? p.price ?? null,
      imagem,
      curso: p.curso ?? p.category ?? null,
      tags: Array.isArray(p.tags)
        ? p.tags
        : p.tags
        ? String(p.tags).split(",").map((s) => s.trim())
        : [],
      ...p,
    };
  });

  console.log(`✅ Produtos carregados: ${produtos.length}`);
} catch (err) {
  console.error("⚠️ Erro ao carregar catálogo Ferdie:", err.message);
}

// ===============================
// Funções auxiliares
// ===============================
function sanitize(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function scoreProduto(prod, queryTokens) {
  const titulo = sanitize(prod.titulo);
  const curso = sanitize(prod.curso);
  const tags = (prod.tags || []).map(sanitize).join(" ");
  let score = 0;

  for (const tk of queryTokens) {
    if (!tk) continue;
    if (titulo.includes(tk)) score += 3;
    if (curso && curso.includes(tk)) score += 2;
    if (tags.includes(tk)) score += 1;
  }
  return score;
}

function ranquearProdutosPorQuery(query, max = 24) {
  const q = sanitize(query || "");
  if (!q) return produtos.slice(0, Math.min(max, produtos.length));
  const tokens = q.split(/\s+/).filter((w) => w.length >= 3);

  const scored = produtos
    .map((p) => ({ p, s: scoreProduto(p, tokens) }))
    .filter((o) => o.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((o) => o.p);

  return scored.length
    ? scored
    : produtos.slice(0, Math.min(max, produtos.length));
}

// ===============================
// Endpoints de teste
// ===============================
app.get("/produtos", (req, res) => {
  res.json(produtos);
});

app.get("/produtos/buscar", (req, res) => {
  const q = sanitize(req.query.q || "");
  const resultados = produtos.filter((p) =>
    sanitize(p.titulo).includes(q)
  );
  res.json(resultados);
});

// ===============================
// Rota principal do Assistente
// ===============================
app.post("/assistente", async (req, res) => {
  try {
    const { message: userMessage, history = [] } = req.body || {};
    const firstUserMessage =
      history.find((m) => m.role === "user")?.content || userMessage || "";

    const produtosRelevantes = ranquearProdutosPorQuery(userMessage, 12);

    const listaProdutos = produtosRelevantes
      .map((p) => {
        const partes = [`- ${p.titulo}`];
        if (p.curso) partes.push(`| curso: ${p.curso}`);
        return partes.join(" ");
      })
      .join("\n");

    const messages = [
      {
        role: "system",
        content:
          systemPrompt +
          `\n\nCONHECIMENTO (texto fixo):\n` +
          knowledgeText +
          `\n\nCATÁLOGO FERDIE (produtos disponíveis no site, use estes ao sugerir joias):\n` +
          listaProdutos +
          `\n\nREGRAS PARA PRODUTOS:\n` +
          `- Só sugira itens que estejam nesta lista.\n` +
          `- Use imagem exatamente como está no catálogo, sem inventar.\n`,
      },
      ...history.slice(-6),
      { role: "user", content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || "gpt-4o",
      messages,
      temperature: 0.9,
      max_tokens: 400,
    });

    let text = completion.choices?.[0]?.message?.content?.trim() || "";

    // pega o produto mais relevante da lista para expor imagem direto
    const escolhido = produtosRelevantes[0] || {};
    return res.json({
      reply: text,
      image: escolhido.imagem || null
    });
  } catch (err) {
    console.error("Erro Assistente Ferdie:", err);
    return res.status(500).json({
      reply: "Deu um pequeno nó aqui do meu lado. Posso tentar de novo com calma?",
    });
  }
});

// ===============================
// Boot
// ===============================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Assistente Ferdie online em http://localhost:${PORT}`);
});
