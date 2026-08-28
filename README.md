<div align="center">

# Zupet Walker

**O app para quem cuida dos pets dos outros.**

Gerencie sua agenda, aceite agendamentos, registre passeios e acompanhe seus ganhos — tudo em um só lugar.

[![Versão](https://img.shields.io/badge/Versão-1.31.0-40E0D0?style=for-the-badge)](#)
[![Android](https://img.shields.io/badge/Android-Bare%20Workflow-A4C639?style=for-the-badge&logo=android&logoColor=white)](#)
[![Expo](https://img.shields.io/badge/Expo-SDK%2053-000020?style=for-the-badge&logo=expo&logoColor=white)](#)

</div>

---

## 🦮 O que é o Zupet Walker?

O Zupet Walker é o app companion do [Zupet](https://zupet.io) para profissionais de cuidado animal. Walkers, cuidadores e adestramento podem gerenciar seus serviços, receber agendamentos de tutores e manter um histórico financeiro organizado.

---

## ✨ Funcionalidades

**📅 Agenda**
Veja e gerencie todos os agendamentos: aceite, recuse ou finalize atendimentos com um toque. Ao aceitar, o registro financeiro é criado automaticamente.

**🏠 Tela Inicial**
Painel com a agenda do dia, solicitações pendentes e acesso rápido às principais ações.

**💰 Financeiro**
Ao finalizar um atendimento, registre o método de pagamento (dinheiro, PIX ou cartão). Histórico completo de recebimentos.

**👤 Meu Perfil Público**
Configure seus serviços, preços, diferenciais, foto e bairro. Tutores encontram você pelo app Zupet.

**🔔 Notificações**
Receba alertas em tempo real quando um tutor solicitar um agendamento.

---

## 🛠 Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React Native + Expo (bare workflow) |
| Navegação | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Estado | Zustand |
| Notificações | Expo Notifications + push via Supabase Edge Function |
| Build Android | Gradle (bare workflow) |

---

## 🚀 Rodando localmente

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npx expo start

# Build Android (debug)
cd android && ./gradlew assembleDebug
```

> **Pré-requisitos:** Node 18+, JDK 17, Android SDK configurado (`ANDROID_HOME`).

---

## 🔗 Projetos relacionados

| Projeto | Descrição |
|---------|-----------|
| [Zupet](https://github.com/eduallochio/Zupet) | App do tutor (React Native) |
| [Zupet Walker Web](https://github.com/eduallochio/Zupet-Walker-Web) | Painel web do walker (Next.js) |

---

<div align="center">

Feito com 🐾 para quem faz a diferença na vida dos pets.

</div>
