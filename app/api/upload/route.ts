import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { processDocument } from "@/lib/rag";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file received" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${file.name}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: file.type,
      }),
    );

    console.log("Uploaded to S3:", key);

    const { chunkCount } = await processDocument(fileBuffer, key);

    console.log(`Processed ${chunkCount} chunks for ${key}`);

    return NextResponse.json({
      message: "File uploaded and processed successfully",
      key,
      chunkCount,
    });
  } catch (error) {
    console.error("UPLOAD ROUTE ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
