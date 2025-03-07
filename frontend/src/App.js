import { useState, useEffect, useRef } from "react";
import axios from "axios";

function App() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loaderRef = useRef(null);  // Ref for scroll detection

  // ✅ Fetch jobs from API
  const backendUrl = "https://google-job-scraper-1.onrender.com";  // ✅ Replace with actual Render backend URL

  const fetchJobs = async (token = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${backendUrl}/scrape-jobs`, {
        params: { keyword, location: location || "United States", next_page_token: token }
      });
      setJobs(response.data.jobs);
      setNextPageToken(response.data.next_page_token);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch jobs");
    }
    setLoading(false);
  };
  
  

  // ✅ Trigger job search when clicking "Scrape Jobs"
  const handleScrape = () => {
    setJobs([]);  // Reset job list
    fetchJobs();
  };

  // ✅ Lazy Scroll: Auto-fetch jobs when near the bottom
  useEffect(() => {
    const handleScroll = () => {
      if (
        loaderRef.current &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        !loading && nextPageToken
      ) {
        fetchJobs(nextPageToken);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [nextPageToken, loading]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Job Scraper</h1>
      <input
        type="text"
        placeholder="Keyword (e.g., Software Engineer)"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginRight: "10px" }}
      />
      <input
        type="text"
        placeholder="Location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ marginRight: "10px" }}
      />
      <button onClick={handleScrape} disabled={loading}>
        {loading ? "Scraping..." : "Scrape Jobs"}
      </button>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      
      <h2>Results</h2>
{jobs.length === 0 && !loading && !error && <p>No jobs found yet. Try scraping!</p>}
<ul>
  {jobs.map((job, index) => (
    <li key={index} style={{ marginBottom: "15px" }}>
      <strong>{job.role}</strong> at {job.company} <br />
      <strong>Location:</strong> {job.location} <br />
      <strong>Salary:</strong> {job.salary} <br />
      <a href={job.url} target="_blank" rel="noopener noreferrer">
        Apply Here
      </a>
      <br />
      <span>ATS Keywords: {job.ats_keywords.join(", ") || "None detected"}</span>
    </li>
  ))}
</ul>


      {loading && <p>Loading more jobs...</p>}
      
      <div ref={loaderRef} style={{ height: "10px" }} /> {/* Invisible loader */}
    </div>
  );
}

export default App;
