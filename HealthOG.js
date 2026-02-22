require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

// ===== APP SETUP =====

const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// ===== OPENAI SETUP =====

const { OpenAI } = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_KEY.startsWith("gsk_") ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1"
});

// ===== SIMPLE MEMORY DATABASE =====

let patients = [];
let doctors = [];

// ===== FILE UPLOAD CONFIG =====

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== "application/pdf") {
            cb(new Error("Only PDFs allowed"));
        } else {
            cb(null, true);
        }
    }
});

// ===== ROUTES =====

// Patient Login
app.post("/patient-login", (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({
            message: "Phone required"
        });
    }

    res.json({
        message: "OTP Sent (Simulated)"
    });
});

// Doctor Login
app.post("/doctor-login", (req, res) => {
    const { hospitalId, doctorId } = req.body;

    if (hospitalId && doctorId) {
        res.json({
            message: "Doctor Login Successful"
        });
    } else {
        res.status(400).json({
            message: "Invalid Credentials"
        });
    }
});

// Save Patient Details
app.post("/save-patient-details", (req, res) => {
    patients.push(req.body);

    res.json({
        message: "Patient details saved successfully"
    });
});

// Upload Reports
app.post("/upload-reports", upload.array("reports", 5), (req, res) => {
    res.json({
        message: "Reports uploaded successfully",
        files: req.files
    });
});

// ===== AI CHAT ROUTE (OpenAI) =====

// Consult SehatQure AI
app.post("/chat", async (req, res) => {
    try {
        const { message, bodyPart } = req.body;

        if (!message) {
            return res.status(400).json({ reply: "No message sent." });
        }

        let systemPrompt = "";

        switch (bodyPart) {
            case "heart":
                systemPrompt = `You are a cardiologist AI.\nAnswer only heart and cardiovascular related questions.`;
                break;
            case "lungs":
                systemPrompt = `You are a pulmonologist AI.\nAnswer only lung and breathing related questions.`;
                break;
            case "brain":
                systemPrompt = `You are a neurologist AI.\nAnswer only brain and nervous system related questions.`;
                break;
            case "dentist":
                systemPrompt = `You are a dental specialist AI.\nAnswer only teeth, gums and oral health related questions.`;
                break;
            case "pediatric":
                systemPrompt = `You are a pediatrician AI.\nAnswer only child and infant health related questions.`;
                break;
            case "gynaec":
                systemPrompt = `You are a gynecology specialist AI.\nAnswer only women's reproductive health related questions.`;
                break;
            case "ophthal":
                systemPrompt = `You are an ophthalmologist AI.\nAnswer only eye and vision related questions.`;
                break;
            case "general":
                systemPrompt = `You are a general physician AI.\nFirst identify which body part the symptoms relate to.\nThen provide appropriate medical guidance.`;
                break;
            default:
                systemPrompt = `You are SehatQure AI medical assistant.\nProvide safe and professional advice.`;
        }

        // Call OpenAI API
        const modelName = process.env.OPENAI_API_KEY.startsWith("gsk_") ? "llama-3.3-70b-versatile" : "gpt-3.5-turbo";

        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
        });

        const replyText = completion.choices[0].message.content;

        res.json({
            reply: replyText
        });

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({
            reply: "AI is currently unavailable. " + (error.message || "")
        });
    }
});

// ===== AI PRIORITY ANALYSIS ROUTE =====

app.post("/analyze-priority", async (req, res) => {
    try {
        const { symptoms } = req.body;

        if (!symptoms) {
            return res.status(400).json({ error: "No symptoms provided." });
        }

        const systemPrompt = `You are a medical triage AI. The user will provide their symptoms.
You must analyze the urgency/severity and output a raw JSON object with NO OTHER TEXT.
The JSON object must have exactly two keys:
1. "score": An integer from 0 to 100 where 0 is perfectly fine and 100 is a critical, life-threatening emergency.
2. "analysis": A short, 2-3 sentence explanation of why you gave this score and what the user should do.

Format exactly like this example:
{
  "score": 85,
  "analysis": "Based on severe chest pain radiating to the arm, this could indicate a cardiac event. Please seek immediate emergency medical care."
}`;

        const modelName = process.env.OPENAI_API_KEY.startsWith("gsk_") ? "llama-3.3-70b-versatile" : "gpt-3.5-turbo";

        const completion = await openai.chat.completions.create({
            model: modelName,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: symptoms }
            ],
            temperature: 0.2
        });

        const replyText = completion.choices[0].message.content;

        // Parse the JSON output from the model
        const result = JSON.parse(replyText);

        res.json({
            score: result.score || 0,
            analysis: result.analysis || "Analysis unavailable."
        });

    } catch (error) {
        console.error("Priority Analysis Error:", error);
        res.status(500).json({
            error: "Failed to analyze symptoms. " + (error.message || "")
        });
    }
});

// ===== SERVER START =====

app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});
