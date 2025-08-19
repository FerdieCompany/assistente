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

    // Recupera último produto salvo no histórico (se houver)
    let ultimoProduto = null;
    if (history.length) {
      const ultima = history[history.length - 1];
      if (ultima.produtoId) {
        ultimoProduto = produtos.find(p => p.id === ultima.produtoId) || null;
      }
    }

    // Busca candidatos pelo texto
    const produtosRelevantes = ranquearProdutosPorQuery(userMessage, 12);

    // Detecta se pergunta é genérica (sem nome, tipo “esse anel”, “qual o valor”)
    const perguntaGenerica = /(preço|valor|quanto|esse|essa|quanto custa)/i.test(userMessage);

    // Regra: se for genérica → responde sobre o último produto
    let escolhido = null;
    if (perguntaGenerica && ultimoProduto) {
      escolhido = ultimoProduto;
    } else {
      // Senão, tenta achar pelo match no texto
      for (const p of produtosRelevantes) {
        if (userMessage.toLowerCase().includes(p.titulo.toLowerCase())) {
          escolhido = p;
          break;
        }
      }
      if (!escolhido) escolhido = produtosRelevantes[0] || null;
    }

    // Monta contexto para o modelo
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
          `\n\nCATÁLOGO FERDIE:\n` +
          listaProdutos +
          `\n\nREGRAS:\n` +
          `- Só sugira itens da lista.\n` +
          `- Sempre cite o nome exato.\n` +
          `- Se usuário perguntar preço/valor de "esse", responda sobre o último produto escolhido.\n`,
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

    // ✅ Força preço real do catálogo quando for pergunta genérica
    if (perguntaGenerica && escolhido) {
      text = `O último produto sugerido foi o **${escolhido.titulo}**, e seu preço é de R$ ${escolhido.preco}. Uma expressão de beleza única.`;
    }

    // Responde e devolve id do produto para salvar no histórico do frontend
    return res.json({
      reply: text,
      image: escolhido?.imagem || null,
      produtoId: escolhido?.id || null,
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
