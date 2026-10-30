"use strict";
(() => {
  // src/plugin/code.ts
  figma.showUI(__html__, {
    width: 412,
    height: 732,
    themeColors: true,
    title: "Vya \u2014 Navega\xE7\xE3o Urbana Inteligente"
  });
  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case "notify":
        figma.notify(msg.message || "A\xE7\xE3o executada", {
          timeout: msg.timeout || 3e3,
          error: msg.error || false
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
          const frame = figma.createFrame();
          frame.name = msg.title ? `Vya \u2014 ${msg.title}` : "Vya \u2014 Tela";
          frame.resize(412, 732);
          frame.cornerRadius = 36;
          frame.clipsContent = true;
          frame.fills = [
            {
              type: "SOLID",
              color: { r: 0.96, g: 0.97, b: 0.99 }
              // #F5F7FB
            }
          ];
          await Promise.all([
            figma.loadFontAsync({ family: "Inter", style: "Bold" }),
            figma.loadFontAsync({ family: "Inter", style: "Medium" }),
            figma.loadFontAsync({ family: "Inter", style: "Regular" })
          ]);
          const header = figma.createText();
          header.fontName = { family: "Inter", style: "Bold" };
          header.characters = "\u{1F697} VYA Navega\xE7\xE3o Urbana";
          header.fontSize = 18;
          header.x = 24;
          header.y = 36;
          header.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.15, b: 0.25 } }];
          frame.appendChild(header);
          const subheader = figma.createText();
          subheader.fontName = { family: "Inter", style: "Medium" };
          subheader.characters = msg.title || "Prot\xF3tipo Interativo";
          subheader.fontSize = 14;
          subheader.x = 24;
          subheader.y = 66;
          subheader.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.4, b: 0.55 } }];
          frame.appendChild(subheader);
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
          frame.x = Math.round(figma.viewport.center.x - 206);
          frame.y = Math.round(figma.viewport.center.y - 366);
          figma.currentPage.appendChild(frame);
          figma.viewport.scrollAndZoomIntoView([frame]);
          figma.notify("\u2728 Tela adicionada com sucesso ao Canvas do Figma!");
        } catch (err) {
          figma.notify("N\xE3o foi poss\xEDvel criar o frame no canvas: " + String(err), { error: true });
        }
        break;
      default:
        console.log("[Vya Plugin] Mensagem n\xE3o tratada:", msg);
    }
  };
})();
