// --- File: server.js ---

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;

app.post('/scrape', async (req, res) => {
    const { keyword, domain, region } = req.body;

    if (!BRIGHT_DATA_API_KEY) {
        return res.status(500).json({ error: 'Bright Data API key is not configured on the server.' });
    }
    
    if (!keyword || !domain || !region) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const searchUrl = `https://www.${region}/search?q=${encodeURIComponent(keyword)}&hl=en`;
    const cleanDomain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    const brandName = cleanDomain.split('.')[0];

    try {
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

        const aiOverviewElement = $('[data-sgrd="true"]').first();

        if (aiOverviewElement.length === 0) {
            return res.json({
                keyword,
                overviewText: "Live AI Overview not found on the page for this keyword.",
                found: 'not-applicable'
            });
        }
        
        const overviewText = aiOverviewElement.text();
        const lowerCaseOverview = overviewText.toLowerCase();
        const found = lowerCaseOverview.includes(cleanDomain.toLowerCase()) || lowerCaseOverview.includes(brandName.toLowerCase());

        res.json({ keyword, overviewText, found });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
});

app.listen(port, () => {
    console.log(`AI Overview Checker backend listening at http://localhost:${port}`);
});

// --- File: package.json ---

{
  "name": "ai-checker-backend-v2",
  "version": "1.0.0",
  "description": "Backend server for the AI Overview Checker",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "cheerio": "^1.0.0-rc.12",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "node-fetch": "^3.3.2"
  }
}
