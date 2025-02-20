const { S3Client, PutObjectCommand, GetObjectCommand ,ListObjectsCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");

const app = express();
const port = 3000;

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        const fileStream = fs.createReadStream(file.path);

        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.originalname,
            Body: fileStream,
            ContentType: file.mimetype,
        };

        const command = new PutObjectCommand(uploadParams);
        await s3.send(command);

        fs.unlinkSync(file.path); // Delete local temp file

        const signedUrl = await getSignedUrl(s3, new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.originalname,
        }), { expiresIn: 3600 }); // URL expires in 1 hour

        res.json({ message: "File uploaded successfully", fileUrl: signedUrl });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to upload file" });
    }
});

app.get("/list", async (req, res) => {
    try {
      const listCommand = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME });
      const { Contents } = await s3.send(listCommand);
  
      if (!Contents || Contents.length === 0) {
        return res.json({ message: "No files found in the bucket", files: [] });
      }
  
      const files = Contents.map(file => ({
        name: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
      }));
  
      res.json({ message: "Files retrieved successfully", files });
    } catch (error) {
      console.error("List Error:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });
  
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });