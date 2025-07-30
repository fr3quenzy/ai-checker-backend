// AI Overview Checker - Backend Server (CommonJS Version for Compatibility)

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config(); // To use .env file

const app = express();
// Render provides the PORT environment variable.
const port = process.env.PORT || 3000;

app.use(cors()); // Allow requests from the front-end
app.use(express.json());

// Your Bright Data API Key from the .env file
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;

app.post('/scrape', async (req, res) => {
    const { keyword, domain, region } = req.body;

    if (!BRIGHT_DATA_API_KEY) {
        return res.status(500).json({ error: 'Bright Data API key is not configured on the server. Please check your .env file.' });
    }
    
    if (!keyword || !domain || !region) {
        return res.status(400).json({ error: 'Missing required parameters: keyword, domain, or region.' });
    }

    const searchUrl = `https://www.${region}/search?q=${encodeURIComponent(keyword)}&hl=en`;
    const cleanDomain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];

    try {
        // --- Bright Data SERP API Call ---
        const response = await fetch('https://api.brightdata.com/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`
            },
            body: JSON.stringify({
                zone: 'serp_api_aio',
                url: searchUrl,
                format: 'raw'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch from Bright Data: ${response.status} - ${errorText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // --- HTML Parsing ---
        // **FIX:** Use a more resilient selector to find the AI Overview.
        // This targets the first main result block within the primary results container.
        const aiOverviewElement = $('div#rso > div[data-hveid]').first();

        if (aiOverviewElement.length === 0) {
            return res.json({
                keyword,
                overviewText: "Live AI Overview not found on the page for this keyword.",
                found: 'not-applicable'
            });
        }
        
        // Get the plain text for display
        const overviewText = aiOverviewElement.text();
        let found = false;

        // Specifically check for the domain within citation links (<a> tags)
        aiOverviewElement.find('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes(cleanDomain)) {
                found = true;
                return false; // This stops the loop once a match is found
            }
        });

        res.json({ keyword, overviewText, found });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
});

app.listen(port, () => {
    console.log(`AI Overview Checker backend listening at http://localhost:${port}`);
});
