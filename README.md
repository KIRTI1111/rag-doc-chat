# Chat with your Document

A full-stack retrieval-augmented generation (RAG) application for uploading PDF documents and asking grounded questions about their content. Answers include the most relevant document excerpts as source citations.

**Live demo:** [chat-with-doc-kirti.vercel.app](https://chat-with-doc-kirti.vercel.app)

## Tech stack

- Next.js App Router, TypeScript, and Tailwind CSS
- AWS S3 for uploaded file storage
- Supabase with pgvector for embeddings and vector similarity search
- Fireworks AI for embeddings and GLM chat completions

## Features

- PDF upload to S3 and server-side text extraction
- Sentence-aware document chunking with overlap
- Embedding generation and storage in Supabase
- Vector similarity search via a Supabase RPC, scoped to the uploaded document
- Document-grounded chat with source citations
- Collapsible sources panel with excerpt and similarity details
- Delete-before-insert de-duplication when a document is re-uploaded

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with these variables:

```dotenv
FIREWORKS_API_KEY=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

3. Configure Supabase with a `document_chunks` table using pgvector and a `match_document_chunks` RPC for similarity search.

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Deployed on Vercel: [chat-with-doc-kirti.vercel.app](https://chat-with-doc-kirti.vercel.app)
