# 🚗 Vya — Navegação Urbana Inteligente (Figma Plugin & Web)

> **"Menos complicação. Mais caminho."**  
> Aplicativo de mobilidade e roteamento urbano inspirado no Waze, desenvolvido como protótipo interativo e plugin oficial para o Figma.

---

## 📌 Sobre o Projeto

O **Vya** é uma plataforma interativa de navegação viária projetada para oferecer orientação de rotas de maneira simples, intuitiva e focada na experiência do usuário. 

Nesta versão com foco na região urbana de **Prado Ferreira – PR**, o aplicativo conecta malhas viárias reais via **OpenStreetMap**, utiliza o mecanismo de rotas **OSRM (Open Source Routing Machine)** e integra POIs (pontos de interesse) através da **Overpass API**, permitindo simular navegação curva a curva em tempo real e exportar telas diretamente para o canvas do **Figma**.

---

## 🎨 Como Executar no Figma (Figma Plugin)

O projeto está totalmente configurado para rodar nativamente como **Plugin no Figma** (Desktop ou Web), permitindo testar o app em viewport mobile e interagir diretamente com o Canvas.

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- Figma Desktop ou Figma no Navegador

### 2. Instalação e Compilação
No terminal, dentro da pasta do projeto:
```bash
# 1. Instalar as dependências
npm install

# 2. Compilar o plugin e a interface única (single-file bundle)
npm run build
```

O comando `npm run build` gerará:
- `dist/code.js`: O script sandbox do plugin Figma.
- `dist/index.html`: A aplicação React completa inlined (HTML + JS + CSS).
- `manifest.json`: Manifesto de registro do plugin para o Figma.

### 3. Importar e Rodar no Figma
1. Abra o **Figma**.
2. Clique no ícone do menu do Figma (ou clique com o botão direito no canvas) e navegue até:
   **Plugins > Development > Import plugin from manifest...**
3. Selecione o arquivo `manifest.json` localizado na raiz deste repositório.
4. O plugin **"Vya — Navegação Urbana"** estará disponível na sua lista de plugins de desenvolvimento.
5. Clique no plugin para executá-lo!
6. **Recurso Figma Canvas:** Durante o uso do app, clique no botão **`❖ Canvas`** no topo da tela para instanciar automaticamente um Frame de alta fidelidade com a tela e rota atuais diretamente no seu canvas do Figma!

---

## 🌐 Como Executar no Navegador (Web Local)

Se preferir rodar apenas no navegador como aplicação web tradicional:

```bash
# Iniciar o servidor de desenvolvimento Vite
npm run dev
```

Acesse no navegador:
```
http://localhost:5173
```

---

## 🛠️ Tecnologias Utilizadas

- **Figma Plugin API**: `@figma/plugin-typings` + sandbox com suporte a canvas frames e notifications
- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tools**: [Vite 8](https://vitejs.dev/) + `vite-plugin-singlefile` + [esbuild](https://esbuild.github.io/)
- **Estilização**: [Tailwind CSS 4](https://tailwindcss.com/) + CSS customizado com design tokens
- **Cartografia & Geodados**:
  - [OpenStreetMap](https://www.openstreetmap.org/) (Malha Viária e Geometrias)
  - [OSRM API](http://project-osrm.org/) (Cálculo de rotas de direção)
  - [Overpass API](https://overpass-turbo.eu/) (Extração de estabelecimentos e vias locais)
  - [Nominatim](https://nominatim.org/) (Geocodificação e busca textual)

---

## 📁 Estrutura do Projeto

```text
├── manifest.json           # Manifesto do plugin para o Figma
├── dist/                   # Build compilado pronto para o Figma
│   ├── code.js             # Código sandbox do plugin Figma
│   └── index.html          # Bundle único (HTML + JS + CSS)
├── src/
│   ├── plugin/
│   │   └── code.ts         # Ponto de entrada do Figma Plugin API
│   ├── figmaBridge.ts      # Ponte de comunicação entre React e Figma Canvas
│   ├── App.tsx             # Componente raiz, telas de fluxo e canvas vetorial
│   ├── index.css           # Estilização global, tokens visuais e responsividade
│   ├── main.tsx            # Ponto de entrada React
│   ├── prado-map.json      # Metadados e POIs pré-carregados da cidade
│   ├── routing.ts          # Utilitários de projeção geográfica, OSRM e Overpass
│   └── vite-env.d.ts       # Declarações de tipo do Vite
├── package.json            # Scripts de build para Figma e dependências
├── tsconfig.json           # Configuração do TypeScript com tipos do Figma
└── vite.config.ts          # Configuração do Vite com vite-plugin-singlefile
```

---

© 2026 Vya. Siga a Vya.
