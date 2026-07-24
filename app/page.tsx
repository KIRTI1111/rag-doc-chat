"use client";

import { useState } from "react";

type Source = {
  label: string;
  content: string;
  similarity: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadedFileKey, setUploadedFileKey] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [openSourcesIndex, setOpenSourcesIndex] = useState<number | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStatus("idle");
      setUploadedFileKey(null);
      setMessages([]);
    }
  }

  function handleUpload() {
    if (!selectedFile) return;
    setStatus("uploading");

    const formData = new FormData();
    formData.append("file", selectedFile);

    fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Server responded:", data);
        setStatus("success");
        setUploadedFileKey(data.key);
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
      });
  }

  function handleAskQuestion() {
    if (!question.trim() || !uploadedFileKey) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsAsking(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, fileKey: uploadedFileKey }),
    })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Chat request failed");
        }

        return data;
      })
      .then((data) => {
        const reply: Message = {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        };
        setMessages((prev) => [...prev, reply]);
      })
      .catch((err) => {
        console.error(err);
        const reply: Message = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, reply]);
      })
      .finally(() => setIsAsking(false));
  }

  return (
    <main className="p-10 font-sans max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Chat with your Document</h1>
      <p className="text-gray-600 mb-6">Upload a PDF and ask questions about it.</p>

      <input type="file" accept="application/pdf" onChange={handleFileChange} />

      {selectedFile && (
        <p className="mt-4">
          Selected file: <strong>{selectedFile.name}</strong>
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || status === "uploading"}
        className="mt-4 px-4 py-2 bg-black text-white rounded disabled:opacity-40"
      >
        {status === "uploading" ? "Uploading..." : "Upload"}
      </button>

      {status === "success" && (
        <p className="mt-4 text-green-600">Document ready — ask a question below.</p>
      )}

      {uploadedFileKey && (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">Ask a question</h2>

          <div className="space-y-3 mb-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === "user" ? "text-right" : "text-left"}
              >
                <span
                  className={
                    message.role === "user"
                      ? "inline-block bg-black text-white px-3 py-2 rounded-lg"
                      : "inline-block bg-gray-100 text-gray-900 px-3 py-2 rounded-lg"
                  }
                >
                  {message.content}
                </span>

                {message.role === "assistant" &&
                  message.sources &&
                  message.sources.length > 0 && (
                    <div className="mt-1">
                      <button
                        onClick={() =>
                          setOpenSourcesIndex(
                            openSourcesIndex === index ? null : index
                          )
                        }
                        className="text-xs text-gray-500 underline"
                      >
                        {openSourcesIndex === index
                          ? "Hide sources"
                          : `View sources (${message.sources.length})`}
                      </button>

                      {openSourcesIndex === index && (
                        <div className="mt-2 space-y-2">
                          {message.sources.map((source, sIndex) => (
                            <div
                              key={sIndex}
                              className="text-sm bg-white border border-gray-200 rounded p-2 text-left"
                            >
                              <div className="font-semibold text-xs text-gray-500 mb-1">
                                {source.label} · similarity:{" "}
                                {source.similarity.toFixed(2)}
                              </div>
                              <div className="text-gray-700">{source.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
              placeholder="Ask something about your document..."
              className="flex-1 border rounded px-3 py-2"
            />
            <button
              onClick={handleAskQuestion}
              disabled={!question.trim() || isAsking}
              className="px-4 py-2 bg-black text-white rounded disabled:opacity-40"
            >
              {isAsking ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}