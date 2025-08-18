import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import fs from "fs";
import cors from "cors";

const app = express();

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Carrega prompt base e conhecimento (conteúdo real do site já consolidado no JSON)
const systemPrompt = fs.readFileSync("./prompts/system_ptbr.txt", "utf8");
const knowledgeText = fs.readFileSync("./data/conteudo_ferdie.json", "utf8");

const styles = [
  "Escreva como um bilhete carinhoso.",
  "Use um sopro de poesia, sem exagero.",
  "Voz serena, poucas palavras e imagens de luz.",
  "Tons de carta íntima, discreta e honesta.",
  "Respire calma; diga menos, com precisão.",
  "Fale como quem serve um chá e escuta."
];

function buildToneCalibrator(firstMessage) {
  if (!firstMessage) return "";
  return `\n\nAFINADOR DE TOM (derivado da 1ª mensagem do cliente):\n` +
         `- Use um tom que combine com: "${firstMessage.slice(0, 240)}"\n` +
         `- Espelhe o ritmo e as palavras-chave do cliente.\n` +
         `- Se houver emoção explícita (alegria, ansiedade, pressa), reconheça-a brevemente.\n`;
}

app.post("/assistente", async (req, res) => {
  try {
    const { message: userMessage, history = [] } = req.body || {};

    const firstUserMessage =
      history.find((m) => m.role === "user")?.content || userMessage || "";

    const styleHint = styles[Math.floor(Math.random() * styles.length)];
    const toneCalibrator = buildToneCalibrator(firstUserMessage);

    const messages = [
      {
        role: "system",
        content:
          systemPrompt +
          `\n\nHINT DE ESTILO: ${styleHint}` +
          toneCalibrator +
          `\n\nCONHECIMENTO (JSON Ferdie):\n` +
          knowledgeText
      },
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
