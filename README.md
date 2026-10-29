# 🚗 Vya — Navegação Urbana Inteligente

> **"Menos complicação. Mais caminho."**  
> Aplicativo de mobilidade e roteamento urbano inspirado no Waze, desenvolvido a partir de protótipo de alta fidelidade no Figma.

---

## 📌 Sobre o Projeto

O **Vya** é uma plataforma interativa de navegação viária projetada para oferecer orientação de rotas de maneira simples, intuitiva e focada na experiência do usuário. 

Nesta versão inicial com foco na região urbana de **Prado Ferreira – PR**, o aplicativo conecta malhas viárias reais via **OpenStreetMap**, utiliza o mecanismo de rotas **OSRM (Open Source Routing Machine)** e integra POIs (pontos de interesse) através da **Overpass API**.

---

## 🗺️ Roadmap de Desenvolvimento e Sprints

O planejamento e a evolução do produto são guiados pelo User Story Mapping estruturado no Figma/FigJam:

### 🔴 Sprint 1 — MVP (Concluído)
- [x] **Acesso Rápido**: Abertura do app e entrada direta como visitante (*"Entrar sem conta"*).
- [x] **Permissão e GPS**: Solicitação de permissão de geolocalização com fallback para o centro urbano.
- [x] **Posicionamento no Mapa**: Identificação da posição do usuário em até 5 segundos.
- [x] **Busca de Endereços**: Campo de pesquisa de ruas e seleção de destinos via Nominatim/OSM.
- [x] **Roteamento Viário**: Traçado de rotas pelas ruas com indicação visual de trajeto, distância em quilômetros (km) e tempo estimado (min).
- [x] **Simulação de Navegação**: Acompanhamento passo a passo da rota com instruções de manobras e velocímetro simulado.

### 🟡 Sprint 2 — Gestão, Atalhos e Preferências (Foco Atual)
- [ ] **Autenticação de Usuários**:
  - Cadastro com e-mail e senha.
  - Acesso facilitado com *Continuar com Google*.
  - Tela de login e controle de perfil de usuário.
- [ ] **Localização & GPS**:
  - Detecção ativa e alerta contextual para ativar o GPS quando estiver desativado.
- [ ] **Busca & Destino**:
  - Sugestões reativas em tempo real durante a digitação de destinos.
  - Atalhos rápidos personalizáveis para **Casa** e **Trabalho** (estilo Waze).
  - Filtro e pesquisa por estabelecimentos cadastrados e categorias de POIs (postos, mercados, alimentação, etc.).
- [ ] **Preferências de Rota**:
  - Opção para evitar pedágios ou estradas de terra.
  - Exibição prévia de pedágios existentes no trajeto e estimativa de tarifas.

### 🟢 Sprint 3 — Recursos Avançados
- [ ] Trânsito em tempo real e atualização dinâmica da estimativa de chegada.
- [ ] Modo Noturno (Dark Mode) automático e manual.
- [ ] Recuperação de senha por e-mail.
- [ ] Destino por comando de voz.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6+](https://vitejs.dev/)
- **Estilização**: [Tailwind CSS 4](https://tailwindcss.com/) + CSS customizado com design tokens do Figma
- **Cartografia & Geodados**:
  - [OpenStreetMap](https://www.openstreetmap.org/) (Tiles e Malha Viária)
  - [OSRM API](http://project-osrm.org/) (Cálculo de rotas de direção)
  - [Overpass API](https://overpass-turbo.eu/) (Extração de estabelecimentos e vias locais)
  - [Nominatim](https://nominatim.org/) (Geocodificação e busca textual)

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior
- Gerenciador de pacotes `npm` ou `pnpm`

### Instalação e Execução

1. Clone o repositório e acesse a pasta do projeto:
```bash
git clone https://github.com/eduardoffz/Vya-mvp.git
cd Vya-mvp
git checkout t1
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Abra no navegador:
```
http://localhost:5173
```

---

## 📁 Estrutura do Projeto

```text
├── public/                 # Favicon e tiles de mapa locais
├── src/
│   ├── App.tsx             # Componente raiz, telas de fluxo e canvas interativo
│   ├── index.css           # Estilização global, tokens visuais e responsividade
│   ├── main.tsx            # Ponto de entrada React
│   ├── prado-map.json      # Metadados e POIs pré-carregados da cidade
│   ├── routing.ts          # Utilitários de projeção geográfica, OSRM e Overpass
│   └── vite-env.d.ts       # Declarações de tipo do Vite
├── index.html              # Shell HTML
├── package.json            # Dependências e scripts
├── tsconfig.json           # Configuração do TypeScript
└── vite.config.ts          # Configuração do Vite e plugins
```

---

© 2026 Vya. Siga a Vya.

