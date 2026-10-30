// src/figmaBridge.ts
// Utilitário para comunicação bidirecional segura entre a interface React e o Figma Plugin

export const isRunningInFigma = (): boolean => {
  return typeof window !== "undefined" && window.parent !== window;
};

export const sendToFigma = (message: { type: string; [key: string]: any }) => {
  if (typeof window !== "undefined" && window.parent) {
    window.parent.postMessage({ pluginMessage: message }, "*");
  }
};

export const figmaNotify = (message: string, isError = false) => {
  if (isRunningInFigma()) {
    sendToFigma({ type: "notify", message, error: isError });
  } else {
    console.log("[Figma Notify]", message);
  }
};

export const figmaCreateCanvasFrame = (title: string, details?: string) => {
  if (isRunningInFigma()) {
    sendToFigma({
      type: "create-canvas-frame",
      title,
      details,
    });
  } else {
    alert(`[Simulação Figma] Frame "${title}" seria criado no Canvas.`);
  }
};
