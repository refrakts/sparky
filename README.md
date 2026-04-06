# Sparky

AI-powered Spark blockchain explorer. Ask natural language questions and get dynamically composed dashboards — tables, charts, flow diagrams — rendered from live API data.

Live app: https://sparkyai.space

## Prerequisites

- **Node.js** 18.18+ (recommended: 20+)
- **npm** 9+

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/refrakts/sparky.git
cd sparky
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_GATEWAY_API_KEY` | Yes | — | Vercel AI Gateway API key |
| `SPARKSCAN_API_URL` | No | `https://api.sparkscan.io` | Sparkscan API base URL |

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

```bash
npm run build
npm start
```

## Tech stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **Vercel AI SDK** + Vercel AI Gateway
- **json-render** for AI-composed dynamic dashboard layouts
- **shadcn/ui** component library
- **Recharts v3** (via shadcn Chart) for charts
- **React Flow** (@xyflow/react) for transaction flow diagrams
- **TanStack Table** + **TanStack Query** + **nuqs** for paginated data tables

## Project structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── api/chat/         # AI SDK streamText endpoint
│   ├── layout.tsx        # Root layout with providers
│   ├── page.tsx          # Main page
│   └── providers.tsx     # QueryClient + nuqs + Tooltip providers
├── lib/
│   ├── api.ts            # API client (network=MAINNET hardcoded)
│   ├── types.ts          # TypeScript types for all API responses
│   ├── formatters.ts     # Number/date/address formatting utilities
│   └── utils.ts          # shadcn cn() utility
└── components/
    ├── tables/
    │   ├── cell-renderers.tsx   # 15 cell renderer components
    │   └── column-inference.ts  # Auto-infer columns from API data
    └── ui/               # shadcn components
```

## Security

- `network=MAINNET` is **always hardcoded** in the API client layer — the LLM never controls it
- The AI outputs structured JSON specs validated against a Zod catalog — no code generation
- All data is public blockchain data
