# Governance & AI Baseline: The Soul of InsightEd

This document serves as the **Single Source of Truth** for the project's vision, core philosophies, and strategic governance.

## 1. Vision & Mission
InsightEd is a mobile-first Progressive Web App (PWA) developed for the **Philippine Department of Education (DepEd)**. 
- **Mission**: Provide a high-integrity, real-time data collection and monitoring system for school infrastructure, enrollment, and resources.
- **Philosophy**: **"Data Health as a Mandate."** The system algorithmically verifies data using advanced statistical models (Fraud Detection).

## 2. Strategic Governance (SIFF)
The **School Initiative Funding & Flow (SIFF)** module is governed by strict business rules:
- **Annual Initialization**: Fund balances set once a year by Central Office.
- **Master List Control**: Initiatives and Activities managed exclusively by Central Office.
- **Transparency Rules**: Variance between planned and actual amounts requires mandatory justification.
- **Gamification**: Accuracy is rewarded with "Transparency Points (XP)."

## 3. Technical Architecture Overview
InsightEd operates on a modern, high-resilience stack designed for offline-first field use.
- **Frontend**: React 19 + Vite + Tailwind CSS.
- **Backend**: Node.js/Express (5.2) + PostgreSQL (Azure/Neon).
- **Offline Capability**: IndexedDB (v13) + Service Workers (Workbox).
- **AI Intelligence**: Google Gemini + LangChain + Localized Ollama (Llama 3) for fraud detection and chatbot support.

## 4. User Roles & Access Control
Access is segmented into high-level role groups to ensure data security and operational focus:
- **Educational Admin**: Super Users / Super Admins (National HROD Portal).
- **Technical/Finance**: National Project Summary and financial oversight.
- **Management**: Region, SDO, and Central Office administrators.
- **Infra Operational**: Engineers, Architects, and Agency partners.
- **School**: School Heads (primary data providers).

---
*Consolidated from: `InsightEd_AI_Baseline_Summary.md`, `Master_Document_SIFF.md`, `CLAUDE.md`, and `README.md`.*
