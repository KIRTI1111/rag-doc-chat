import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Step 1: turn a PDF buffer into plain text
export async function extractText(fileBuffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
  const { text } = await unpdfExtractText(pdf, { mergePages: true });
  return text;
}

// Step 2: split long text into smaller chunks

// Step 2: split long text into smaller chunks, respecting sentence boundaries
export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 150,
): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];

  const chunks: string[] = [];
  let currentSentences: string[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    if (
      currentLength + sentence.length > chunkSize &&
      currentSentences.length > 0
    ) {
      chunks.push(currentSentences.join("").trim());

      // Build overlap using whole sentences from the tail of the chunk just pushed
      const overlapSentences: string[] = [];
      let overlapLength = 0;
      for (
        let i = currentSentences.length - 1;
        i >= 0 && overlapLength < overlap;
        i--
      ) {
        overlapSentences.unshift(currentSentences[i]);
        overlapLength += currentSentences[i].length;
      }

      currentSentences = [...overlapSentences, sentence];
      currentLength = overlapLength + sentence.length;
    } else {
      currentSentences.push(sentence);
      currentLength += sentence.length;
    }
  }

  if (currentSentences.length > 0) {
    chunks.push(currentSentences.join("").trim());
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

// Step 3: get an embedding for one chunk of text
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    "https://api.fireworks.ai/inference/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "fireworks/qwen3-embedding-8b",
        input: text,
        dimensions: 768,
      }),
    },
  );

  const data = await response.json();
  return data.data[0].embedding;
}

// Step 4: process a whole document — chunk it, embed each chunk, save to Supabase
export async function processDocument(fileBuffer: Buffer, fileKey: string) {
  const text = await extractText(fileBuffer);
  const chunks = chunkText(text);
  console.log("Chunks created:", chunks.length);

  // Remove any previously stored chunks for this file before inserting fresh ones
  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("file_key", fileKey);

  if (deleteError) {
    console.error("SUPABASE DELETE ERROR:", deleteError);
    throw new Error(`Failed to clear old chunks: ${deleteError.message}`);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await getEmbedding(chunk);

    const { error } = await supabase.from("document_chunks").insert({
      file_key: fileKey,
      content: chunk,
      embedding,
      chunk_index: i,
    });

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      throw new Error(`Supabase insert failed: ${error.message}`);
    }
  }

  return { chunkCount: chunks.length };
}
