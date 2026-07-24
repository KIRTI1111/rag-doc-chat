import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmbedding } from "@/lib/rag";

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { question, fileKey } = await req.json();

    if (!question || !fileKey) {
      return NextResponse.json(
        { error: "question and fileKey are required" },
        { status: 400 },
      );
    }

    const queryEmbedding = await getEmbedding(question);

    const { data: chunks, error } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: queryEmbedding,
        match_file_key: fileKey,
        match_count: 4,
      },
    );

    if (error) {
      return NextResponse.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 },
      );
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: "No document chunks found for this file" },
        { status: 404 },
      );
    }

    const context = chunks
      .map((c: any) => `[Source ${c.chunk_index + 1}]: ${c.content}`)
      .join("\n\n");

    const response = await fetch(FIREWORKS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIREWORKS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/glm-5p2",
        messages: [
          {
            role: "system",
            content:
              "You answer questions using only the provided document context. If the answer is not in the context, say you cannot find it in the document. Reference sources like (Source 1) when relevant. Respond in plain text only. Do not use Markdown, headings, bullet syntax, or bold formatting.",
          },
          {
            role: "user",
            content: `Document context:\n\n${context}\n\nQuestion: ${question}`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Fireworks API error: ${errText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      answer,
      sources: chunks.map((c: any) => ({
        label: `Source ${c.chunk_index + 1}`,
        content: c.content,
        similarity: c.similarity,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
