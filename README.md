# ARC ALPHA API

Wallet-funded AI intelligence infrastructure built on Arc Testnet.

Arc Alpha is a crypto-native AI API platform for:
- prepaid intelligence credits
- wallet-linked API access
- token risk analysis
- usage-based billing
- agent-oriented infrastructure

## Features

- Arc Testnet wallet integration
- Onchain deposit credits
- AI token analysis
- Wallet-linked API keys
- Usage-based billing
- Transaction ledger
- DexScreener intelligence
- Risk scoring engine

## Architecture

```txt
Wallet
  ↓
Deposit Credits
  ↓
Prisma Ledger
  ↓
API Key Access
  ↓
AI Analyze Endpoint
  ↓
Usage Billing
```

## Stack

### Frontend
- Next.js
- TypeScript
- TailwindCSS

### Backend
- Next.js API Routes
- Prisma ORM
- Supabase Postgres

### Web3
- Arc Testnet
- MetaMask

### Intelligence
- DexScreener API
- Risk engine
- AI summary layer

## API

### Analyze Token

`POST /api/agent/analyze`

```json
{
  "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

Header:

```txt
x-api-key: arc_xxxxxxxxx
```

## Production

https://arc-alpha-api.vercel.app

## Status

- Production deployed on Vercel
- Supabase + Prisma backend
- Wallet-funded credits
- AI token analysis
- Usage billing system
- Arc Testnet integration

## Roadmap

- Analytics dashboard
- LLM integration
- Rate limiting
- Autonomous agents
- Stablecoin settlement
