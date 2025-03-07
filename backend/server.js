import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import natural from "natural";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: "*",  // ✅ Allow requests from any origin (temporary fix)
  methods: "GET, POST, OPTIONS",
  allowedHeaders: "Content-Type, Authorization"
}));

// ✅ OR, for better security, restrict to your frontend URL:
app.use(cors({
  origin: "https://google-job-scraper.vercel.app",
  methods: "GET, POST, OPTIONS",
  allowedHeaders: "Content-Type, Authorization"
}));

// ✅ Ensure preflight requests are handled properly:
app.options("*", cors());
app.use(express.json());

// ✅ Cache to store API responses temporarily
const cache = new Map();

app.get("/", (req, res) => {
    console.log("✅ Root URL hit");
    res.send("✅ Google Jobs API is running...");
});

app.get("/scrape-jobs", async (req, res) => {
    const { keyword, location } = req.query;
    const cacheKey = `${keyword}-${location}`;

    // ✅ Check if results exist in cache
    if (cache.has(cacheKey)) {
        console.log("✅ Serving from cache:", cacheKey);
        return res.json({ jobs: cache.get(cacheKey) });
    }

    if (!keyword) {
        console.log("❌ Missing keyword!");
        return res.status(400).json({ error: "Keyword is required" });
    }

    if (!process.env.SERPAPI_KEY) {
        console.log("❌ Missing SerpAPI key in .env");
        return res.status(500).json({ error: "Server configuration error: Missing API key" });
    }

    try {
        console.log("🔄 Fetching jobs from SerpAPI...");
        const response = await axios.get("https://serpapi.com/search", {
            params: {
                engine: "google_jobs",
                q: keyword,
                location: location || "United States",
                api_key: process.env.SERPAPI_KEY
            }
        });

        const jobResults = response.data.jobs_results || [];

        // ✅ Store in cache for 1 hour (3600000 ms)
        cache.set(cacheKey, jobResults);
        setTimeout(() => cache.delete(cacheKey), 3600000);

        res.json({ jobs: jobResults });
    } catch (error) {
        console.error("🔥 Error fetching jobs:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "API request failed", details: error.message });
    }
});

app.get("/", (req, res) => {
    console.log("✅ Root URL hit");
    res.send("✅ Google Jobs API is running...");
});

app.all("/scrape-jobs", async (req, res) => {
    console.log(`📩 ${req.method} request to /scrape-jobs`);
    const params = req.method === "POST" ? req.body : req.query;
    console.log("Request params:", params);

    const { keyword, location, next_page_token } = params;

    if (!keyword) {
        console.log("❌ Missing keyword!");
        return res.status(400).json({ error: "Keyword is required" });
    }

    if (!process.env.SERPAPI_KEY) {
        console.log("❌ Missing SerpAPI key in .env");
        return res.status(500).json({ error: "Server configuration error: Missing API key" });
    }

    try {
        console.log("🔄 Sending API request to SerpAPI...");
        const response = await axios.get("https://serpapi.com/search", {
            params: {
                engine: "google_jobs",
                q: keyword,
                location: location || "United States",
                api_key: process.env.SERPAPI_KEY,
                next_page_token: next_page_token || undefined,
            },
        });

        console.log("✅ Extracted jobs:", response.data.jobs_results?.length || 0);

        // ✅ Process Job Listings (Fixed .map() issue)
        const jobs = response.data.jobs_results?.map((job) => {
            if (!job || !job.description) return null; // Handle missing job descriptions

            console.log("🔍 Processing Job:", job.title);

            // ✅ Extract "Apply" link OR generate a Google search fallback
            const applyLink = job.related_links?.find(link => 
                link.text.toLowerCase().includes("apply") || 
                link.text.toLowerCase().includes("job posting")
            )?.link || `https://www.google.com/search?q=${encodeURIComponent(job.title + " " + job.company_name + " site:higheredjobs.com OR site:linkedin.com OR site:edjoin.org")}`;

            return {
                company: job.company_name,
                role: job.title,
                location: job.location || "Not specified",
                salary: job.salary || "Not provided",
                url: applyLink,  
                ats_keywords: extractKeywords(job.description), // ✅ Added ATS Keywords
            };
        }).filter(Boolean); // Remove null entries

        res.json({
            jobs,
            total_results: response.data.search_information?.total_results || jobs.length,
            next_page_token: response.data.serpapi_pagination?.next_page_token || null,
        });

    } catch (error) {
        console.error("🔥 Error fetching jobs:", error.response ? error.response.data : error.message);
        res.status(500).json({
            error: error.response ? error.response.data?.error : "Failed to fetch jobs",
            details: error.message,
        });
    }
});

// ✅ ATS Keyword Extraction with NLP
function extractKeywords(description) {
    if (!description) return [];

    // ✅ Predefined ATS-relevant terms for faculty positions
    const predefinedKeywords = new Set([
        "adjunct", "faculty", "professor", "tenure", "curriculum", "syllabus",
        "instructional design", "higher education", "assessment", "teaching",
        "pedagogy", "research", "graduate", "undergraduate", "accreditation",
        "learning outcomes", "student success", "academic advising", "STEM", 
        "liberal arts", "education policy", "course development", "PhD", "EdD",
        "leadership", "diversity", "inclusion", "mentorship", "equity",
        "collaboration", "student engagement", "online teaching", "hybrid learning"
    ]);

    // ✅ Tokenizer & NLP (Extracts meaningful words)
    const tokenizer = new natural.WordTokenizer();
    let words = tokenizer.tokenize(description.toLowerCase());

    // ✅ Filter out common stopwords
    const stopwords = new Set(["the", "and", "for", "with", "that", "this", "will", "are", "have", "not", "all", "can", "but", "more", "some"]);
    let dynamicKeywords = words
        .filter(word => word.length > 2 && !stopwords.has(word))
        .reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});

    // ✅ Get **most frequent** words (top 5)
    let topDynamicKeywords = Object.entries(dynamicKeywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

    // ✅ Combine predefined ATS keywords with extracted relevant words
    return [...new Set([...topDynamicKeywords, ...words.filter(word => predefinedKeywords.has(word))])].slice(0, 10);
}

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
