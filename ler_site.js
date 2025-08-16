// ler_site.js
const fs = require("fs");
const path = require("path");
const playwright = require("playwright");

// Lista das páginas principais Ferdie
const urls = [
  "https://www.ferdie.store/",
  "https://www.ferdie.store/curadoriaferdie",
  "https://www.ferdie.store/gift-card",
  "https://www.ferdie.store/blogferdiecompany",
  "https://www.ferdie.store/argenteaferdiecompany",
  "https://www.ferdie.store/presentesferdie",
  "https://www.ferdie.store/gradusferdie",
  "https://www.ferdie.store/turmalinaparaiba",
  "https://www.ferdie.store/colecaoauroraboreal",
  "https://www.ferdie.store/aferdie",
  "https://www.ferdie.store/autenticiadeferdie",
  "https://www.ferdie.store/privacidadeferdie",
  "https://www.ferdie.store/tabeladearosabntvisual",
  "https://www.ferdie.store/contatoferdie",
  "https://www.ferdie.store/envio-e-devolu%C3%A7%C3%B5es"
];

async function run() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const data = {};

  for (const url of urls) {
    console.log(`🔎 Lendo página: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Captura apenas o texto visível
    const content = await page.evaluate(() => {
      return document.body.innerText;
    });

    data[url] = content.trim().replace(/\s+/g, " ");
  }

  await browser.close();

  // Salva em knowledge/conteudo_ferdie.json
  const outputPath = path.join(__dirname, "knowledge", "conteudo_ferdie.json");
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`✅ Conteúdo salvo em ${outputPath}`);
}

run();
