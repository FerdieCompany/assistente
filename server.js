import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import cors from "cors";   // <<< importa cors

const app = express();

// habilita CORS para todas as origens
app.use(cors());           
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/assistente", async (req, res) => {
  try {
    const { message: userMessage, history = [] } = req.body || {};

    // monta mensagens sem system, só histórico + fala do usuário
    const messages = [
      ...history.slice(-6),
      { role: "user", content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || "gpt-4o",
      messages,
      temperature: 0.9,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.5,
      max_tokens: 300
    });

    let text = completion.choices?.[0]?.message?.content?.trim() || "";
    text = text
      .replace(/\*\*|__|`/g, "")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "");

    const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
    if (sentences.length > 4) {
      text = sentences.slice(0, 4).join(" ");
    }

    return res.json({ reply: text });
  } catch (err) {
    console.error("Erro Assistente Ferdie:", err);
    return res.status(500).json({
      reply: "Deu um pequeno nó aqui do meu lado. Posso tentar de novo com calma?"
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Assistente Ferdie online");
});
