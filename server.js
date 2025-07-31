// AI Overview Checker - Backend Server (Puppeteer Version)

const express = require('express');
const cors = require('cors');
require('dotenv').config();
// Puppeteer-extra is a wrapper around puppeteer, designed to prevent detection.
const puppeteer = require('puppeteer-extra');
// The stealth plugin helps to avoid being detected as a bot.
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;
// Note: You must add BRIGHT_DATA_CUSTOMER_ID to your .env file and Render environment variables
const BRIGHT_DATA_AUTH = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-serp_proxy:${BRIGHT_DATA_API_KEY}`;
const BRIGHT_DATA_PROXY = `http://${BRIGHT_DATA_AUTH}@brd.superproxy.io:22225`;


app.post('/scrape', async (req, res) => {
    const { keyword, domain, region } = req.body;

    if (!BRIGHT_DATA_API_KEY || !process.env.BRIGHT_DATA_CUSTOMER_ID) {
        return res.status(500).json({ error: 'Bright Data credentials are not configured on the server.' });
    }
    
    if (!keyword || !domain || !region) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const searchUrl = `https://www.${region}/search?q=${encodeURIComponent(keyword)}&hl=en`;
    const cleanDomain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];

    let browser = null;
    try {
        // Launch Puppeteer to control a headless Chrome browser, using the Bright Data proxy
        browser = await puppeteer.launch({
            headless: true,
            args: [`--proxy-server=${BRIGHT_DATA_PROXY}`]
        });

        const page = await browser.newPage();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Wait for the AI Overview element to appear on the page.
        await page.waitForSelector('[data-testid="ai-overview"]', { timeout: 15000 }).catch(() => {
            throw new Error("AI Overview element did not appear on the page.");
        });

        // Execute JavaScript inside the browser to get the content of the AI Overview
        const overviewData = await page.evaluate(() => {
            const element = document.querySelector('[data-testid="ai-overview"]');
            if (!element) return null;

            const overviewText = element.innerText;
            const links = Array.from(element.querySelectorAll('a')).map(a => a.href);
            
            return { overviewText, links };
        });

        if (!overviewData) {
            return res.json({
                keyword,
                overviewText: "Live AI Overview not found on the page for this keyword.",
                found: 'not-applicable'
            });
        }
        
        // Check if the domain is present in any of the citation links
        const found = overviewData.links.some(link => link.includes(cleanDomain));

        res.json({ keyword, overviewText: overviewData.overviewText, found });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(port, () => {
    console.log(`AI Overview Checker (Puppeteer) backend listening at http://localhost:${port}`);
});
