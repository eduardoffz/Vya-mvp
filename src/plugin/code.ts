// src/plugin/code.ts
// Este arquivo roda dentro do ambiente protegido (sandbox) do Figma Plugin API

// Exibe a interface gráfica do Vya com tamanho mobile otimizado
figma.showUI(__html__, {
  width: 412,
  height: 732,
  themeColors: true,
  title: "Vya — Navegação Urbana Inteligente",
});

// Receptor de mensagens enviadas pela interface React (via parent.postMessage)
figma.ui.onmessage = async (msg: { type: string; [key: string]: any }) => {
  switch (msg.type) {
    case "notify":
      figma.notify(msg.message || "Ação executada", {
        timeout: msg.timeout || 3000,
        error: msg.error || false,
      });
      break;

    case "close":
      figma.closePlugin();
      break;

    case "resize":
      if (typeof msg.width === "number" && typeof msg.height === "number") {
        figma.ui.resize(msg.width, msg.height);
      }
      break;

    case "create-canvas-frame":
      try {
        // Cria um Frame representando a tela atual do Vya no canvas do Figma
        const frame = figma.createFrame();
        frame.name = msg.title ? `Vya — ${msg.title}` : "Vya — Tela";
        frame.resize(412, 732);
        frame.cornerRadius = 36;
        frame.clipsContent = true;
        frame.fills = [
          {
            type: "SOLID",
            color: { r: 0.96, g: 0.97, b: 0.99 }, // #F5F7FB
          },
        ];

        // Carrega fontes padrões do Figma
        await Promise.all([
          figma.loadFontAsync({ family: "Inter", style: "Bold" }),
          figma.loadFontAsync({ family: "Inter", style: "Medium" }),
          figma.loadFontAsync({ family: "Inter", style: "Regular" }),
        ]);

        // Cabeçalho no frame
        const header = figma.createText();
        header.fontName = { family: "Inter", style: "Bold" };
        header.characters = "🚗 VYA Navegação Urbana";
        header.fontSize = 18;
        header.x = 24;
        header.y = 36;
        header.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.15, b: 0.25 } }];
        frame.appendChild(header);

        // Subtítulo / Rota
        const subheader = figma.createText();
        subheader.fontName = { family: "Inter", style: "Medium" };
        subheader.characters = msg.title || "Protótipo Interativo";
        subheader.fontSize = 14;
        subheader.x = 24;
        subheader.y = 66;
        subheader.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.4, b: 0.55 } }];
        frame.appendChild(subheader);

        // Detalhes extras se fornecidos (ex: distância, tempo, rota)
        if (msg.details) {
          const detailsText = figma.createText();
          detailsText.fontName = { family: "Inter", style: "Regular" };
          detailsText.characters = msg.details;
          detailsText.fontSize = 12;
          detailsText.x = 24;
          detailsText.y = 96;
          detailsText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.35 } }];
          frame.appendChild(detailsText);
        }

        // Posiciona no centro da visualização atual
        frame.x = Math.round(figma.viewport.center.x - 206);
        frame.y = Math.round(figma.viewport.center.y - 366);

        figma.currentPage.appendChild(frame);
        figma.viewport.scrollAndZoomIntoView([frame]);
        figma.notify("✨ Tela adicionada com sucesso ao Canvas do Figma!");
      } catch (err: any) {
        figma.notify("Não foi possível criar o frame no canvas: " + String(err), { error: true });
      }
      break;

    default:
      console.log("[Vya Plugin] Mensagem não tratada:", msg);
  }
};
